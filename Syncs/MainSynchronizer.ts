import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";

import type { Todo } from "TodoSerialization/Todo";
import { debug } from 'lib/DebugLog';
import { GoogleCalendarSync } from './GoogleCalendarSync'
import { ObsidianTasksSync } from './ObsidianTasksSync';

/**
 * MainSynchronizer class for syncing tasks between Obsidian and Google Calendar
 */
export class MainSynchronizer {
  // Create a member variable called "app" of type "App" and initialize it in the constructor
  private app: App;
  private calendarSync: GoogleCalendarSync;
  private obsidianSync: ObsidianTasksSync;

  /**
   * Constructor for MainSynchronizer class
   * @param app - The Obsidian App object
   */
  constructor(app: App) {
    this.app = app;
    this.calendarSync = new GoogleCalendarSync(this.app);
    this.obsidianSync = new ObsidianTasksSync(this.app);
  }

  /**
   * Check if the synchronizer is ready
   * @returns A promise that resolves to a boolean indicating if the synchronizer is ready
   */
  public isReady(): Promise<boolean> {
    return this.calendarSync.isReady();
  }

  /**
   * Push todos to Google Calendar
   * @param startMoment - The start moment for the sync
   * @param maxResults - The maximum number of results to retrieve
   * @param triggeredBy - The trigger for the sync
   */
  public async pushTodosToCalendar(
    startMoment: moment.Moment,
    maxResults: number = 200,
    triggeredBy: 'auto' | 'mannual' = 'auto'
  ) {
    debug(`push Todos: startMoment=${startMoment}`);

    // 0. fill any undated tasks inside gcal managed blocks with today's date first,
    //    so they become pushable in this same run.
    try {
      await this.fillUndatedTasksInManagedBlocks();
    } catch (e) {
      debug(`fillUndatedTasksInManagedBlocks failed: ${e}`);
    }

    // 1. list all tasks in Obsidian (awaited: listTasks is async and stamps blockIds)
    let obTasks: Todo[];
    try {
      obTasks = await this.obsidianSync.listTasks(startMoment, triggeredBy);
    } catch (e) {
      debug(`listTasks threw: ${e}`);
      return;
    }

    // 2. list events in Calendar
    const clEvents = await this.calendarSync.listEvents(startMoment, maxResults);

    // 3. push new events to Calendar
    let clBlockId2Event = new Map<string, Todo>();
    clEvents.forEach((event: Todo) => {
      if (event.blockId && event.blockId.length > 0) {
        clBlockId2Event.set(event.blockId, event);
      }
    });

    // Await each insert/patch (NOT fire-and-forget map) and guard each so one
    // failure does not abort the rest of the batch.
    for (const task of obTasks) {
      if (!task.blockId || task.blockId.length === 0) {
        debug(`Skip task without blockId: ${task.content}`);
        continue;
      }
      try {
        if (clBlockId2Event.has(task.blockId)) {
          const event = clBlockId2Event.get(task.blockId);
          if (!event || event.eventStatus === task.eventStatus || task.eventStatus === ' ') {
            continue;
          }
          // Obsidian --{m}-> Calendar : patch event
          await this.calendarSync.patchEvent(task, GoogleCalendarSync.getEventDonePatch);
        } else {
          // Obsidian --{+}-> Calendar : insert event
          await this.calendarSync.insertEvent(task);
        }
      } catch (err) {
        debug(`Failed to sync task ${task.content} to calendar: ${err}`);
      }
    }
  }

