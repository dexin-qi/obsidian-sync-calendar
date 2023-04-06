import { App, MetadataCache, TAbstractFile, TFile, Vault } from 'obsidian';
import { Mutex } from 'async-mutex';

import type { CachedMetadata, EventRef } from 'obsidian';
import type { HeadingCache, ListItemCache, SectionCache } from 'obsidian';
import type { TodoDetails } from 'TodoSerialization';

// import { DateFallback } from './DateFallback';
// import { getSettings } from './Config/Settings';
// import { Lazy } from 'lib/Lazy';
import { Todo } from './Todo';
import type { TodosEvents } from './TodoEvents';

export enum State {
  Cold = 'Cold',
  Initializing = 'Initializing',
  Warm = 'Warm',
}

export class Cache {
  private readonly app: App;
  private readonly metadataCache: MetadataCache;
  private readonly metadataCacheEventReferences: EventRef[];
  private readonly vault: Vault;
  private readonly vaultEventReferences: EventRef[];
  private readonly events: TodosEvents;
  private readonly eventsEventReferences: EventRef[];

  private readonly todosMutex: Mutex;
  private state: State;
  private todos: Todo[];

  /**
   * We cannot know if this class will be instantiated because obsidian started
   * or because the plugin was activated later. This means we have to load the
   * whole vault once after the first metadata cache resolve to ensure that we
   * load the entire vault in case obsidian is starting up. In the case of
   * obsidian starting, the cache's initial load would end up with 0 todos,
   * as the metadata cache would still be empty.
   */
  private loadedAfterFirstResolve: boolean;

  constructor({ app, metadataCache, vault, events }: { app: App, metadataCache: MetadataCache; vault: Vault; events: TodosEvents }) {
    this.app = app;
    this.metadataCache = metadataCache;
    this.metadataCacheEventReferences = [];
    this.vault = vault;
    this.vaultEventReferences = [];
    this.events = events;
    this.eventsEventReferences = [];

    this.todosMutex = new Mutex();
    this.state = State.Cold;
    this.todos = [];

    this.loadedAfterFirstResolve = false;

    this.subscribeToCache();
    this.subscribeToVault();
    // this.subscribeToEvents();

    this.loadVault();
  }

  public unload(): void {
    for (const eventReference of this.metadataCacheEventReferences) {
      this.metadataCache.offref(eventReference);
    }

    for (const eventReference of this.vaultEventReferences) {
      this.vault.offref(eventReference);
    }

    for (const eventReference of this.eventsEventReferences) {
      this.events.off(eventReference);
    }
  }

  public getTodos(): Todo[] {
    return this.todos;
  }

  public getState(): State {
    return this.state;
  }

  private notifySubscribers(): void {
    this.events.triggerCacheUpdate({
      todos: this.todos,
      state: this.state,
    });
  }

  private subscribeToCache(): void {
    const resolvedEventeReference = this.metadataCache.on('resolved', async () => {
      // Resolved fires on every change.
      // We only want to initialize if we haven't already.
      if (!this.loadedAfterFirstResolve) {
        this.loadedAfterFirstResolve = true;
        this.loadVault();
      }
    });
    this.metadataCacheEventReferences.push(resolvedEventeReference);

    // // Does not fire when starting up obsidian and only works for changes.
    // const changedEventReference = this.metadataCache.on('changed', (file: TFile) => {
    //   this.todosMutex.runExclusive(() => {
    //     this.indexFile(file);
    //   });
    // });
    // this.metadataCacheEventReferences.push(changedEventReference);

    const changedEventDataviewReference =
      this.app.metadataCache.on("dataview:metadata-change", (type, file: TFile, oldPath?) => {
        console.log('dataview:metadata-change ${file.name}!');
        this.todosMutex.runExclusive(() => {
          this.indexFile(file);
        });
      });
    this.metadataCacheEventReferences.push(changedEventDataviewReference);
  }

