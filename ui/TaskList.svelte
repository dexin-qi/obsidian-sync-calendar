<script lang="ts">
	import type SyncCalendarPlugin from "main";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import { Todo } from "TodoSerialization/Todo";
	import type { Query } from "Injector/Query";

	import TaskRenderer from "./TaskRenderer.svelte";
	import NoTaskDisplay from "./NoTaskDisplay.svelte";

	export let api: GoogleCalendarSync;
	export let plugin: SyncCalendarPlugin;
	export let todos: Todo[];

	
</script>

{#if todos.length != 0}
	<ul class="contains-todo-list todo-list-todo-list">
		{#each todos as todo (todo.calUId)}
			<TaskRenderer {api} {plugin} {todo} />
		{/each}
	</ul>
{:else}
	<NoTaskDisplay />
{/if}
