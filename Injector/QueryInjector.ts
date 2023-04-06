import {
  App,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
} from "obsidian";

import GoogleCalendarSync from "../Syncs/GoogleCalendarSync";

import TodoistQuery from "../ui/TodoistQuery.svelte";
import type SvelteComponentDev from "../ui/TodoistQuery.svelte";
import ErrorDisplay from "../ui/ErrorDisplay.svelte";
// import SvelteComponentDev

export default class QueryInjector {
  private app: App;
  private pendingQueries: PendingQuery[];

  private calendarSync: GoogleCalendarSync;

  constructor(app: App) {
    this.app = app;
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



    //   query = parseQuery(JSON.parse(pendingQuery.source));
    // } catch(e) {
    //   query = Result.Err(new Error(`Query was not valid JSON: ${e.message}.`));
    // }

    const child = new InjectedQuery(pendingQuery.target, (root: HTMLElement) => {
      // if (query.isOk()) {
      return new TodoistQuery({
        target: root,
        props: {
          // query: null,

          api: this.calendarSync,

        },
      });
      // } else {
      // return new ErrorDisplay({
      //   target: root,
      //   props: {
      //     error: new Error("Called 'unwrapErr' on a Result with a value."),
      //   },
      // });
      // }
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
