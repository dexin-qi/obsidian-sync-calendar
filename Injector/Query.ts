/**
 * An array of available sorting options.
 */
export const sortingOptions = [
  "date",
  "dateDESC",
  "priority",
  "priorityDESC",
];

/**
 * A type representing a sorting option.
 */
export type SortingOption = typeof sortingOptions[number];

/**
 * A type guard to check if a value is a valid sorting option.
 * @param value The value to check.
 * @returns True if the value is a valid sorting option, false otherwise.
 */
export function isSortingOption(value: string): value is SortingOption;
export function isSortingOption(value: any) {
  return sortingOptions.includes(value);
}

/**
 * An interface representing a query.
 */
export type Query = {
  name?: string
  timeMin?: string;
  timeMax?: string;
  maxEvents?:number;
  filter?: string;
  sorting?: SortingOption[];
  group?: boolean;
};
