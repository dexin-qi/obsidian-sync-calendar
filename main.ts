import axios from 'axios';
import { App, type PluginManifest, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import type { Todo } from 'TodoSerialization/Todo';
import { TodosEvents } from 'TodoSerialization/TodoEvents';
import { Cache, State } from 'TodoSerialization/Cache';
import GoogleCalendarSync from 'Syncs/GoogleCalendarSync'
import ObsidianTasksSync from 'Syncs/ObsidianTasksSync';
import QueryInjector from 'Injector/QueryInjector';
// import SyncResultModal from './Modals/syncResult'

// Remember to rename these classes and interfaces!

interface SyncCalendarPluginSettings {
  proxy_enabled: boolean;
  proxy_host: string;
  proxy_port: number;
  proxy_protocol: string;
}

const DEFAULT_SETTINGS: SyncCalendarPluginSettings = {
  proxy_enabled: false,
  proxy_host: '127.0.0.1',
  proxy_port: 20171,
  proxy_protocol: 'http',
}


export default class SyncCalendarPlugin extends Plugin {
  public settings: SyncCalendarPluginSettings;
  public syncStatusItem: HTMLElement;

  private cache: Cache | undefined;
  private calendarSync: GoogleCalendarSync;
  private obsidianSync: ObsidianTasksSync;

  private queryInjector: QueryInjector;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
  }

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new SyncCalendarPluginSettingTab(this.app, this));

    if (this.settings.proxy_enabled) {
      axios.defaults.proxy = {
        host: this.settings.proxy_host,
        port: this.settings.proxy_port,
        protocol: this.settings.proxy_protocol,
      };
      console.log("Proxy protocol: " + axios.defaults.proxy.protocol);
      console.log("Proxy host: " + axios.defaults.proxy.host);
      console.log("Proxy port: " + axios.defaults.proxy.port);
    } else {
      console.log("Proxy Not Enabled!");
      axios.defaults.proxy = false;
      console.log("Proxy: " + axios.defaults.proxy);
    }

    // const events = new TodosEvents({ obsidianEvents: this.app.workspace });
    // this.cache = new Cache({
    //   app: this.app,
    //   metadataCache: this.app.metadataCache,
    //   vault: this.app.vault,
    //   events,
    // });

    // this.app.plugins..registerEvent(plugin.app.metadataCache.on("dataview:metadata-change",
    // ));

    // this.app.workspace.trigger("dataview:index-ready", () => {
    //   console.log("!!! Dateview is ready, dexin has receive callback!!!");
    // });

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    this.syncStatusItem = this.addStatusBarItem();

    this.calendarSync = new GoogleCalendarSync(this.app.vault);
    this.obsidianSync = new ObsidianTasksSync(this.app);

    this.queryInjector = new QueryInjector(this, this.app);
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

    // // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  onunload() {

  }

  private async syncWithCalendar() {
    this.syncStatusItem.setText('Sync With Calendar...');

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

    let calendarTodos: Todo[] = await this.calendarSync.fetchTodos();
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

    this.syncStatusItem.setText('Sync Done!');

    // new SyncResultModal(this.app, eventDescs).open();
    new Notice(eventDescs.join('\n'));
  }

  private onRequestCacheUpdate({ todos, state }: { todos: Todo[], state: State }) {
    console.debug('onRequestCacheUpdate');
    console.info(`state: ${state.toString()}`);
    console.info(`todos: ${todos}`);
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
        toggle.setValue(this.plugin.settings.proxy_enabled)
          .onChange(async (value) => {
            this.plugin.settings.proxy_enabled = value;
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
          .setValue(this.plugin.settings.proxy_protocol)
          .onChange(async (value) => {
            this.plugin.settings.proxy_protocol = value;
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
          .setValue(this.plugin.settings.proxy_host)
          .onChange(async (value) => {
            this.plugin.settings.proxy_host = value;
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
          .setValue(this.plugin.settings.proxy_port.toString())
          .onChange(async (value) => {
            const port = parseInt(value);
            if (!isNaN(port)) {
              this.plugin.settings.proxy_port = port;
              await this.plugin.saveSettings();
            }
          })
      )
      .controlEl.querySelector("input");

    // Hide or show the protocol type selector, address input, and port input based on whether the proxy is enabled
    this.toggleProxySettings(this.plugin.settings.proxy_enabled);

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