  /**
   * Pull todos from Google Calendar
   * @param startMoment - The start moment for the sync
   * @param maxResults - The maximum number of results to retrieve
   * @returns A promise that resolves to an array of todos
   */
  public async pullTodosFromCalendar(
    startMoment: moment.Moment,
    maxResults: number = 200): Promise<Todo[]> {

    // 1. list events in Calendar
    const clEvents = await this.calendarSync.listEvents(startMoment, maxResults);

    // 2. list Obsidian tasks
    const obTasks = await this.obsidianSync.listTasks(startMoment);

    // 3. update Obsidan tasks
    let obBlockId2Task = new Map<string, Todo>();
    obTasks.forEach((task: Todo) => {
      if (task.blockId && task.blockId.length > 0) {
        obBlockId2Task.set(task.blockId, task);
      }
    });
    // - none blockId: -> 由 Calendar 创建的任务
    // - have blockId
    //    - calendar 比 obsidian 多的那些任务: Obsidian 中删掉的任务
    //    - calendar 和 obsidian 同步的任务
    let todosCalendarCreate: Todo[] = [];
    clEvents.forEach((event: Todo) => {
      if (!event.blockId || event.blockId.length === 0) {
        todosCalendarCreate.push(event);
        return;
      }
      if (!obBlockId2Task.has(event.blockId)) {
        return;
      }

      // Calendar -[m]-> Obsidian
      let task = obBlockId2Task.get(event.blockId);

      if (!task || !task.path || !task.blockId) {
        debug(`Cannot find file/blockId for updated todo: $ {event.content}`);
        throw Error(`Cannot find file/blockId for updated todo: $ {event.content}`);
      }

      // Fully updated from calendars(only exclude blockId...)
      task.updateFrom(event);
      this.obsidianSync.updateTodo(task);
    });

    const clTodos = clEvents
      .filter((todo) => {
        if (!todo.eventStatus) {
          return true;
        }
        return todo.eventStatus !== "x" && todo.eventStatus !== "X";
      });

    clTodos.forEach((todo) => {
      if (!todo.blockId || !obBlockId2Task.has(todo.blockId)) {
        return;
      }
      todo.path = obBlockId2Task.get(todo.blockId)!.path;
    });

    return clTodos;
  }

/**
   * Delete a todo from Google Calendar and Obsidian
   * @param todo - The todo to delete
   */
  public async deleteTodo(todo: Todo): Promise<void> {
    await this.obsidianSync.deleteTodo(todo)
      .catch((err) => { throw err; });
    await this.calendarSync.deleteEvent(todo)
      .catch((err) => { throw err; });
  }

  /**
   * Insert a todo to Google Calendar
   * @param todo - The todo to insert
   */
  public async insertTodo(todo: Todo): Promise<void> {
    await this.calendarSync.insertEvent(todo)
      .catch((err) => { throw err; });
  }

  /**
   * Patch a todo to done in both Google Calendar and Obsidian
   * @param todo - The todo to patch
   */
  public async patchTodoToDone(todo: Todo): Promise<void> {
    todo.eventStatus = 'x';

    // Only write back to a note when this todo actually has a local task line.
    // Events that originated in Google Calendar have no path/blockId, so trying
    // to write them back used to throw "invalid path or blockId".
    if (todo.path && todo.blockId) {
      await this.obsidianSync.patchTodo(todo, ObsidianTasksSync.getStatusDonePatch)
        .catch((err) => { debug(`Skipping note write-back for ${todo.content}: ${err}`); });
    } else {
      debug(`Calendar-sourced todo ${todo.content} has no local task line; skipping note write-back.`);
    }

    if (todo.eventId) {
      await this.calendarSync.patchEvent(todo, GoogleCalendarSync.getEventDonePatch)
        .catch((err) => { debug(`Failed to patch event ${todo.content} in Google Calendar: ${err}`); });
    }
  }

  /**
   * Format a Todo date (as produced by Todo.fromGoogleEvent) into the task-line
   * marker format. Timed values (contain a 'T') -> "YYYY-MM-DD@HH:mm"; all-day
   * values -> "YYYY-MM-DD".
   */
  public static formatEventDate(value: string): string {
    const m = window.moment(value);
    if (typeof value === 'string' && value.indexOf('T') > -1) {
      return m.format('YYYY-MM-DD@HH:mm');
    }
    return m.format('YYYY-MM-DD');
  }

