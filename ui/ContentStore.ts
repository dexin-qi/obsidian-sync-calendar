import type { Writable } from 'svelte/store';

export const contentStore = new Map<string, Writable<string>>();