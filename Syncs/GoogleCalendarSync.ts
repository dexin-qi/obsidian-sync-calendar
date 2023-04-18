import { Vault, Notice, FileSystemAdapter, moment } from 'obsidian';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

import { Todo } from 'TodoSerialization/Todo';
import { rejects } from 'assert';


const path = require('path');

export default class GoogleCalendarSync {
  vault: Vault

  // If modifying these scopes, delete token.json.
  SCOPES = ['https://www.googleapis.com/auth/calendar'];

  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  TOKEN_PATH = ""

  CREDENTIALS_PATH = ""

  constructor(vault: Vault) {
    this.vault = vault
    console.log("vault.configDir: " + vault.configDir)
    this.TOKEN_PATH = path.join(vault.configDir, 'calendar.sync.token.json');
    this.CREDENTIALS_PATH = path.join(vault.configDir, 'calendar.sync.credentials.json');

    this.authorize();
  }


  async fetchTodos(max_results = 20): Promise<Todo[]> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    let eventsMetaList: any[] | undefined = undefined;

    const eventsListQueryResult = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
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
        let blockId = undefined;
        let startDateTime: string;
        let dueDateTime: string;
        let updated: string | undefined = undefined;

        if (eventMeta.description !== null && eventMeta.description !== undefined) {
          blockId = JSON.parse(eventMeta.description).blockId;
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
            blockId,
            startDateTime,
            dueDateTime,
            calUId,
            updated
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
        'description': `{"blockId": "${todo.blockId}"}`,
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
        try {
          await this.insertEvent(calendar, auth, todoEvent).then((event) => {
            isInsertSuccess = true;
            console.info(`Added event: ${todoEvent.summary}! link: ${event.data.htmlLink}`);
          });
        }
        catch (error) {
          console.error('Error inserting event:', error);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } // retry loop
    }); // todos <for each>
  }

  private async insertEvent(calendar, auth, eventMeta) {
    return new Promise((resolve, reject) => {
      calendar.events.insert({
        auth: auth,
        calendarId: 'primary',
        resource: eventMeta,
      }, function (err, event) {
        if (err) {
          reject(err);
        } else {
          resolve(event);
        }
      });
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