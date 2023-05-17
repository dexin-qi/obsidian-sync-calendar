import type { Todo } from "TodoSerialization/Todo";
import type { TodoDetails, TodoSerializer } from ".";

/* Interface describing the symbols that {@link DefaultTodoSerializer}
 * uses to serialize and deserialize todos.
 *
 * @export
 * @interface DefaultTodoSerializerSymbols
 */
export interface DefaultTodoSerializerSymbols {
  readonly prioritySymbols: {
    High: string;
    Medium: string;
    Low: string;
    None: string;
  };
  readonly TodoFormatRegularExpressions: {
    priorityRegex: RegExp;
    blockIdRegex: RegExp;
    createdDateRegex: RegExp;
    scheduledDateRegex: RegExp;
    scheduledDateTimeRegex: RegExp;
    startDateRegex: RegExp;
    startDateTimeRegex: RegExp;
    dueDateRegex: RegExp;
    dueDateTimeRegex: RegExp;
    doneDateRegex: RegExp;
    recurrenceRegex: RegExp;
  };
}

/**
 * Uses emojis to concisely convey meaning
 */
export const DEFAULT_SYMBOLS: DefaultTodoSerializerSymbols = {
  prioritySymbols: {
    High: '⏫',
    Medium: '🔼',
    Low: '🔽',
    None: '',
  },
  TodoFormatRegularExpressions: {
    // The following regex's end with `$` because they will be matched and
    // removed from the end until none are left.
    priorityRegex: /([⏫🔼🔽])$/u,
    blockIdRegex: /\^([0-9a-zA-Z]*)$/u,
    createdDateRegex: /➕ *(\d{4}-\d{2}-\d{2})$/u,
    startDateRegex: /🛫 *(\d{4}-\d{2}-\d{2})$/u,
    startDateTimeRegex: /🛫 *(\d{4}-\d{2}-\d{2}@\d+:\d+)$/u,
    scheduledDateRegex: /[⏳⌛] *(\d{4}-\d{2}-\d{2})$/u,
    scheduledDateTimeRegex: /[⏳⌛] *(\d{4}-\d{2}-\d{2}@\d+:\d+)$/u,
    dueDateRegex: /[📅📆🗓] *(\d{4}-\d{2}-\d{2})$/u,
    dueDateTimeRegex: /[📅📆🗓] *(\d{4}-\d{2}-\d{2}@\d+:\d+)$/u,
    doneDateRegex: /✅ *(\d{4}-\d{2}-\d{2})$/u,
    recurrenceRegex: /🔁 ?([a-zA-Z0-9, !]+)$/iu,
  },
} as const;


export class TodoRegularExpressions {
  public static readonly dateFormat = 'YYYY-MM-DD';
  public static readonly dateTimeFormat = 'YYYY-MM-DD@HH:mm';

  // Matches indentation before a list marker (including > for potentially nested blockquotes or Obsidian callouts)
  public static readonly indentationRegex = /^([\s\t>]*)/;

  // Matches - or * list markers, or numbered list markers (eg 1.)
  public static readonly listMarkerRegex = /([-*]|[0-9]+\.)/;

  // Matches a checkbox and saves the status character inside
  public static readonly checkboxRegex = /\[(.)\]/u;

  // Matches the rest of the todo after the checkbox.
  public static readonly afterCheckboxRegex = / *(.*)/u;

  // Main regex for parsing a line. It matches the following:
  // - Indentation
  // - List marker
  // - Status character
  // - Rest of todo after checkbox markdown
  public static readonly todoRegex = new RegExp(
    TodoRegularExpressions.indentationRegex.source +
    TodoRegularExpressions.listMarkerRegex.source +
    ' +' +
    TodoRegularExpressions.checkboxRegex.source +
    TodoRegularExpressions.afterCheckboxRegex.source,
    'u',
  );

  // Used with the "Create or Edit Todo" command to parse indentation and status if present
  public static readonly nonTodoRegex = new RegExp(
    TodoRegularExpressions.indentationRegex.source +
    TodoRegularExpressions.listMarkerRegex.source +
    '? *(' +
    TodoRegularExpressions.checkboxRegex.source +
    ')?' +
    TodoRegularExpressions.afterCheckboxRegex.source,
    'u',
  );

  // Used with "Toggle Done" command to detect a list item that can get a checkbox added to it.
  public static readonly listItemRegex = new RegExp(
    TodoRegularExpressions.indentationRegex.source + TodoRegularExpressions.listMarkerRegex.source,
  );

  // Match on block link at end.
  public static readonly blockLinkRegex = / \^[a-zA-Z0-9-]+$/u;

