import type { App, Vault, Notice, FileSystemAdapter } from 'obsidian';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import type { OAuth2Client, GaxiosPromise, GaxiosResponse } from 'googleapis-common';
import type { calendar_v3 } from 'googleapis';

import { Todo } from 'TodoSerialization/Todo';
import { debug } from 'lib/DebugLog';

import {
  NetworkStatus,
  SyncStatus,
  gfSyncStatus$,
  gfNetStatus$
} from './StatusEnumerate';

const path = require('path');

export class GoogleCalendarSync {
  vault: Vault;


  // If modifying these scopes, delete token.json.
  public SCOPES = ['https://www.googleapis.com/auth/calendar'];
  // The file token.json stores the user's access and refresh tokens, and is
  // created automatically when the authorization flow completes for the first
  // time.
  private TOKEN_PATH = ""
  private CREDENTIALS_PATH = ""

  constructor(app: App) {
    this.vault = app.vault

    this.TOKEN_PATH = path.join(this.vault.configDir, 'calendar.sync.token.json');
    this.CREDENTIALS_PATH = path.join(this.vault.configDir, 'calendar.sync.credentials.json');
  }

  // 返回完成/未完成的 events
  async listEvents(startMoment: moment.Moment, maxResults: number = 200): Promise<Todo[]> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    gfSyncStatus$.next(SyncStatus.DOWNLOAD);
    const eventsListQueryResult =
      await calendar.events
        .list({
          calendarId: 'primary',
          timeMin: startMoment.toISOString(),
          maxResults: maxResults,
          singleEvents: true,
          orderBy: 'startTime',
        })
        .catch(err => {
          gfNetStatus$.next(NetworkStatus.CONNECTION_ERROR);
          gfSyncStatus$.next(SyncStatus.FAILED_WARNING);
          throw err;
        });
    gfNetStatus$.next(NetworkStatus.HEALTH);
    gfSyncStatus$.next(SyncStatus.SUCCESS_WAITING);

    let eventsMetaList = eventsListQueryResult.data.items;
    let eventsList: Todo[] = [];

    if (eventsMetaList != undefined) {
      eventsMetaList.forEach((eventMeta: calendar_v3.Schema$Event) => {
        eventsList.push(Todo.fromGoogleEvent(eventMeta));
      });
    }

