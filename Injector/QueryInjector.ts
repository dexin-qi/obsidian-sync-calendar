import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import type SyncCalendarPlugin from "main";
import type GoogleCalendarSync from "../Syncs/GoogleCalendarSync";

import { parseQuery } from "./Parser";
import { Query } from "./Query";

import TodoistQuery from "../ui/TodoistQuery.svelte";
import ErrorDisplay from "../ui/ErrorDisplay.svelte";
import type { SvelteComponentDev } from "svelte/internal";

export default class QueryInjector {
  private pendingQueries: PendingQuery[];

  private plugin: SyncCalendarPlugin;
  private calendarSync: GoogleCalendarSync;

  constructor(plugin: SyncCalendarPlugin) {
    this.plugin = plugin;
    this.pendingQueries = [];
  }

  onNewBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const pendingQuery = {
      source: source,
      target: el,
      ctx: ctx,
    };
    // console.log('source: ' + source);

    if (typeof this.calendarSync == "undefined") {
      this.pendingQueries.push(pendingQuery);
      return;
    }

    this.injectQuery(pendingQuery);
  }

  setCalendarSync(calendarSync: GoogleCalendarSync) {
    this.calendarSync = calendarSync;

    while (this.pendingQueries.length > 0) {
      this.injectQuery(this.pendingQueries[0]);
      this.pendingQueries.splice(0, 1);
    }
  }

  injectQuery(pendingQuery: PendingQuery) {
    let child: InjectedQuery;

    try {
      let query: Query;
      if (pendingQuery.source.length > 0) {
        query = parseQuery(pendingQuery.source);
      }

      child = new InjectedQuery(pendingQuery.target, (root: HTMLElement) => {
        return new TodoistQuery({
          target: root,
          props: {
            plugin: this.plugin,
            api: this.calendarSync,
            query: query,
          },
        });
      });
    }
    catch (e) {
      console.error(e);

      child = new InjectedQuery(pendingQuery.target, (root: HTMLElement) => {
        return new ErrorDisplay({
          target: root,
          props: {
            error: e
          },
        });
      });
    }


    pendingQuery.ctx.addChild(child);
  }

}

interface PendingQuery {
  source: string;
  target: HTMLElement;
  ctx: MarkdownPostProcessorContext;
}

class InjectedQuery extends MarkdownRenderChild {
  private readonly createComp: (root: HTMLElement) => SvelteComponentDev;
  private component: SvelteComponentDev;

  constructor(
    container: HTMLElement,
    createComp: (root: HTMLElement) => SvelteComponentDev
  ) {
    super(container);
    this.containerEl = container;
    this.createComp = createComp;
  }

  onload() {
    this.component = this.createComp(this.containerEl);
  }

  onunload() {
    if (this.component) {
      this.component.$destroy();
    }
  }
}
