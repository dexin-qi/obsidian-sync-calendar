import { App, TFile, Notice } from "obsidian";

import moment from "moment";
import crypto from "crypto";

import { DEFAULT_SYMBOLS } from "TodoSerialization/DefaultSerialization";
import { DefaultTodoSerializer, type TodoDetails } from "TodoSerialization";
import { Todo } from "TodoSerialization/Todo";
import { Mutex } from 'async-mutex';

export default class ObsidianTasksSync {
  app: App;
  deserializer: DefaultTodoSerializer;

  private readonly fileMutex: Mutex;

  constructor(app: App) {
    this.deserializer = new DefaultTodoSerializer(DEFAULT_SYMBOLS);
    this.app = app;
    this.fileMutex = new Mutex();
  }

  public updateTodos(obsidianTodos: Todo[], calendarTodos: Todo[]): void | Error {
    // Obsidian 只负责创建和销毁任务，tasks + reminder
    // 可以先使用 block_id 
    // TODO: settings: 让 id 隐身

    let obsidianTodosMap = new Map<string, Todo>();
    obsidianTodos.forEach((todo: Todo) => {
      if (todo.blockId) {
        obsidianTodosMap.set(todo.blockId, todo);
      }
    });

    calendarTodos.forEach(async (todo: Todo) => {
      if (!todo.blockId) {
        console.error("Unknown update todo's blockId: " + todo.blockId);
        return;
      }

      let ob_todo = obsidianTodosMap.get(todo.blockId);
      if (!ob_todo) {
        console.error("obsidianTodosMap not contains: " + todo.blockId);
        return;
      }

      ob_todo.updateFrom(todo);
      // debugger
      if (!ob_todo.path || !ob_todo.blockId) {
        console.error("Cannot find file for updated todo: " + todo.content);
        return;
      }

      const file = this.app.vault.getAbstractFileByPath(ob_todo.path);
      if (!(file instanceof TFile)) {
        new Notice(`Calendar-Sync: No file found for todo ${ob_todo.content}. Retrying ...`);
        return Error(`No file found for task ${ob_todo.content}`);
      }

      this.fileMutex.runExclusive(async () => {
        const fileContent = await self.app.vault.read(file);
        const fileLines = fileContent.split('\n');

        let targetLine: number | undefined = undefined;
        let targetLinePrefix: string | undefined = undefined;
        fileLines.forEach((line, line_index) => {
          let index = line.indexOf(ob_todo.blockId);
          if (index > -1) {
            targetLine = line_index;
            let matchResult = line.match(/.*- \[.\] /);
            if (matchResult) {
              targetLinePrefix = matchResult[0];
            }
          }
        });
        if (targetLine === undefined) {
          console.error("Cannot find line for updated todo: " + todo.content);
          return;
        }

        let updateLine = targetLinePrefix + this.deserializer.serialize(ob_todo);

        const updatedFileLines: string[] = [
          ...fileLines.slice(0, targetLine),
          updateLine,
          ...fileLines.slice(targetLine + 1),
        ];

        // console.log(updatedFileLines.join("\n"));

        self.app.vault.modify(file, updatedFileLines.join('\n'));
      });

    });
  }

  public fetchTodos(): Todo[] | Error {
    let ob_todos: Todo[] = [];

    try {
      const dv = this.app.plugins.plugins.dataview.api;
      const queried_tasks = dv.pages().file.tasks
        .where(task => {
          return !task.completed;
        })
        .where(task => {
          return task.text.match(/🛫+ \d{4}-\d{2}-\d{2}/u)?.index > 0;
        });

      queried_tasks.values.forEach(async (task) => {
        //  对抓取到的 tasks，没有指定 blockId 需要创建 hashed blockId。
        if (!(task.blockId?.length > 0)) {
          const hash = crypto.createHash("sha256").update(task.text).digest();
          let shorternTaskHash = parseInt(hash.toString("hex").slice(0, 16), 16).toString(36).toUpperCase();
          // TODO: 判断重复性 task id 的重复性
          shorternTaskHash = shorternTaskHash.padStart(8, "0");

          this.fileMutex.runExclusive(async () => {
            const file = this.app.vault.getAbstractFileByPath(task.path);
            if (!(file instanceof TFile)) {
              new Notice(`Calendar-Sync: No file found for task ${task.text}. Retrying ...`);
              return Error(`No file found for task ${task.text}`);
            }

            // TODO: 替换为 vault.process
            const fileContent = await self.app.vault.read(file);
            const fileLines = fileContent.split('\n');

            const updatedFileLines = [
              ...fileLines.slice(0, task.position.start.line),
              `${fileLines[task.position.start.line]} ^${shorternTaskHash}`,
              ...fileLines.slice(task.position.start.line + 1),
            ];

            await self.app.vault.modify(file, updatedFileLines.join('\n'));

          }); // file modification mutex.

          const todo_details: TodoDetails = this.deserializer.deserialize(`${task.text} ^${shorternTaskHash}`);
          ob_todos.push(new Todo({ ...todo_details, path: task.path }));
        } else {
          const todo_details: TodoDetails = this.deserializer.deserialize(task.text);
          ob_todos.push(new Todo({ ...todo_details, path: task.path }));
        }
      }); // queried_tasks <for each>
    } catch (e) {
      return Error(`Calendar-Sync: fetch obsidian todos: ${e}`);
    }

    return ob_todos;
  }
}
