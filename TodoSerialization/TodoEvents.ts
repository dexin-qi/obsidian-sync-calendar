
import type { EventRef, Events as ObsidianEvents } from 'obsidian';

import type { State } from 'TodoSerialization/Cache';
import type { Todo } from './Todo';

enum Event {
  CacheUpdate = 'obsidian-calendar-sync:cache-update',
  RequestCacheUpdate = 'obsidian-calendar-sync:request-cache-update',
}

interface CacheUpdateData {
  todos: Todo[];
  state: State;
}

export class TodosEvents {
  private obsidianEvents: ObsidianEvents;

  constructor({ obsidianEvents }: { obsidianEvents: ObsidianEvents }) {
    this.obsidianEvents = obsidianEvents;
  }

  public onCacheUpdate(handler: (cacheData: CacheUpdateData) => void): EventRef {
    return this.obsidianEvents.on(Event.CacheUpdate, handler);
  }

  public triggerCacheUpdate(cacheData: CacheUpdateData): void {
    this.obsidianEvents.trigger(Event.CacheUpdate, cacheData);
  }

  public onRequestCacheUpdate(handler: (fn: (cacheData: CacheUpdateData) => void) => void): EventRef {
    return this.obsidianEvents.on(Event.RequestCacheUpdate, handler);
  }

  public triggerRequestCacheUpdate(fn: (cacheData: CacheUpdateData) => void): void {
    this.obsidianEvents.trigger(Event.RequestCacheUpdate, fn);
  }

  public off(eventRef: EventRef): void {
    this.obsidianEvents.offref(eventRef);
  }
}