    return eventsList;
  }


  async insertEvent(todo: Todo) {
    let auth = await this.authorize();
    const calendar: calendar_v3.Calendar = google.calendar({ version: 'v3', auth });

    let retryTimes = 0;
    let isInsertSuccess = false;
    gfSyncStatus$.next(SyncStatus.UPLOAD);
    while (retryTimes < 20 && !isInsertSuccess) {
      ++retryTimes;
      await calendar.events
        .insert({
          auth: auth,
          calendarId: 'primary',
          resource: Todo.toGoogleEvent(todo)
        } as calendar_v3.Params$Resource$Events$Insert
        )
        .then((event) => {
          isInsertSuccess = true;
          debug(`Added event: ${todo.content}! link: ${event.data.htmlLink}`);
          return;
        }).catch(async (error) => {
          debug('Error on inserting event:', error);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
    }

    if (isInsertSuccess) {
      gfSyncStatus$.next(SyncStatus.SUCCESS_WAITING);
      gfNetStatus$.next(NetworkStatus.HEALTH);
    } else {
      gfSyncStatus$.next(SyncStatus.FAILED_WARNING);
      gfNetStatus$.next(NetworkStatus.CONNECTION_ERROR);
      throw Error(`Failed to insert event: ${todo.content}`);
    }
  }


  async deleteEvent(todo: Todo): Promise<void> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    let retryTimes = 0;
    let isDeleteSuccess = false;
    gfSyncStatus$.next(SyncStatus.UPLOAD);
    while (retryTimes < 20 && !isDeleteSuccess) {
      ++retryTimes;

      await calendar.events
        .delete({
          auth: auth,
          calendarId: 'primary',
          eventId: todo.eventId
        } as calendar_v3.Params$Resource$Events$Delete)
        .then(() => {
          isDeleteSuccess = true;
          debug(`Deleted event: ${todo.content}!`);
          return;
        }).catch(async (err) => {
          debug(`Error on delete event: ${err}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
    }
    if (isDeleteSuccess) {
      gfSyncStatus$.next(SyncStatus.SUCCESS_WAITING);
      gfNetStatus$.next(NetworkStatus.HEALTH);
    } else {
      gfSyncStatus$.next(SyncStatus.FAILED_WARNING);
      gfNetStatus$.next(NetworkStatus.CONNECTION_ERROR);
      throw Error(`Failed to delete event: ${todo.content}`);
    }
  }


  async patchEvent(todo: Todo, getEventPatch: (todo: Todo) => calendar_v3.Schema$Event): Promise<void> {
    let auth = await this.authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    let retryTimes = 0;
    let isPatchSuccess = false;
    gfSyncStatus$.next(SyncStatus.UPLOAD);
    while (retryTimes < 20 && !isPatchSuccess) {
      ++retryTimes;

      let x = getEventPatch(todo);

      await calendar.events
        .patch({
          auth: auth,
          calendarId: 'primary',
          eventId: todo.eventId,
          resource: getEventPatch(todo)
        } as calendar_v3.Params$Resource$Events$Patch)
        .then(() => {
          isPatchSuccess = true;
          debug(`Patched event: ${todo.content}`);
          return;
        })
        .catch(async (error) => {
          debug(`Error on patching event: ${error}`);
          await new Promise(resolve => setTimeout(resolve, 100));
        });
    }

    if (isPatchSuccess) {
      gfSyncStatus$.next(SyncStatus.SUCCESS_WAITING);
      gfNetStatus$.next(NetworkStatus.HEALTH);
    } else {
      gfSyncStatus$.next(SyncStatus.FAILED_WARNING);
      gfNetStatus$.next(NetworkStatus.CONNECTION_ERROR);
      throw Error(`Failed on patched event: ${todo.content}`);
    }
  }


  static getEventDonePatch(todo: Todo): calendar_v3.Schema$Event {
    if (!todo.eventStatus) {
      todo.eventStatus = 'x';
    }
    if (['!', '?', '>', '-', ' '].indexOf(todo.eventStatus) < 0) {
      todo.eventStatus = 'x';
    }

    const eventDescUpdate = todo.serializeDescription();
    switch (todo.eventStatus) {
      case '-':
        return {
          "summary": `🚫 ${todo.content}`,
          "description": eventDescUpdate,
        } as calendar_v3.Schema$Event;
      case '!':
        return {
          "summary": `❗️ ${todo.content}`,
          "description": eventDescUpdate,
        } as calendar_v3.Schema$Event;
      case '>':
        return {
          "summary": `💤 ${todo.content}`,
          "description": eventDescUpdate,
        } as calendar_v3.Schema$Event;
      case '?':
        return {
          "summary": `❓ ${todo.content}`,
          "description": eventDescUpdate,
        } as calendar_v3.Schema$Event;
      case 'x':
      case 'X':
        return {
          "summary": `✅ ${todo.content}`,
          "description": eventDescUpdate,
        } as calendar_v3.Schema$Event;
    }
    return {
      "summary": `✅ ${todo.content}`,
      "description": eventDescUpdate,
    } as calendar_v3.Schema$Event;
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
  async saveCredentials(client: OAuth2Client) {
    const content = await this.vault.adapter.read(this.CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;

    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    await this.vault.adapter.write(this.TOKEN_PATH, payload);
  }

  /**
   * Load or request or authorization to call APIs.
   *
   */
  public async authorize(): Promise<OAuth2Client> {
    let client: OAuth2Client = await this.loadSavedCredentialsIfExist() as OAuth2Client;
    if (client) {
      return client;
    }

    const fs_adapter = this.vault.adapter as FileSystemAdapter;
    const KEY_FILE = fs_adapter.getFullPath(this.CREDENTIALS_PATH);
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