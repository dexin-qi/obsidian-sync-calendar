<script lang="ts">
	import { onDestroy } from "svelte";
	// import type { Todo, ID } from "../api/models";

	// import type { GoogleCalendarSync } from "../syncs/google_calendar";
	import type { Todo } from "../TodoSerialization/Todo";

	import TaskRenderer from "./TaskRenderer.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let todoList: Todo[];
	// export let api: GoogleCalendarSync;

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
	// 	.filter((task) => !tasksPendingClose.includes(task.id))
	// 	.sort((first: Todo, second: Todo) => first.compareTo(second, sorting));

	async function onClickTask(task: Todo) {
		console.log("user confirmed, event terminated!");
		// 	tasksPendingClose.push(task.id);
		// 	tasksPendingClose = tasksPendingClose;

		// 	if (await api.closeTask(task.id)) {
		// 		tasks.filter((otherTask) => otherTask.id == task.id);
		// 		tasks = tasks;
		// 	}

		// 	tasksPendingClose.filter((id) => id == task.id);
		// 	tasksPendingClose = tasksPendingClose;
	}
</script>

{#if todos.length != 0}
	<ul class="contains-task-list todoist-task-list">
		{#each todos as todo (todo.calUId)}
			<TaskRenderer {onClickTask} {todo} />
		{/each}
	</ul>
{:else}
	<NoTaskDisplay />
{/if}
