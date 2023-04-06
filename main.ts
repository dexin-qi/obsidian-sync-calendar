import { App, type PluginManifest, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { Todo } from 'TodoSerialization/Todo';
import { TodosEvents } from 'TodoSerialization/TodoEvents';
import { Cache, State } from 'TodoSerialization/Cache';
import GoogleCalendarSync from 'Syncs/GoogleCalendarSync'
import ObsidianTasksSync from 'Syncs/ObsidianTasksSync';
import QueryInjector from 'Injector/QueryInjector';
// import SyncResultModal from './Modals/syncResult'

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  mySetting: 'default'
}

export default class MyPlugin extends Plugin {
  public settings: MyPluginSettings;

  private cache: Cache | undefined;
  private calendarSync: GoogleCalendarSync;
  private obsidianSync: ObsidianTasksSync;

  private queryInjector: QueryInjector;

  constructor(app: App, pluginManifest: PluginManifest) {
    super(app, pluginManifest);

    this.queryInjector = new QueryInjector(app);
  }

  async onload() {

    this.registerMarkdownCodeBlockProcessor("calendar-sync",
      this.queryInjector.onNewBlock.bind(this.queryInjector)
    );

    await this.loadSettings();
    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SampleSettingTab(this.app, this));

    const events = new TodosEvents({ obsidianEvents: this.app.workspace });
    this.cache = new Cache({
      app: this.app,
      metadataCache: this.app.metadataCache,
      vault: this.app.vault,
      events,
    });

    // this.app.plugins..registerEvent(plugin.app.metadataCache.on("dataview:metadata-change",
    // ));

    // this.app.workspace.trigger("dataview:index-ready", () => {
    //   console.log("!!! Dateview is ready, dexin has receive callback!!!");
    // });

    // // This creates an icon in the left ribbon.
    // const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
    //   // Called when the user clicks the icon.
    //   new Notice('This is a notice!');
    // });
    // // Perform additional things with the ribbon
    // ribbonIconEl.addClass('my-plugin-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('Status Bar Text');

    this.calendarSync = new GoogleCalendarSync(this.app.vault);
    this.obsidianSync = new ObsidianTasksSync(this.app);

    this.queryInjector.setCalendarSync(this.calendarSync);

    this.addCommand({
      id: 'sync-with-calendar',
      name: 'Sync With Calendar',
      callback: async () => {
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

        // new SyncResultModal(this.app, eventDescs).open();
        new Notice(eventDescs.join('\n'));
      }
    });

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


    // // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // // Using this function will automatically remove the event listener when this plugin is disabled.
    // this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
    //   console.log('click', evt);
    // });

    // // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  onunload() {

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
