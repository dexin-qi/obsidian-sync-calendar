import { Vault, Notice, FileSystemAdapter, moment } from 'obsidian';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

import { Todo } from 'TodoSerialization/Todo';
import ConcurrentQueue from 'lib/QueueTools';

const path = require('path');

export default class GoogleCalendarSync {
  vault: Vault;

  public doneEventsQueue: ConcurrentQueue<Todo>;

  // If modifying these scopes, delete token.json.
  public SCOPES = ['https://www.googleapis.com/auth/calendar'];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  private TOKEN_PATH = ""
  private CREDENTIALS_PATH = ""

  constructor(vault: Vault) {
    this.vault = vault
    console.log("vault.configDir: " + vault.configDir)
    this.TOKEN_PATH = path.join(vault.configDir, 'calendar.sync.token.json');
    this.CREDENTIALS_PATH = path.join(vault.configDir, 'calendar.sync.credentials.json');

    this.doneEventsQueue = new ConcurrentQueue<Todo>(this.patchEventToDone.bind(this));
  }


  async fetchTodos(numberWeeksAgo: number = 4, max_results: number = 20): Promise<Todo[]> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    let eventsMetaList: any[] | undefined = undefined;

    const weeksAgo = window.moment.duration(numberWeeksAgo, "weeks");
    const startMoment = window.moment().startOf('day').subtract(weeksAgo);
    // console.debug(startMoment.toISOString());

