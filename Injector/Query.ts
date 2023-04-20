export const sortingOptions = [
  "date",
  "dateDESC",
  "priority",
  "priorityDESC",
];

export type SortingOption = typeof sortingOptions[number];

export function isSortingOption(value: string): value is SortingOption;
export function isSortingOption(value: any) {
  return sortingOptions.includes(value);
}

export type Query = {
  name?: string
  timeMin?: string;
  timeMax?: string;
  maxEvents?:number;
  filter?: string;
  sorting?: SortingOption[];
  group?: boolean;
};