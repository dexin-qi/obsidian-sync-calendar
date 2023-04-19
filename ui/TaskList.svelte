<script lang="ts">
	import { onDestroy } from "svelte";

	import type SyncCalendarPluginSettings from "main";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import type { Todo } from "TodoSerialization/Todo";

	import TaskRenderer from "./TaskRenderer.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let api: GoogleCalendarSync;
	export let todoList: Todo[];
	export let settings: SyncCalendarPluginSettings;

	// export let sorting: string[];
	// export let renderProject: boolean = true;
	// export let renderNoTaskInfo: boolean = true;

	// let metadata: ITodoistMetadata = null;
	// const metadataUnsub = api.metadata.subscribe((value) => (metadata = value));

	onDestroy(() => {
		// metadataUnsub();
	});

	$: todos = todoList;
	// let tasksPendingClose: ID[] = [];
	// $: todos = tasks
	// 	.filter((todo) => !tasksPendingClose.includes(todo.id))
	// 	.sort((first: Todo, second: Todo) => first.compareTo(second, sorting));

	async function onClickTask(todo: Todo) {
		api.doneEventsQueue.enqueue(todo);
	}
</script>

{#if todos.length != 0}
	<ul class="contains-todo-list todo-list-todo-list">
		{#each todos as todo (todo.calUId)}
			<TaskRenderer {onClickTask} {settings} {todo} />
		{/each}
	</ul>
{:else}
	<NoTaskDisplay />
{/if}