  /**
   * For every note containing a gcal managed block, find task lines INSIDE the
   * block that have no date marker and append today's date (rewriting the line).
   * Tasks outside managed blocks are never touched. Idempotent: a task that
   * already has any date (🛫/📅/⏳ or a bare trailing date) is left alone.
   */
  public async fillUndatedTasksInManagedBlocks(): Promise<void> {
    const todayStr = window.moment().startOf('day').format('YYYY-MM-DD');
    const endMarker = '<!-- gcal:end -->';
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      let content: string;
      try {
        content = await this.app.vault.read(file);
      } catch (e) {
        continue;
      }
      if (content.indexOf('<!-- gcal:begin') === -1) { continue; }

      const lines = content.split('\n');
      let inBlock = false;
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('<!-- gcal:begin')) { inBlock = true; continue; }
        if (trimmed === endMarker) { inBlock = false; continue; }
        if (!inBlock) { continue; }

        const taskMatch = lines[i].match(/^(\s*- \[.\] )(.*)$/u);
        if (!taskMatch) { continue; }
        let body = taskMatch[2];
        const bodyNoBlockId = body.replace(/\s*\^[0-9a-zA-Z]+\s*$/u, '').trim();
        const hasDate = /🛫|📅|📆|🗓|⏳|⌛/u.test(bodyNoBlockId)
          || /(\d{4}-\d{2}-\d{2})(?:@\d{1,2}:\d{2})?$/u.test(bodyNoBlockId);
        if (hasDate) { continue; }

