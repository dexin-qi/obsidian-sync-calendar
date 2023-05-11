import axios from 'axios';

import { App, type PluginManifest, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

import { SyncStatus, NetworkStatus } from 'Syncs/StatusEnumerate';
import { gfSyncStatus$, gfNetStatus$ } from 'Syncs/StatusEnumerate';
import { MainSynchronizer } from "Syncs/MainSynchronizer";
import QueryInjector from 'Injector/QueryInjector';
import { setDebugLogging, debug } from 'lib/DebugLog';


// Remember to rename these classes and interfaces!

interface SyncCalendarPluginSettings {
  fetchWeeksAgo: number;
  fetchMaximumEvents: number;

  renderDate: boolean;
  renderTags: boolean;

  enableLogging: boolean;
}

const DEFAULT_SETTINGS: SyncCalendarPluginSettings = {
  fetchWeeksAgo: 4,
  fetchMaximumEvents: 2000,

  renderDate: true,
  renderTags: true,

  enableLogging: false,
}


export default class SyncCalendarPlugin extends Plugin {
  public settings: SyncCalendarPluginSettings;

  public syncStatusItem: HTMLElement;

  public netStatus: NetworkStatus;
  public netStatusItem: HTMLElement;

  private mainSync: MainSynchronizer;

  private queryInjector: QueryInjector;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);
  }

  async onload() {
    await this.loadSettings();
    setDebugLogging(this.settings.enableLogging);

    this.addSettingTab(new SyncCalendarPluginSettingTab(this.app, this));

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    this.netStatusItem = this.addStatusBarItem();
    this.syncStatusItem = this.addStatusBarItem();

    gfNetStatus$.subscribe(newNetStatus => this.updateNetStatusItem(newNetStatus));
    gfSyncStatus$.subscribe(newSyncStatus => this.updateSyncStatusItem(newSyncStatus));

    this.mainSync = new MainSynchronizer(this.app);

    this.queryInjector = new QueryInjector(this);
    this.queryInjector.setMainSync(this.mainSync);

    this.registerMarkdownCodeBlockProcessor("sync-calendar",
      this.queryInjector.onNewBlock.bind(this.queryInjector)
    );

    // Add Ribbons
    const ribbonIconEl = this.addRibbonIcon(
      'sync',
      'Sync With Calendar',
      async (evt: MouseEvent) => {
        const keyMoment = window.moment().startOf('day');
        const Ago = window.moment.duration(this.settings.fetchWeeksAgo, 'week');
        this.mainSync.pushTodosToCalendar(
          keyMoment.subtract(Ago),
          this.settings.fetchMaximumEvents,
          'mannual'
        );
      });
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // Add Commands
    this.addCommand({
      id: 'sync-with-calendar',
      name: 'Sync With Calendar',
      callback: async () => {
        const keyMoment = window.moment().startOf('day');
        const Ago = window.moment.duration(this.settings.fetchWeeksAgo, 'week');
        this.mainSync.pushTodosToCalendar(
          keyMoment.subtract(Ago),
          this.settings.fetchMaximumEvents,
          'mannual'
        );
      }
    });

  }

  onunload() { }

  private updateNetStatusItem(newNetStatus: NetworkStatus) {
    switch (newNetStatus) {
      case NetworkStatus.HEALTH:
        this.netStatusItem.setText("Net: 🟢");
        break;
      case NetworkStatus.CONNECTION_ERROR:
        this.netStatusItem.setText("Net: 🔴");
        break;
      case NetworkStatus.UNKOWN:
      default:
        this.netStatusItem.setText("Net: ⚫️");
        break;
    }
  }

  private updateSyncStatusItem(newSyncStatus: SyncStatus) {
    switch (newSyncStatus) {
      case SyncStatus.UPLOAD:
        this.syncStatusItem.setText("Sync: 🔼");
        break;
      case SyncStatus.DOWNLOAD:
        this.syncStatusItem.setText("Sync: 🔽");
        break;
      case SyncStatus.FAILED_WARNING:
        this.syncStatusItem.setText("Sync: 🆖");
        break;
      case SyncStatus.SUCCESS_WAITING:
        this.syncStatusItem.setText("Sync: 🆗");
        break;
      case SyncStatus.UNKOWN:
      default:
        this.syncStatusItem.setText("Sync: *️⃣");
        break;
    }
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
      "Fetch Settings",
      "Options on events fetching."
    );

    new Setting(containerEl)
      .setName("Weeks Ago")
      .setDesc("Enter weeks from the earliest task to now for this plugin to consider.")
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
      "Options on events rendering."
    );

    new Setting(containerEl)
      .setName("Render Date")
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.renderDate)
          .onChange(async (value) => {
            this.plugin.settings.renderDate = value;
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
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    this.createHeader(
      "Debug Settings",
      "Some debug settings"
    );

    // Debug logging enabled checkbox
    new Setting(containerEl)
      .setName("Enable Logging")
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableLogging)
          .onChange(async (value) => {
            this.plugin.settings.enableLogging = value;
            setDebugLogging(value);
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");
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
