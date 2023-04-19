<script lang="ts">
	import type SyncCalendarPluginSettings from "main";
	import type SyncCalendarPlugin from "main";
	import { NetworkStatus } from "Syncs/StatusEnumerate";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import type { Todo } from "TodoSerialization/Todo";

	import { onMount, onDestroy } from "svelte";

	import ErrorDisplay from "./ErrorDisplay.svelte";
	import TaskList from "./TaskList.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let plugin: SyncCalendarPlugin;
	export let api: GoogleCalendarSync;
	export let settings: SyncCalendarPluginSettings;

	let fetching = false;
	let eventsList: Todo[] = [];

	let autoRefreshIntervalId: null | number = null;
	let autoPatchIntervalId: number;

	let error_info: null | Error = null;
	let fetchedOnce = false;
	let refreshTimes = 1;
	let eventsListTitle = "TODOs in Calendar";

	$: {
		if (autoRefreshIntervalId == null) {
			autoRefreshIntervalId = window.setInterval(async () => {
				await fetchEventLists();
			}, 10000);
		}
	}

	onMount(async () => {
		await fetchEventLists();
	});

	onDestroy(() => {
		if (autoRefreshIntervalId != null) {
			clearInterval(autoRefreshIntervalId);
		}
	});

	async function fetchEventLists() {
		const apiIsReady = await api.isReady();
		if (!apiIsReady) {
			return;
		}

		if (fetching) {
			return;
		}
		fetching = true;
		plugin.syncStatusItem.setText("Sync: 🔽");

		const fetchPromise = api
			.fetchTodos(
				plugin.settings.fetchWeeksAgo,
				plugin.settings.fetchMaximumEvents
			)
			.then((newEventsList) => {
				eventsList = newEventsList;
				fetchedOnce = true;
				plugin.netStatus = NetworkStatus.HEALTH;
				plugin.syncStatusItem.setText("Sync: 🆗");
				console.info(
					`Successfully Fetched ${eventsList.length} events`
				);
			})
			.catch((err) => {
				console.error(err);
				plugin.netStatus = NetworkStatus.CONNECTION_ERROR;
				throw new Error(
					"Connection failed, \
          cannot fetch events from Google calendar."
				);
			});

		const timeoutPromise = new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(
					new Error(
						"Fetch from Google calendar timeout! \
            Check your connection and proxy settings, \
            then restart Obsidian."
					)
				);
			}, 4000);
		});

		await Promise.race([fetchPromise, timeoutPromise])
			.then(() => {
				fetching = false;
				error_info = null;
			})
			.catch((err) => {
				fetching = false;
				error_info = err;
				plugin.netStatus = NetworkStatus.CONNECTION_ERROR;
				plugin.syncStatusItem.setText("Sync: 🆖");
			});
	}
</script>

{#if fetchedOnce}
	{#if eventsList.length == 0}
		<h4 class="todoist-query-title">TODO in Calendar</h4>
		<NoTaskDisplay />
	{:else}
		<h4 class="todoist-query-title">
			{eventsList.length}
			{eventsListTitle}
		</h4>
		<TaskList {api} {settings} todoList={eventsList} />
	{/if}
{/if}
{#if error_info !== null}
	<ErrorDisplay error={error_info} />
{/if}

<button
	class="todoist-refresh-button"
	on:click={async () => {
		await fetchEventLists();
	}}
	disabled={fetching}
>
	<svg
		class={fetching ? "todoist-refresh-spin" : ""}
		width="20px"
		height="20px"
		viewBox="0 0 20 20"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			fill-rule="evenodd"
			d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
			clip-rule="evenodd"
		/>
	</svg>
</button>
