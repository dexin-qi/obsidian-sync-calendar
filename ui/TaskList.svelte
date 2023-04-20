<script lang="ts">
	import type SyncCalendarPluginSettings from "main";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import type { Todo } from "TodoSerialization/Todo";

	import TaskRenderer from "./TaskRenderer.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let api: GoogleCalendarSync;
	export let settings: SyncCalendarPluginSettings;
	export let todoList: Todo[];

	$: todos = todoList;

</script>

{#if todos.length != 0}
	<ul class="contains-todo-list todo-list-todo-list">
		{#each todos as todo (todo.calUId)}
			<TaskRenderer {api} {settings} {todo} />
		{/each}
	</ul>
{:else}
	<NoTaskDisplay />
{/if}
