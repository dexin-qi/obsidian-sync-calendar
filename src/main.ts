import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: 'default'
}

const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate, OAuth2Client } = require('@google-cloud/local-auth');
const { google } = require('googleapis');




export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    await this.loadSettings()


    // If modifying these scopes, delete token.json.
    const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
    // The file token.json stores the user's access and refresh tokens, and is
    // created automatically when the authorization flow completes for the first
    // time.
    // const TOKEN_PATH = path.join(process.cwd(), 'token.json');
    // const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');


    // /**
    // * Reads previously authorized credentials from the save file.
    // *
    // * @return {Promise<OAuth2Client|null>}
    // */
    // async function loadSavedCredentialsIfExist() {
    //   try {
    //     console.log('token path: ' + TOKEN_PATH);
    //     const content = await fs.readFile(TOKEN_PATH);
    //     const credentials = JSON.parse(content);
    //     return google.auth.fromJSON(credentials);
    //   } catch (err) {
    //     return null;
    //   }
    // }

    // /**
    //  * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
    //  *
    //  * @param {OAuth2Client} client
    //  * @return {Promise<void>}
    //  */
    // async function saveCredentials(client) {
    //   console.log('cache in: ' + CREDENTIALS_PATH);
    //   const content = await fs.readFile(CREDENTIALS_PATH);
    //   const keys = JSON.parse(content);
    //   const key = keys.installed || keys.web;
    //   const payload = JSON.stringify({
    //     type: 'authorized_user',
    //     client_id: key.client_id,
    //     client_secret: key.client_secret,
    //     refresh_token: client.credentials.refresh_token,
    //   });
    //   await fs.writeFile(TOKEN_PATH, payload);
    // }

    /**
     * Load or request or authorization to call APIs.
     *
     */
    async function authorize() {
      // let client = await loadSavedCredentialsIfExist();
      // if (client) {
      //   return client;
      // }
      let client = await authenticate({
        scopes: SCOPES,
        keyfilePath: '/Users/dustinksi/.cache/obsidian/cred.json',
      });
      // if (client.credentials) {
      //   await saveCredentials(client);
      // }
      return client;
    }

    /**
     * Lists the next 10 events on the user's primary calendar.
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    async function listEvents(auth) {
      const calendar = google.calendar({ version: 'v3', auth });
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      });
      const events = res.data.items;
      if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return;
      }
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    }


    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('sync', 'Sync With Calendar', (evt: MouseEvent) => {
      new Notice('Will open google!');
      authorize().then(listEvents).catch(console.error);
      new Notice('Hi from dexin.qi with new arch!');
    });
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText('Status Bar Text');

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        new SampleModal(this.app).open();
      }
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'sample-editor-command',
      name: 'Sample editor command',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        console.log(editor.getSelection());
        editor.replaceSelection('Sample Editor Command');
      }
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: 'open-sample-modal-complex',
      name: 'Open sample modal (complex)',
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // This command will only show up in Command Palette when the check function returns true
          return true;
        }
      }
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
      console.log('click', evt);
    });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  onunload() {

  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

    new Setting(containerEl)
      .setName('Setting #1')
      .setDesc('It\'s a secret')
      .addText(text => text
        .setPlaceholder('Enter your secret')
        .setValue(this.plugin.settings.mySetting)
        .onChange(async (value) => {
          console.log('Secret: ' + value);
          this.plugin.settings.mySetting = value;
          await this.plugin.saveSettings();
        }));
  }
}