  // Regex to match all hash tags, basically hash followed by anything but the characters in the negation.
  // To ensure URLs are not caught it is looking of beginning of string tag and any
  // tag that has a space in front of it. Any # that has a character in front
  // of it will be ignored.
  // EXAMPLE:
  // description: '#dog #car http://www/ddd#ere #house'
  // matches: #dog, #car, #house
  public static readonly hashTags = /(^|\s)#[^ !@#$%^&*(),.?":{}|<>]*/g;
  public static readonly hashTagsFloating = new RegExp(this.hashTags.source);
  public static readonly hashTagsFromEnd = new RegExp(this.hashTags.source + '$');
}


export class DefaultTodoSerializer implements TodoSerializer {
  constructor(public readonly symbols: DefaultTodoSerializerSymbols) { }

  /* Convert a todo to its string representation
   *
   * @param todo The todo to serialize
   *
   * @return The string representation of the todo
   */
  public serialize(todo: Todo): string {
    let components: string[] = [];
    if (todo.content) {
      components.push(todo.content);
    }

    todo.tags?.forEach((tag) => {
      components.push(tag);
    });

    if (todo.priority) {
      components.push(todo.priority);
    }

    const regDateTime = /(\d{4}-\d{2}-\d{2}T)/u;

    if (todo.startDateTime) {
      if (todo.startDateTime.match(regDateTime)) {
        components.push(window.moment(todo.startDateTime).format("[🛫] YYYY-MM-DD[@]HH:mm"));
      } else {
        components.push('🛫 ' + todo.startDateTime);
      }
    }
    if (todo.scheduledDateTime) {
      if (todo.scheduledDateTime.match(regDateTime)) {
        components.push(window.moment(todo.scheduledDateTime).format("[⌛] YYYY-MM-DD[@]HH:mm"));
      } else {
        components.push('⌛ ' + todo.scheduledDateTime);
      }
    }
    if (todo.dueDateTime) {
      if (todo.dueDateTime.match(regDateTime)) {
        components.push(window.moment(todo.dueDateTime).format("[🗓] YYYY-MM-DD[@]HH:mm"));
      } else {
        components.push('🗓 ' + todo.dueDateTime);
      }
    }

    if (todo.doneDateTime) {
      components.push('✅ ' + todo.doneDateTime);
    }

    if (todo.blockId) {
      components.push(`^${todo.blockId}`);
    }

    // debugger;
    return components.join(' ');
  }

