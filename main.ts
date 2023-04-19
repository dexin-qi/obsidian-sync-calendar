import axios from 'axios';

import { App, type PluginManifest, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import type { Todo } from 'TodoSerialization/Todo';
import GoogleCalendarSync from 'Syncs/GoogleCalendarSync'
import { NetworkStatus } from 'Syncs/StatusEnumerate';
import ObsidianTasksSync from 'Syncs/ObsidianTasksSync';
import QueryInjector from 'Injector/QueryInjector';
// import SyncResultModal from './Modals/syncResult'

// Remember to rename these classes and interfaces!

interface SyncCalendarPluginSettings {
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: number;
  proxyProtocol: string;

  fetchWeeksAgo: number;
  fetchMaximumEvents: number;

  renderDate: boolean;
  renderTags: boolean;
}

const DEFAULT_SETTINGS: SyncCalendarPluginSettings = {
  proxyEnabled: false,
  proxyHost: '127.0.0.1',
  proxyPort: 20171,
  proxyProtocol: 'http',

  fetchWeeksAgo: 4,
  fetchMaximumEvents: 2000,

  renderDate: true,
  renderTags: true,
}


export default class SyncCalendarPlugin extends Plugin {
  public settings: SyncCalendarPluginSettings;

  public syncStatusItem: HTMLElement;

  public netStatus: NetworkStatus;
  public netStatusItem: HTMLElement;

  private calendarSync: GoogleCalendarSync;
  private obsidianSync: ObsidianTasksSync;

  private queryInjector: QueryInjector;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
  }

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SyncCalendarPluginSettingTab(this.app, this));

    if (this.settings.proxyEnabled) {
      axios.defaults.proxy = {
        host: this.settings.proxyHost,
        port: this.settings.proxyPort,
        protocol: this.settings.proxyProtocol,
      };
      console.log("Proxy protocol: " + axios.defaults.proxy.protocol);
      console.log("Proxy host: " + axios.defaults.proxy.host);
      console.log("Proxy port: " + axios.defaults.proxy.port);
    } else {
      axios.defaults.proxy = false;
      console.log("Proxy Not Enabled!");
    }

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    this.netStatusItem = this.addStatusBarItem();
    this.netStatusItem.setText("Net: 🔵");
    this.syncStatusItem = this.addStatusBarItem();
    this.syncStatusItem.setText("Sync: *️⃣");

    this.calendarSync = new GoogleCalendarSync(this.app.vault);
    this.obsidianSync = new ObsidianTasksSync(this.app);

    this.queryInjector = new QueryInjector(this);
    this.queryInjector.setCalendarSync(this.calendarSync);

    this.registerMarkdownCodeBlockProcessor("calendar-sync",
      this.queryInjector.onNewBlock.bind(this.queryInjector)
    );

    // Add Ribbons
    const ribbonIconEl = this.addRibbonIcon('sync', 'Sync With Calendar', async (evt: MouseEvent) => {
      this.syncWithCalendar();
    });
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // Add Commands
    this.addCommand({
      id: 'sync-with-calendar',
      name: 'Sync With Calendar',
      callback: async () => {
        this.syncWithCalendar();
      }
    });

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => {
      if (this.settings.proxyEnabled) {
        const proxy = {
          host: this.settings.proxyHost,
          port: this.settings.proxyPort,
          protocol: this.settings.proxyProtocol,
        };
        // TODO: exam the proxy
        // this.netStatus = NetworkStatus.PROXY_ERROR;
      }

      switch (this.netStatus) {
        case NetworkStatus.CONNECTION_ERROR:
          this.netStatusItem.setText("Net: 🔴");
          break;
        case NetworkStatus.PROXY_ERROR:
          this.netStatusItem.setText("Net: 🟠");
          break;
        case NetworkStatus.HEALTH:
          this.netStatusItem.setText("Net: 🟢");
          break;
        case NetworkStatus.UNKOWN:
          this.netStatusItem.setText("Net: 🔵");
        default:
          break;
      }
    }, 5000));

    this.registerInterval(window.setInterval(() => {
      this.patchDoneEventLists();
    }, 1000));
  }

  onunload() {

  }

  private async syncWithCalendar() {
    this.syncStatusItem.setText('Sync: 🔄');

    let obsidianTodos = this.obsidianSync.fetchTodos();
    let obsidianTodosBlockIds: string[] = [];
    if (obsidianTodos instanceof Error) {
      new Notice("Error on fetch Obsidain tasks");
      return;
    }
    obsidianTodos.map((todo) => {
      if (todo.blockId !== null && todo.blockId !== undefined) {
        obsidianTodosBlockIds.push(todo.blockId);
      }
    });

    let calendarTodos: Todo[] = await this.calendarSync.fetchTodos(
      this.settings.fetchWeeksAgo,
      this.settings.fetchMaximumEvents
    );
    let calendarTodosBlockIds: string[] = [];
    calendarTodos.map((todo) => {
      if (todo.blockId !== null && todo.blockId !== undefined) {
        calendarTodosBlockIds.push(todo.blockId);
      }
    });

    let newCalendarTodos: Todo[] = [];
    let updateCalendarTodos: Todo[] = [];
    let newObsidianTodos: Todo[] = [];
    let updateObsidianTodos: Todo[] = [];

    // debugger
    obsidianTodos.map((todo: Todo) => {
      if (todo.blockId === null || todo.blockId === undefined) {
        console.error(`${todo.content} does not have a blockId`);
        return;
      }
      if (calendarTodosBlockIds.indexOf(todo.blockId) > -1) {
        updateCalendarTodos.push(todo);
      } else {
        newCalendarTodos.push(todo);
      }
    });

    calendarTodos.map((todo: Todo) => {
      if (todo.blockId === null || todo.blockId === undefined) {
        console.log(`${todo.content} was creat outside of Obsidian`);
        newObsidianTodos.push(todo);
        return;
      }
      if (calendarTodosBlockIds.indexOf(todo.blockId) > -1) {
        updateObsidianTodos.push(todo);
      } else {
        newObsidianTodos.push(todo);
      }
    });

    let eventDescs: string[] = [];

    // V1.0: I trust Calendar meta more.
    // 先抓取全部 events in Calendar
    // 再抓取全部 [valid] tasks in Obsidian
    // 如果不同则修改 Obsidian 

    // Obsidian --{+}-> Calendar
    await this.calendarSync.pushTodos(newCalendarTodos);

    if (newCalendarTodos.length > 0) {
      eventDescs.push(`${(newCalendarTodos.length)} event(s) add to Calendar`);
      newCalendarTodos.map((todo: Todo, i) => {
        eventDescs.push(`\t${i}. ${todo.content}`);
      });
    }

    // TODO: Obsidian --{m}-> Calendar 
    // this.calendarSync.updateTodos(updateCalendarTodos);

    if (updateCalendarTodos.length > 0) {
      eventDescs.push(`${(updateCalendarTodos.length)} event(s) updated to Calendar`);
      updateCalendarTodos.map((todo: Todo, i) => {
        eventDescs.push(`\t${i}. ${todo.content}`);
      });
    }

    // Obsidian <-{m}-- Calendar
    this.obsidianSync.updateTodos(obsidianTodos, updateObsidianTodos);

    if (updateObsidianTodos.length > 0) {
      eventDescs.push(`${(updateObsidianTodos.length)} event(s) updated to Obsidian`);
      updateObsidianTodos.map((todo: Todo, i) => {
        eventDescs.push(`\t${i}. ${todo.content}`);
      });
    }

    // TODO: Obsidian <-{+}-- Calendar
    // this.obsidianSync.pushTodos(newObsidianTodos);

    // if (newObsidianTodos.length > 0) {
    //   eventDescs.push(`${(newObsidianTodos.length)} event(s) add to Obsidian`);
    //   newObsidianTodos.map((todo: Todo, i) => {
    //     eventDescs.push(`\t${i}. ${todo.content}`);
    //   });
    // }

    if (eventDescs.length == 0) {
      eventDescs.push('Sync Result: no update');
    }

    this.netStatus = NetworkStatus.HEALTH;
    this.syncStatusItem.setText('Sync: 🆗');

    // new SyncResultModal(this.app, eventDescs).open();
    new Notice(eventDescs.join('\n'));
  }

  private async patchDoneEventLists() {
    const apiIsReady = await this.calendarSync.isReady();
    if (!apiIsReady) {
      return;
    }
    const originNeedToPath = this.calendarSync.doneEventsQueue.length;
    if (originNeedToPath <= 0) {
      return;
    }

    this.syncStatusItem.setText("Sync: ⬆️");
    this.calendarSync.doneEventsQueue.refresh().then((isAllSucc) => {
      if (isAllSucc) {
        this.netStatus = NetworkStatus.HEALTH;
        this.syncStatusItem.setText("Sync: 🆗");
        console.info(
          `Successfully Patched ${originNeedToPath - this.calendarSync.doneEventsQueue.length
          } events!`
        );
      } else {
        this.syncStatusItem.setText("Sync: 🆖");
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SyncCalendarPluginSettingTab extends PluginSettingTab {
  plugin: SyncCalendarPlugin;
  proxyEnabledCheckbox: HTMLInputElement;
  protocolSelect: HTMLSelectElement;
  hostInput: HTMLInputElement;
  portInput: HTMLInputElement;

  constructor(app: App, plugin: SyncCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    this.createHeader(
      "SyncCalendar",
      "Sync Google calendar 📆 events with your Obsidian notes."
    );

    this.createHeader(
      "Proxy Settings",
      "The Proxy Settings to use when syncing with calendar. \u26A0\ufe0fYou will need to RESTART Obsidian after setting this! \u26A0\ufe0f"
    );


    // Proxy enabled checkbox
    this.proxyEnabledCheckbox = new Setting(containerEl)
      .setName("Enable Proxy")
      // .setDesc(desc)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.proxyEnabled)
          .onChange(async (value) => {
            this.plugin.settings.proxyEnabled = value;
            this.toggleProxySettings(value);
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    // Protocol type selector
    this.protocolSelect = new Setting(containerEl)
      .setName("Protocol Type")
      .addDropdown(dropdown =>
        dropdown
          .addOption("http", "HTTP")
          .addOption("https", "HTTPS")
          .addOption("socks5", "SOCKS5")
          .setValue(this.plugin.settings.proxyProtocol)
          .onChange(async (value) => {
            this.plugin.settings.proxyProtocol = value;
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("select");

    // Proxy server address input
    this.hostInput = new Setting(containerEl)
      .setName("Server Address")
      .setDesc("Enter the IP address or hostname of the proxy server")
      .addText(text =>
        text
          .setValue(this.plugin.settings.proxyHost)
          .onChange(async (value) => {
            this.plugin.settings.proxyHost = value;
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    // Proxy server port input
    this.portInput = new Setting(containerEl)
      .setName("Server Port")
      .setDesc("Enter the port number used by the proxy server")
      .addText(text =>
        text
          .setValue(this.plugin.settings.proxyPort.toString())
          .onChange(async (value) => {
            const port = parseInt(value);
            if (!isNaN(port)) {
              this.plugin.settings.proxyPort = port;
              await this.plugin.saveSettings();
            }
          })
      )
      .controlEl.querySelector("input");

    // Hide or show the protocol type selector, address input, and port input based on whether the proxy is enabled
    this.toggleProxySettings(this.plugin.settings.proxyEnabled);


    this.createHeader(
      "Fetch Settings",
      "Settings to manage calendar fetch events."
    );


    new Setting(containerEl)
      .setName("Weeks Ago")
      .setDesc("Enter how many weeks ago did you concerned.")
      .addText(text =>
        text
          .setValue(this.plugin.settings.fetchWeeksAgo.toString())
          .onChange(async (value) => {
            const weeksAgo = parseInt(value);
            if (!isNaN(weeksAgo)) {
              this.plugin.settings.fetchWeeksAgo = weeksAgo;
            }
            await this.plugin.saveSettings();
          })
      ).controlEl.querySelector("input");

    new Setting(containerEl)
      .setName("Maximum Events")
      .setDesc("Enter the maximum number of events in the fetching window")
      .addText(text =>
        text
          .setValue(this.plugin.settings.fetchMaximumEvents.toString())
          .onChange(async (value) => {
            const maximumEvents = parseInt(value);
            if (!isNaN(maximumEvents)) {
              this.plugin.settings.fetchMaximumEvents = maximumEvents;
              await this.plugin.saveSettings();
            }
          })
      ).controlEl.querySelector("input");

    this.createHeader(
      "Render Settings",
      "Settings to manage render events."
    );

    new Setting(containerEl)
      .setName("Render Date")
      // .setDesc(desc)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.renderDate)
          .onChange(async (value) => {
            this.plugin.settings.renderDate = value;
            this.toggleProxySettings(value);
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    new Setting(containerEl)
      .setName("Render Tags")
      // .setDesc(desc)
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.renderTags)
          .onChange(async (value) => {
            this.plugin.settings.renderTags = value;
            this.toggleProxySettings(value);
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");
  }

  toggleProxySettings(enabled: boolean) {
    this.protocolSelect.disabled = !enabled;
    this.hostInput.disabled = !enabled;
    this.portInput.disabled = !enabled;
  }

  private createHeader(header_title: string, header_desc: string | null = null) {
    // this.containerEl.createEl('h3', { text: "hello" });
    const header = this.containerEl.createDiv();
    header.createEl('p', { text: header_title, cls: 'sync-calendar-setting-header-title' });
    if (header_desc) {
      header.createEl('p', { text: header_desc, cls: 'sync-calendar-setting-header-description' });
    }
  }
}