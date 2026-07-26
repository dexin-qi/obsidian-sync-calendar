import { App, type PluginManifest, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';

import { SyncStatus, NetworkStatus } from 'Syncs/StatusEnumerate';
import { gfSyncStatus$, gfNetStatus$ } from 'Syncs/StatusEnumerate';
import { MainSynchronizer } from "Syncs/MainSynchronizer";
import QueryInjector from 'Injector/QueryInjector';
import { setDebugLogging } from 'lib/DebugLog';


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

    // Add Ribbon - a single button that runs the full sync pipeline.
    const ribbonIconEl = this.addRibbonIcon(
      'sync',
      'Sync Google Calendar',
      async (evt: MouseEvent) => {
        await this.runFullSync();
      });
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // Add Command - same single full-sync entry point.
    this.addCommand({
      id: 'sync-google-calendar',
      name: 'Sync Google Calendar',
      callback: async () => {
        await this.runFullSync();
      }
    });

  }

  /**
   * Single entry point for a full sync, triggered by the sync ribbon/command.
   * Runs in order:
   *   1. Push eligible Obsidian tasks up to Google Calendar (this also fills
   *      undated tasks inside gcal managed blocks with today's date first).
   *   2. Materialize this week's Google Calendar events back into the weekly note's
   *      managed block (creating the weekly note if it does not exist).
   */
  private async runFullSync(): Promise<void> {
    const keyMoment = window.moment().startOf('day');
    const Ago = window.moment.duration(this.settings.fetchWeeksAgo, 'week');
    try {
      await this.mainSync.pushTodosToCalendar(
        keyMoment.clone().subtract(Ago),
        this.settings.fetchMaximumEvents,
        'mannual'
      );
    } catch (e: any) {
      new Notice(`sync-calendar: push failed - ${e && e.message ? e.message : e}`);
    }
    try {
      await this.mainSync.syncWeekToNote();
    } catch (e: any) {
      new Notice(`sync-calendar: weekly sync failed - ${e && e.message ? e.message : e}`);
    }
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

    this.createHeader("Fetch");

    new Setting(containerEl)
      .setName("Weeks ago")
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
      .setName("Maximum events")
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

    this.createHeader("Render");

    new Setting(containerEl)
      .setName("Render date")
      .setDesc("Whether date should be rendered with google events.")
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.renderDate)
          .onChange(async (value) => {
            this.plugin.settings.renderDate = value;
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    new Setting(containerEl)
      .setName("Render tags")
      .setDesc("Whether tags should be rendered with google events.")
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.renderTags)
          .onChange(async (value) => {
            this.plugin.settings.renderTags = value;
            await this.plugin.saveSettings();
          })
      )
      .controlEl.querySelector("input");

    this.createHeader("Debug");

    // Debug logging enabled checkbox
    new Setting(containerEl)
      .setName("Enable logging")
      .setDesc("Enable debug logging might help to locate synchronization issues.")
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
