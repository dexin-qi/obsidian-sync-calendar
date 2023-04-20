import { isSortingOption, sortingOptions } from "./Query";
import type { Query } from "./Query";
import YAML from "yaml";

export class ParsingError extends Error {
  inner: Error | undefined;

  constructor(msg: string, inner: Error | undefined = undefined) {
    super(msg);
    this.inner = inner;
  }

  public toString(): string {
    if (this.inner) {
      return `${this.message}: '${this.inner}'`;
    }

    return super.toString();
  }
}

export function parseQuery(raw: string): Query {
  let obj: any;

  try {
    obj = tryParseAsJson(raw);
  } catch (e) {
    try {
      obj = tryParseAsYaml(raw);
    } catch (e) {
      throw new ParsingError("Unable to parse as YAML or JSON");
    }
  }

  return parseObject(obj);
}

function tryParseAsJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ParsingError("Invalid JSON", e);
  }
}

function tryParseAsYaml(raw: string): any {
  try {
    return YAML.parse(raw);
  } catch (e) {
    throw new ParsingError("Invalid YAML", e);
  }
}

function parseObject(query: any): Query {
  if (query.hasOwnProperty("name") && typeof query.name !== "string") {
    throw new ParsingError("'name' field must be a string");
  }

  if (query.hasOwnProperty("filter") && typeof query.filter !== "string") {
    throw new ParsingError("'filter' field must be a string");
  }

  if (query.hasOwnProperty("timeMin")) {
    if (typeof query.timeMin !== "string") {
      throw new ParsingError("'timeMin' field must be a string");
    }
    if (!window.moment(query.timeMin).isValid()) {
      throw new ParsingError("'timeMin' field must be a valid moment string");
    }
  }

  if (query.hasOwnProperty("timeMax")) {
    if (typeof query.timeMax !== "string") {
      throw new ParsingError("'timeMax' field must be a string");
    }
    if (!window.moment(query.timeMax).isValid()) {
      throw new ParsingError("'timeMax' field must be a valid moment string");
    }
  }

  if (query.hasOwnProperty("maxEvents") && typeof query.maxEvents !== "number") {
    throw new ParsingError("'maxEvents' field must be a number");
  }

  if (query.hasOwnProperty("group") && typeof query.group != "boolean") {
    throw new ParsingError("'group' field must be a boolean.");
  }

  if (query.hasOwnProperty("sorting")) {
    if (!Array.isArray(query.sorting)) {
      throw new ParsingError(
        `'sorting' field must be an array of strings within the set [${formatSortingOpts()}].`
      );
    }

    const sorting = query.sorting as any[];

    for (const element of sorting) {
      if (!(typeof element == "string") || !isSortingOption(element)) {
        throw new ParsingError(
          `'sorting' field must be an array of strings within the set [${formatSortingOpts()}].`
        );
      }
    }
  }

  return query as Query;
}

function formatSortingOpts(): string {
  return sortingOptions.map((e) => `'${e}'`).join(", ");
}