    const eventsListQueryResult = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startMoment.toISOString(),
      maxResults: max_results,
      singleEvents: true,
      orderBy: 'startTime',
    });
    eventsMetaList = eventsListQueryResult.data.items;

    // CalUID 和 id 的区别: 在重复发生的事件中，
    // 每个事件有不同的 id，但是共享相同的icalUID
    // window.moment().format('YYYY-MM-DD[T]HH:mm:ssZ')
    // const eventsMetaList = eventsListQueryResult.data.items;

    let eventsList: Todo[] = [];
    if (eventsMetaList != undefined) {
      eventsMetaList.forEach((eventMeta) => {
        let content = eventMeta.summary;
        let calUId = eventMeta.iCalUID;
        let eventId = eventMeta.id;
        let eventStatus = "";
        let blockId = undefined;
        let priority = undefined;
        let startDateTime: string;
        let dueDateTime: string;
        let tags: string[] = [];
        let updated: string | undefined = undefined;

        if (eventMeta.description !== null && eventMeta.description !== undefined) {
          console.log(eventMeta);
          eventMeta.description = eventMeta.description.replace(/<\/?span>/g, '');
          try {
            blockId = JSON.parse(eventMeta.description).blockId;
          } catch (e) { console.error(e); }
          try {
            priority = JSON.parse(eventMeta.description).priority;
          } catch (e) { console.error(e); }
          try {
            eventStatus = JSON.parse(eventMeta.description).eventStatus;
          } catch (e) { console.error(e); }
          try {
            tags = JSON.parse(eventMeta.description).tags;
          } catch (e) { console.error(e); }
        }
        if (eventStatus === "done") {
          return;
        }

        if (eventMeta.start.dateTime === null || eventMeta.start.dateTime === undefined) {
          startDateTime = window.moment(eventMeta.start.date).format('YYYY-MM-DD');
        } else {
          startDateTime = window.moment(eventMeta.start.dateTime).format('YYYY-MM-DD[T]HH:mm:ssZ');
        }

        if (eventMeta.end.dateTime === null || eventMeta.end.dateTime === undefined) {
          dueDateTime = window.moment(eventMeta.end.date).format('YYYY-MM-DD');
        } else {
          dueDateTime = window.moment(eventMeta.end.dateTime).format('YYYY-MM-DD[T]HH:mm:ssZ');
        }

        if (eventMeta.updated) {
          updated = window.moment(eventMeta.updated).format('YYYY-MM-DD[T]HH:mm:ssZ');
        }

        eventsList.push(
          new Todo({
            content,
            priority,
            blockId,
            startDateTime,
            dueDateTime,
            calUId,
            eventId,
            eventStatus,
            updated,
            tags
          })
        );

      });
    }

    return new Promise((resolve, reject) => {
      resolve(eventsList);
    });
  }


  async pushTodos(todos: Todo[]) {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    todos.forEach(async (todo) => {
      let todoEvent = {
        'summary': todo.content,
        'description': todo.serializeDescription(),
        'start': {},
        'end': {},
        'reminders': {
          'useDefault': false,
          'overrides': [
            { 'method': 'popup', 'minutes': 10 },
          ],
        },
      };

      let isValidInterval = false;
      const regDateTime = /(\d{4}-\d{2}-\d{2}T\d+:\d+)/u;
      if (todo.startDateTime?.match(regDateTime) && todo.dueDateTime?.match(regDateTime)) {
        isValidInterval = true;
      }

      let isValidEvent = false;
      if (isValidInterval) {
        todoEvent.start.dateTime = todo.startDateTime;
        todoEvent.end.dateTime = todo.dueDateTime;
        isValidEvent = true;
      } else {
        const regDate = /(\d{4}-\d{2}-\d{2})/u;
        if (todo.startDateTime) {
          let startDateMatch = todo.startDateTime.match(regDate);
          let endDateMatch = todo.dueDateTime?.match(regDate);
          if (startDateMatch) {
            todoEvent.start.date = startDateMatch[1];
            todoEvent.end.date = endDateMatch ? endDateMatch[1] : startDateMatch[1];
            isValidEvent = true;
          } else if (endDateMatch) {
            todoEvent.start.date = endDateMatch[1];
            todoEvent.end.date = endDateMatch[1];
          }
        }
      }
      if (isValidEvent) {
        todoEvent.start.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        todoEvent.end.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } else {
        new Notice(`Invalid todo event ${todo.content}`);
      }

      let retryTimes = 0;
      let isInsertSuccess = false;
      while (retryTimes < 20 && !isInsertSuccess) {
        ++retryTimes;
        await this.insertEvent(calendar, auth, todoEvent)
          .then((event) => {
            isInsertSuccess = true;
            console.info(`Added event: ${todoEvent.summary}! link: ${event.data.htmlLink}`);
          }).catch(async (error) => {
            console.error('Error on inserting event:', error);
            await new Promise(resolve => setTimeout(resolve, 100));
          });
      } // retry loop
    }); // todos <for each>
  }

  async patchEventToDone(todo: Todo): Promise<boolean> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    let retryTimes = 0;
    let isInsertSuccess = false;

    todo.eventStatus = 'done';
    const eventDescUpdate = todo.serializeDescription();

    while (retryTimes < 20 && !isInsertSuccess) {
      ++retryTimes;

      await this.patchEvent(calendar, auth, todo.eventId, { "description": eventDescUpdate, })
        .then(() => {
          isInsertSuccess = true;
          console.info(`Patched event: ${todo.content}!`);
        }).catch(async (error) => {
          console.error('Error on patching event:', error);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
    }
    return isInsertSuccess;
  }

  private async insertEvent(calendar, auth, eventMeta) {
    return new Promise((resolve, reject) => {
      calendar.events.insert({
        auth: auth,
        calendarId: 'primary',
        resource: eventMeta,
      }, function (err, res) {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  private async patchEvent(calendar, auth, eventId, eventResource) {
    return new Promise(async (resolve, reject) => {
      await calendar.events.patch({
        auth: auth,
        calendarId: 'primary',
        eventId: eventId,
        resource: eventResource
      }, function (err, res) {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      })
    });
  }

  async isReady(): Promise<boolean> {
    const client = await this.loadSavedCredentialsIfExist();
    if (client) {
      return true;
    }
    return false;
  }

  /**
  * Reads previously authorized credentials from the save file.
  *
  * @return {Promise<OAuth2Client|null>}
  */
  async loadSavedCredentialsIfExist() {
    try {
      // console.log('token path: ' + this.TOKEN_PATH);
      const content = await this.vault.adapter.read(this.TOKEN_PATH);
      const credentials = JSON.parse(content);
      return google.auth.fromJSON(credentials);
    } catch (err) {
      return null;
    }
  }

  /**
   * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
   *
   * @param {OAuth2Client} client
   * @return {Promise<void>}
   */
  async saveCredentials(client) {
    const content = await this.vault.adapter.read(this.CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    console.log('cache in: ' + this.TOKEN_PATH);
    await this.vault.adapter.write(this.TOKEN_PATH, payload);
  }

  /**
   * Load or request or authorization to call APIs.
   *
   */
  public async authorize() {
    let client = await this.loadSavedCredentialsIfExist()
    if (client) {
      return client;
    }

    const fs_adapter = this.vault.adapter as FileSystemAdapter;
    const KEY_FILE = fs_adapter.getFullPath(this.CREDENTIALS_PATH);
    console.log("file path: " + KEY_FILE);
    client = await authenticate({
      scopes: this.SCOPES,
      keyfilePath: KEY_FILE,
    }).catch(err => { throw err; });

    if (client.credentials) {
      await this.saveCredentials(client);
    }
    return client;
  }

}