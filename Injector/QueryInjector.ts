import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import type SyncCalendarPlugin from "main";
import type SyncCalendarPluginSettings from "main";
import type GoogleCalendarSync from "../Syncs/GoogleCalendarSync";

import TodoistQuery from "../ui/TodoistQuery.svelte";
import type SvelteComponentDev from "../ui/TodoistQuery.svelte";
import ErrorDisplay from "../ui/ErrorDisplay.svelte";
// import SvelteComponentDev

export default class QueryInjector {
  private pendingQueries: PendingQuery[];
    
  private settings: SyncCalendarPluginSettings;
  
  private plugin: SyncCalendarPlugin;
  private app: App;
  private calendarSync: GoogleCalendarSync;

  constructor(plugin: SyncCalendarPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.settings = plugin.settings;
    this.pendingQueries = [];
  }

  onNewBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const pendingQuery = {
      source: source,
      target: el,
      ctx: ctx,
    };
    // console.log('source: ' + source);
    // console.log('target: ' + el);
    // console.log('ctx: ' + ctx);

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
    const child = new InjectedQuery(pendingQuery.target, (root: HTMLElement) => {
      return new TodoistQuery({
        target: root,
        props: {
          plugin: this.plugin,
          api: this.calendarSync,
          settings: this.settings,
        },
      });
    });

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
