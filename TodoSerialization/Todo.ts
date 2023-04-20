import type { Moment } from 'moment';
import { compareByDate } from "lib/DateTools";

export class Todo {
  public content: null | string | undefined;

  public priority?: null | string | undefined;
  public tags?: string[] | undefined;

  public startDateTime: null | string | undefined;
  public scheduledDateTime?: null | string | undefined;
  public dueDateTime?: null | string | undefined;

  public children?: Todo[] | undefined;

  public calUId?: null | string | undefined;
  public eventId?: null | string | undefined;
  public eventStatus?: null | string | undefined;
  public eventHtmlLink?: null | string | undefined;

  public path?: string | undefined;
  public blockId?: null | string | undefined;

  public updated?: null | string | undefined;

  constructor({
    content,
    priority,
    tags,
    startDateTime,
    scheduledDateTime,
    dueDateTime,
    children,
    path,
    blockId,
    eventStatus,
    updated,
    calUId,
    eventId,
    eventHtmlLink
  }: {
    content: null | string | undefined;
    priority?: null | string | undefined;
    tags?: string[] | undefined;
    startDateTime: null | string | undefined;
    scheduledDateTime?: null | string | undefined;
    dueDateTime?: null | string | undefined;
    children?: Todo[] | undefined;
    path?: string | undefined;
    blockId?: null | string | undefined;
    eventStatus?: null | string | undefined;
    updated?: null | string | undefined;
    calUId?: null | string | undefined;
    eventId?: null | string | undefined;
    eventHtmlLink?: null | string | undefined;
  }) {
    this.content = content;

    this.priority = priority;
    this.tags = tags;
    this.startDateTime = startDateTime;
    this.scheduledDateTime = scheduledDateTime;
    this.dueDateTime = dueDateTime;

    this.children = children;

    this.path = path;
    this.blockId = blockId;
    this.eventStatus = eventStatus;

    this.calUId = calUId;
    this.eventId = eventId;
    this.eventHtmlLink = eventHtmlLink;

    this.updated = updated;
  }

  public updateFrom(todo: Todo) {
    if (todo.content) { this.content = todo.content; }
    if (todo.priority) { this.priority = todo.priority; }
    if (todo.tags) { this.tags = todo.tags; }
    if (todo.startDateTime) { this.startDateTime = todo.startDateTime; }
    if (todo.scheduledDateTime) { this.scheduledDateTime = todo.scheduledDateTime; }
    if (todo.dueDateTime) { this.dueDateTime = todo.dueDateTime; }
    if (todo.children) { this.children = todo.children; }
    if (todo.path) { this.path = todo.path; }
    if (todo.blockId) { this.blockId = todo.blockId; }
    if (todo.eventStatus) { this.eventStatus = todo.eventStatus; }
    if (todo.calUId) { this.calUId = todo.calUId; }
    if (todo.eventHtmlLink) { this.eventHtmlLink = todo.eventHtmlLink; }
    if (todo.eventId) { this.eventId = todo.eventId; }
    if (todo.updated) { this.updated = todo.updated; }
  }

  public serializeDescription(): string {
    return JSON.stringify({
      eventStatus: this.eventStatus ? this.eventStatus : 'todo',
      blockId: this.blockId,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public isOverdue(): boolean {
    if (this.dueDateTime) {
      if (Todo.isDatetime(this.dueDateTime)) {
        return window.moment().isAfter(this.dueDateTime);
      } else {
        return window.moment().startOf('day').isAfter(this.dueDateTime);
      }
    }
    return false;
  }

  static isDatetime(datatimeString: string): boolean {
    const regDateTime = /(\d{4}-\d{2}-\d{2}T)/u;
    return datatimeString.match(regDateTime) !== null;
  }

  static momentString(momentString: string, emoji: '🛫' | '⌛' | '🗓'): string {
    if (Todo.isDatetime(momentString)) {
      return `${emoji} ${window.moment(momentString).format("YYYY-MM-DD[@]HH:mm")}`;
    }
    return `${emoji} ${momentString}`;
  }

  static todosListsIdentical(oldTasks: Todo[], newTodos: Todo[]): boolean {
    if (oldTasks.length !== newTodos.length) {
      return false;
    }
    return oldTasks.every((oldTodos, index) => oldTodos.identicalTo(newTodos[index]));
  }

  public identicalTo(other: Todo) {
    let args: Array<keyof Todo> = [
      'content',
      'priority',
      'tags',
      'calUId',
      'eventId',
      'path',
      'blockId',
      'updated',
    ];
    for (const el of args) {
      if (this[el] !== other[el]) return false;
    }

    // Compare tags
    if (this.tags === undefined && other.tags !== undefined) {
      return false;
    }
    if (other.tags === undefined && this.tags !== undefined) {
      return false;
    }
    if (this.tags?.length !== other.tags?.length) {
      return false;
    }
    // Tags are the same only if the values are in the same order
    if (
      !this.tags.every(function (element, index) {
        return element === other.tags[index];
      })
    ) {
      return false;
    }

    // Compare Date fields
    args = ['startDateTime', 'scheduledDateTime', 'dueDateTime'];
    for (const el of args) {
      const date1 = this[el] as Moment | null;
      const date2 = other[el] as Moment | null;
      if (compareByDate(date1, date2) !== 0) {
        return false;
      }
    }

    return true;
  }
}