  /* Parse TodoDetails from the textual description of a {@link Todo}
   *
   * @param line The string to parse
   *
   * @return {TodoDetails}
   */
  public deserialize(line: string): TodoDetails {
    const { TodoFormatRegularExpressions } = this.symbols;

    // Keep matching and removing special strings from the end of the
    // description in any order. The loop should only run once if the
    // strings are in the expected order after the description.
    let matched: boolean;
    let priority: null | string = null;
    let blockId: null | string = null;
    let doneDateTime: null | string = null;
    let startDateTime: null | string = null;
    let scheduledDateTime: null | string = null;
    let dueDateTime: null | string = null;

    // Tags that are removed from the end while parsing, but we want to add them back for being part of the description.
    // In the original todo description they are possibly mixed with other components
    // (e.g. #tag1 <due date> #tag2), they do not have to all trail all todo components,
    // but eventually we want to paste them back to the todo description at the end
    let trailingTags = '';
    // Add a "max runs" failsafe to never end in an endless loop:
    const maxRuns = 20;
    let runs = 0;
    do {
      matched = false;

      const priorityMatch = line.match(TodoFormatRegularExpressions.priorityRegex);
      if (priorityMatch !== null) {
        priority = priorityMatch[1];
        line = line.replace(TodoFormatRegularExpressions.priorityRegex, '').trim();
        matched = true;
      }

      const blockIdMatch = line.match(TodoFormatRegularExpressions.blockIdRegex);
      if (blockIdMatch !== null) {
        blockId = blockIdMatch[1];
        line = line.replace(TodoFormatRegularExpressions.blockIdRegex, '').trim();
        matched = true;
      }

      const startDateMatch = line.match(TodoFormatRegularExpressions.startDateRegex);
      if (startDateMatch !== null) {
        startDateTime = window.moment(startDateMatch[1], TodoRegularExpressions.dateFormat).format('YYYY-MM-DD');
        line = line.replace(TodoFormatRegularExpressions.startDateRegex, '').trim();
        matched = true;
      }

      const startDateTimeMatch = line.match(TodoFormatRegularExpressions.startDateTimeRegex);
      if (startDateTimeMatch !== null) {
        startDateTime = window.moment(startDateTimeMatch[1], TodoRegularExpressions.dateTimeFormat).format('YYYY-MM-DD[T]HH:mm:ssZ');
        line = line.replace(TodoFormatRegularExpressions.startDateTimeRegex, '').trim();
        matched = true;
      }

      const dueDateMatch = line.match(TodoFormatRegularExpressions.dueDateRegex);
      if (dueDateMatch !== null) {
        dueDateTime = window.moment(dueDateMatch[1], TodoRegularExpressions.dateFormat).format('YYYY-MM-DD');
        line = line.replace(TodoFormatRegularExpressions.dueDateRegex, '').trim();
        matched = true;
      }

      const dueDateTimeMatch = line.match(TodoFormatRegularExpressions.dueDateTimeRegex);
      if (dueDateTimeMatch !== null) {
        dueDateTime = window.moment(dueDateTimeMatch[1], TodoRegularExpressions.dateTimeFormat).format('YYYY-MM-DD[T]HH:mm:ssZ');
        line = line.replace(TodoFormatRegularExpressions.dueDateTimeRegex, '').trim();
        matched = true;
      }

      const doneDateMatch = line.match(TodoFormatRegularExpressions.doneDateRegex);
      if (doneDateMatch !== null) {
        doneDateTime = window.moment(doneDateMatch[1], TodoRegularExpressions.dateFormat).format('YYYY-MM-DD');
        line = line.replace(TodoFormatRegularExpressions.doneDateRegex, '').trim();
        matched = true;
      }

      const scheduledDateMatch = line.match(TodoFormatRegularExpressions.scheduledDateRegex);
      if (scheduledDateMatch !== null) {
        scheduledDateTime = window.moment(scheduledDateMatch[1], TodoRegularExpressions.dateFormat).format('YYYY-MM-DD');
        line = line.replace(TodoFormatRegularExpressions.scheduledDateRegex, '').trim();
        matched = true;
      }

      const scheduledDateTimeMatch = line.match(TodoFormatRegularExpressions.scheduledDateTimeRegex);
      if (scheduledDateTimeMatch !== null) {
        scheduledDateTime = window.moment(scheduledDateTimeMatch[1], TodoRegularExpressions.dateTimeFormat).format('YYYY-MM-DD[T]HH:mm:ssZ');
        line = line.replace(TodoFormatRegularExpressions.scheduledDateTimeRegex, '').trim();
        matched = true;
      }


      // Match tags from the end to allow users to mix the various todo components with
      // tags. These tags will be added back to the description below
      const tagsMatch = line.match(TodoRegularExpressions.hashTagsFloating);
      if (tagsMatch != null) {
        line = line.replace(TodoRegularExpressions.hashTagsFloating, '').trim();
        matched = true;
        const tagName = tagsMatch[0].trim();
        // Adding to the left because the matching is done right-to-left
        trailingTags = trailingTags.length > 0 ? [tagName, trailingTags].join(' ') : tagName;
      }

      // const recurrenceMatch = line.match(TodoFormatRegularExpressions.recurrenceRegex);
      // if (recurrenceMatch !== null) {
      //   // Save the recurrence rule, but *do not parse it yet*.
      //   // Creating the Recurrence object requires a reference date (e.g. a due date),
      //   // and it might appear in the next (earlier in the line) tokens to parse
      //   recurrenceRule = recurrenceMatch[1].trim();
      //   line = line.replace(TodoFormatRegularExpressions.recurrenceRegex, '').trim();
      //   matched = true;
      // }

      runs++;
    } while (matched && runs <= maxRuns);

    // // Now that we have all the todo details, parse the recurrence rule if we found any
    // if (recurrenceRule.length > 0) {
    //   recurrence = Recurrence.fromText({
    //     recurrenceRuleText: recurrenceRule,
    //     startDate,
    //     scheduledDate,
    //     dueDate,
    //   });
    // }

    let tags = trailingTags.match(TodoRegularExpressions.hashTags)?.map((tag) => tag.trim()) ?? [];

    // Add back any trailing tags to the description. We removed them so we can parse the rest of the
    // components but now we want them back.
    // The goal is for a todo of them form 'Do something #tag1 (due) tomorrow #tag2 (start) today'
    // to actually have the description 'Do something #tag1 #tag2'
    // if (trailingTags.length > 0) line += ' ' + trailingTags;

    return {
      content: line,
      blockId: blockId,
      priority: priority,
      tags,
      startDateTime,
      scheduledDateTime,
      dueDateTime,
      doneDateTime,
    };
  }
}
