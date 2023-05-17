import type { Todo } from 'TodoSerialization/Todo';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * A subset of fields of {@link Todo} that can be parsed from the textual
 * description of that Todo.
 *
 * All fields are writeable for convenience.
 */
export type TodoDetails = Writeable<
  Pick<
    Todo,
    | 'blockId'
    | 'content'
    | 'priority'
    | 'tags'
    | 'startDateTime'
    | 'scheduledDateTime'
    | 'dueDateTime'
    | 'doneDateTime'
  >
>;

export interface TodoSerializer {
  /**
   * Parses todo details from the string representation of a todo
   *
   * @param line The single line of text to parse
   * @returns {TodoDetails} Details parsed from {@link line}
   */
  deserialize(line: string): TodoDetails;

  /**
   * Creates the string representation of a {@link Todo}
   *
   * @param todo The {@link Todo} to stringify
   * @returns {string}
   */
  serialize(todo: Todo): string;
}

export { DefaultTodoSerializer } from './DefaultSerialization';