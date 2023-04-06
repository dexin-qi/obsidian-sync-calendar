<script lang="ts">
	// import type { App } from "obsidian";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import type { Todo } from "TodoSerialization/Todo";

	import { onMount, onDestroy } from "svelte";
	// import { Result } from "../utils/result";

	// import ErrorDisplay from "./ErrorDisplay.svelte";
	import TaskList from "./TaskList.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let api: GoogleCalendarSync;

	let fetching = false;
	let eventsList: Todo[] = [];

	let autoRefreshIntervalId: number = null;
	let fetchedOnce = false;
	let refreshTimes = 1;
	let eventsListTitle = "TODOs in Calendar";

	$: {
		if (autoRefreshIntervalId == null) {
			autoRefreshIntervalId = window.setInterval(async () => {
				await fetchTodos();
			}, 8000);
		}
	}

	onMount(async () => {
		await fetchTodos();
	});

	onDestroy(() => {
		if (autoRefreshIntervalId != null) {
			clearInterval(autoRefreshIntervalId);
		}
	});

	async function fetchTodos() {
		if (fetching) {
			return;
		}

		fetching = true;

		const fetchPromise = api.fetchTodos(200).then((newEventsList) => {
			eventsList = newEventsList;
			console.info(`Fetched success: ${eventsList.length} events`);
			fetchedOnce = true;
		});

		const timeoutPromise = new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(new Error("Fetch timed out"));
			}, 4000);
		});

		await Promise.race([fetchPromise, timeoutPromise])
			.then(() => {
				fetching = false;
			})
			.catch((error) => {
				console.error("Fetching events failed:", error);
				fetching = false;
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
		<TaskList todoList={eventsList} />
	{/if}
{/if}

<!-- <br /> -->
<button
	class="todoist-refresh-button"
	on:click={async () => {
		await fetchTodos();
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

<!-- <ErrorDisplay error={tasks.unwrapErr()} /> -->