        const blockIdMatch = body.match(/(\s*\^[0-9a-zA-Z]+)\s*$/u);
        if (blockIdMatch) {
          const bid = blockIdMatch[1];
          const beforeBid = body.slice(0, body.length - bid.length).replace(/\s+$/u, '');
          lines[i] = `${taskMatch[1]}${beforeBid} 🛫 ${todayStr}${bid}`;
        } else {
          lines[i] = `${taskMatch[1]}${body.replace(/\s+$/u, '')} 🛫 ${todayStr}`;
        }
        changed = true;
      }
      if (changed) {
        await this.app.vault.modify(file, lines.join('\n'));
      }
    }
  }

  /**
   * Materialize the current week's Google Calendar events into a weekly note.
   * - Computes the current week (Sunday->Saturday, clipped to the month) from today.
   * - Ensures the weekly note exists under Task/ (vault-relative), creating it if missing.
   * - Writes events as task lines into a marker-delimited managed block, PRESERVING
   *   any local in-block task not yet round-tripped to Google (no data loss).
   */
  public async syncWeekToNote(): Promise<void> {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const today = window.moment().startOf('day');
    const year = today.year();
    const monthIdx = today.month();
    const monthNum = String(monthIdx + 1).padStart(2, '0');
    const monthName = MONTHS[monthIdx];
    const daysInMonth = today.clone().endOf('month').date();
    const todayDay = today.date();

    // Sunday->Saturday weeks, clipped to the month, numbered W1.. within the month.
    let cursor = 1;
    let weekNo = 0;
    let rangeStart = 1;
    let rangeEnd = daysInMonth;
    while (cursor <= daysInMonth) {
      weekNo += 1;
      const startDay = cursor;
      const startDow = window.moment({ year, month: monthIdx, day: startDay } as any).day();
      let endDay = startDay + (6 - startDow);
      if (endDay > daysInMonth) { endDay = daysInMonth; }
      if (todayDay >= startDay && todayDay <= endDay) {
        rangeStart = startDay;
        rangeEnd = endDay;
        break;
      }
      cursor = endDay + 1;
    }

    const fileName = `${year}-${monthNum}-W${weekNo}-${rangeStart}-${rangeEnd}-${monthName}.md`;
    const filePath = `Task/${fileName}`;
    const startISO = `${year}-${monthNum}-${String(rangeStart).padStart(2, '0')}`;
    const endMoment = window.moment({ year, month: monthIdx, day: rangeEnd } as any).add(1, 'day');
    const timeMin = window.moment(`${startISO}T00:00:00`);
    const beginMarker = `<!-- gcal:begin week=${year}-${monthNum}-W${weekNo} range=${startISO}..${year}-${monthNum}-${String(rangeEnd).padStart(2, '0')} -->`;
    const endMarker = '<!-- gcal:end -->';

    // Ensure the weekly note exists.
    let file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      const template = [
        `# Week ${weekNo} - ${monthName} ${rangeStart}-${rangeEnd}, ${year}`, '',
        '## Focus', '', '## Tasks', '',
        '## Calendar (auto-synced)', beginMarker, endMarker, '',
        '## Notes', '',
      ].join('\n');
      const folder = this.app.vault.getAbstractFileByPath('Task');
      if (!folder) {
        try { await this.app.vault.createFolder('Task'); } catch (e) { debug(`createFolder Task: ${e}`); }
      }
      file = await this.app.vault.create(filePath, template);
      new Notice(`sync-calendar: created weekly note ${fileName}`);
    }

    // Fetch this week's events (bounded server-side) and keep those that START in-week.
    const events = await this.calendarSync.listEvents(timeMin, 500, endMoment);
    const inWeek = events.filter((ev) => {
      if (!ev.startDateTime) { return false; }
      const s = window.moment(ev.startDateTime);
      return !s.isBefore(timeMin) && s.isBefore(endMoment);
    });

    const googleBlockIds = new Set<string>();
    const taskLines = inWeek.map((ev) => {
      const status = (ev.eventStatus === 'x' || ev.eventStatus === 'X') ? 'x' : ' ';
      let dateStr = '';
      if (ev.startDateTime) { dateStr += ' 🛫 ' + MainSynchronizer.formatEventDate(ev.startDateTime); }
      if (ev.dueDateTime) { dateStr += ' 📅 ' + MainSynchronizer.formatEventDate(ev.dueDateTime); }
      let blockId = ev.blockId && ev.blockId.length > 0 ? ev.blockId : '';
      if (!blockId && ev.eventId) {
        // Stable id derived from the Google eventId for events created directly in
        // Google (no plugin blockId). Obsidian block ids allow only [A-Za-z0-9-].
        blockId = 'gc' + String(ev.eventId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
      }
      if (blockId) { googleBlockIds.add(blockId); }
      const bid = blockId ? ` ^${blockId}` : '';
      return `- [${status}] ${ev.content}${dateStr}${bid}`;
    });

    const content = await this.app.vault.read(file as TFile);
    const lines = content.split('\n');
    const bIdx = lines.findIndex((l) => l.trim().startsWith('<!-- gcal:begin'));
    const eIdx = lines.findIndex((l) => l.trim() === endMarker);

    // Preserve existing in-block task lines that Google does NOT yet know about
    // (local tasks not yet round-tripped, or lines with no blockId) so a freshly
    // added task is never deleted by the block refresh.
    const preserved: string[] = [];
    if (bIdx !== -1 && eIdx !== -1 && eIdx > bIdx) {
      for (let i = bIdx + 1; i < eIdx; i++) {
        const l = lines[i];
        if (!/^\s*- \[.\] /u.test(l)) { continue; }
        const m = l.match(/\^([0-9a-zA-Z]+)\s*$/u);
        const lineBid = m ? m[1] : null;
        if (lineBid && googleBlockIds.has(lineBid)) { continue; }
        preserved.push(l);
      }
    }

    const mergedBlockLines = [...taskLines, ...preserved];
    let newLines: string[];
    if (bIdx === -1 || eIdx === -1 || eIdx < bIdx) {
      newLines = lines.concat(['', '## Calendar (auto-synced)', beginMarker, ...mergedBlockLines, endMarker]);
    } else {
      newLines = [...lines.slice(0, bIdx), beginMarker, ...mergedBlockLines, endMarker, ...lines.slice(eIdx + 1)];
    }
    await this.app.vault.modify(file as TFile, newLines.join('\n'));
    new Notice(`sync-calendar: synced ${taskLines.length} events (+${preserved.length} local) into ${fileName}`);
  }

}