  private subscribeToVault(): void {
    // const { useFilenameAsScheduledDate } = getSettings();

    const createdEventReference = this.vault.on('create', (file: TAbstractFile) => {
      if (!(file instanceof TFile)) {
        return;
      }

      console.log('[dexin] Created new file');
      // this.todosMutex.runExclusive(() => {
      //   this.indexFile(file);
      // });
    });
    this.vaultEventReferences.push(createdEventReference);

    const deletedEventReference = this.vault.on('delete', (file: TAbstractFile) => {
      if (!(file instanceof TFile)) {
        return;
      }

      console.log('[dexin] Delete new file');

      // this.todosMutex.runExclusive(() => {
      //   this.todos = this.todos.filter((todo: Todo) => {
      //     return todo.path !== file.path;
      //   });

      //   this.notifySubscribers();
      // });
    });
    this.vaultEventReferences.push(deletedEventReference);

    const renamedEventReference = this.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
      if (!(file instanceof TFile)) {
        return;
      }

      console.log('[dexin] Rename new file');
      // this.todosMutex.runExclusive(() => {
      //   this.todos = this.todos.map((todo: Todo): Todo => {
      //     if (todo.path === oldPath) {
      //       return new Todo({
      //         ...todo,
      //         taskLocation: task.taskLocation.fromRenamedFile(file.path),
      //       });
      //     } else {
      //       return todo;
      //     }
      //   });

      //   this.notifySubscribers();
      // });
    });
    this.vaultEventReferences.push(renamedEventReference);
  }

  private subscribeToEvents(): void {
    const requestReference = this.events.onRequestCacheUpdate((handler) => {
      handler({ todos: this.todos, state: this.state });
    });
    this.eventsEventReferences.push(requestReference);
  }

  private loadVault(): Promise<void> {
    console.log(this.vault.getMarkdownFiles());

    return this.todosMutex.runExclusive(async () => {
      this.state = State.Initializing;
      await Promise.all(
        this.vault.getMarkdownFiles().map((file: TFile) => {
          return this.indexFile(file);
        }),
      );
      this.state = State.Warm;
      // Notify that the cache is now warm:
      this.notifySubscribers();
    });
  }

  private async indexFile(file: TFile): Promise<void> {
    const fileCache = this.metadataCache.getFileCache(file);
    if (fileCache === null || fileCache === undefined) {
      return;
    }

    const oldTodos = this.todos.filter((todo: Todo) => {
      return todo.path === file.path;
    });
    console.log(`oldTodos: ${oldTodos}`);

    const listItems = fileCache.listItems;
    // When there is no list items cache, there are no todos.
    // Still continue to notify watchers of removal.

    let newTodos: Todo[] = [];
    if (listItems !== undefined) {
      // const dv = this.app.plugins.plugins.dataview.api;
      // const tasks = await dv.pages().file.tasks.where(task => { return !task.completed; }).where(task => { return task.text.match(/🛫+ \d{4}-\d{2}-\d{2}/u)?.index > 0; });

      // debugger;

      // if (newTasks === undefined || newTasks.length <= 0) {
      //   newTasks.values.forEach((task) => {
      //     const todo_details: TodoDetails = this.deserializer.deserialize(task.text);
      //     newTodos.push(new Todo({ ...todo_details, path: task.path }));
      //   }); // queried_tasks <for each>
      // }

      // console.log(newTodos);
    }

    // If there are no changes in any of the todos, there's
    // nothing to do, so just return.
    if (Todo.todosListsIdentical(oldTodos, newTodos)) {
      // This code kept for now, to allow for debugging during development.
      // It is too verbose to release to users.
      // if (this.getState() == State.Warm) {
      //     console.debug(`Todos unchanged in ${file.path}`);
      // }
      return;
    }

    if (this.getState() == State.Warm) {
      console.debug(
        `At least one todo, its line number or its heading has changed in ${file.path}: triggering a refresh of all active Todos blocks in Live Preview and Reading mode views.`,
      );
    }

    // Remove all todos from this file from the cache before
    // adding the ones that are currently in the file.
    this.todos = this.todos.filter((todo: Todo) => {
      return todo.path !== file.path;
    });

    this.todos.push(...newTodos);

    // All updated, inform our subscribers.
    this.notifySubscribers();
  }

  private getTodosFromFileContent(
    fileContent: string,
    listItems: ListItemCache[],
    fileCache: CachedMetadata,
    file: TFile,
  ): Todo[] {
    const todos: Todo[] = [];
    //     const fileLines = fileContent.split('\n');
    //     const linesInFile = fileLines.length;

    //     // Lazily store date extracted from filename to avoid parsing more than needed
    //     // console.debug(`getTodosFromFileContent() reading ${file.path}`);
    //     // const dateFromFileName = new Lazy(() => DateFallback.fromPath(file.path));

    //     // We want to store section information with every todo so
    //     // that we can use that when we post process the markdown
    //     // rendered lists.
    //     let currentSection: SectionCache | null = null;
    //     let sectionIndex = 0;
    //     for (const listItem of listItems) {
    //       if (listItem.todo !== undefined) {
    //         const lineNumber = listItem.position.start.line;
    //         if (lineNumber >= linesInFile) {
    //           /*
    //               Obsidian CachedMetadata has told us that there is a todo on lineNumber, but there are
    //               not that many lines in the file.

    //               This was the underlying cause of all the 'Stuck on "Loading Todos..."' messages,
    //               as it resulted in the line 'undefined' being parsed.

    //               Somehow the file had been shortened whilst Obsidian was closed, meaning that
    //               when Obsidian started up, it got the new file content, but still had the old cached
    //               data about locations of list items in the file.
    //            */
    //           console.log(
    //             `${file.path} Obsidian gave us a line number ${lineNumber} past the end of the file. ${linesInFile}.`,
    //           );
    //           return todos;
    //         }
    //         if (currentSection === null || currentSection.position.end.line < lineNumber) {
    //           // We went past the current section (or this is the first todo).
    //           // Find the section that is relevant for this todo and the following of the same section.
    //           currentSection = Cache.getSection(lineNumber, fileCache.sections);
    //           sectionIndex = 0;
    //         }

    //         if (currentSection === null) {
    //           // Cannot process a todo without a section.
    //           continue;
    //         }

    //         const line = fileLines[lineNumber];
    //         if (line === undefined) {
    //           console.log(`${file.path}: line ${lineNumber} - ignoring 'undefined' line.`);
    //           continue;
    //         }

    //         let todo;
    //         try {
    //           todo = Todo.fromLine({
    //             line,
    //             taskLocation: new TaskLocation(
    //               file.path,
    //               lineNumber,
    //               currentSection.position.start.line,
    //               sectionIndex,
    //               Cache.getPrecedingHeader(lineNumber, fileCache.headings),
    //             ),
    //             fallbackDate: dateFromFileName.value,
    //           });
    //         } catch (e) {
    //           this.reportTodoParsingErrorToUser(e, file, listItem, line);
    //           continue;
    //         }

    //         if (todo !== null) {
    //           sectionIndex++;
    //           todos.push(todo);
    //         }
    //       }
    //     }

    return todos;
  }

  //   private reportTodoParsingErrorToUser(e: any, file: TFile, listItem: ListItemCache, line: string) {
  //     const msg = `There was an error reading one of the todos in this vault.
  // The following todo has been ignored, to prevent Todos queries getting stuck with 'Loading Todos ...'
  // Error: ${e}
  // File: ${file.path}
  // Line number: ${listItem.position.start.line}
  // Todo line: ${line}

  // Please create a bug report for this message at
  // https://github.com/ /issues/new/choose
  // to help us find and fix the underlying issue.

  // Include:
  // - either a screenshot of the error popup, or copy the text from the console, if on a desktop machine.
  // - the output from running the Obsidian command 'Show debug info'

  // The error popup will only be shown when Todos is starting up, but if the error persists,
  // it will be shown in the console every time this file is edited during the Obsidian
  // session.
  // `;
  //     console.error(msg);
  //     if (e instanceof Error) {
  //       console.error(e.stack);
  //     }
  //     if (this.state === State.Initializing) {
  //       new Notice(msg, 10000);
  //     }
  //   }

  //   private static getSection(lineNumberTodo: number, sections: SectionCache[] | undefined): SectionCache | null {
  //     if (sections === undefined) {
  //       return null;
  //     }

  //     for (const section of sections) {
  //       if (section.position.start.line <= lineNumberTodo && section.position.end.line >= lineNumberTodo) {
  //         return section;
  //       }
  //     }

  //     return null;
  //   }

  //   private static getPrecedingHeader(lineNumberTodo: number, headings: HeadingCache[] | undefined): string | null {
  //     if (headings === undefined) {
  //       return null;
  //     }

  //     let precedingHeader: string | null = null;

  //     for (const heading of headings) {
  //       if (heading.position.start.line > lineNumberTodo) {
  //         return precedingHeader;
  //       }
  //       precedingHeader = heading.heading;
  //     }
  //     return precedingHeader;
  //   }
}
