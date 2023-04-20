<script lang="ts">
	import { Menu } from "obsidian";
	import { fade } from "svelte/transition";
	import { writable } from "svelte/store";

	import type SyncCalendarPlugin from "main";
	import { Todo } from "../TodoSerialization/Todo";
	import { openExternal } from "../lib/OpenExternal";
	import type GoogleCalendarSync from "Syncs/GoogleCalendarSync";
	import { contentStore } from "./ContentStore";

	import MarkdownRenderer from "./MarkdownRenderer.svelte";

	export let api: GoogleCalendarSync;
	export let plugin: SyncCalendarPlugin;
	export let todo: Todo;
	// export let refreshWholeList: () => Promise<void>;

	$: disable = false;
	$: {
		if (
			!contentStore.has(todo.eventId!) ||
			contentStore.get(todo.eventId!) == undefined ||
			contentStore.get(todo.eventId!) == null
		) {
			contentStore.set(todo.eventId!, writable("None"));
		}
		let ct = contentStore.get(todo.eventId!);
		if (ct !== undefined) {
			ct.set(getTodoContent(todo));
		}
	}

	function getTodoContent(todo: Todo): string {
		// console.log(todo);
		if (todo.content) {
			return todo.content;
		}
		return "Invalid Todo Title";
	}
	// For some reason, the Todoist API returns priority in reverse order from
	// the p1/p2/p3/p4 fluent entry notation.
	function getPriorityClass(priority: null | undefined | string): string {
		if (priority === null || priority === undefined || priority === " ") {
			return "todo-list-p4";
		}
		if (priority === "🔽") {
			return "todo-list-p3";
		}
		if (priority === "🔼") {
			return "todo-list-p2";
		}
		if (priority === "⏫") {
			return "todo-list-p1";
		}
		return "todo-list-p4";
	}

	async function onClickTask(todo: Todo) {
		api.doneEventsQueue.enqueue(todo);
	}

	function onClickTaskContainer(evt: MouseEvent) {
		evt.stopPropagation();
		evt.preventDefault();

		let menu = new Menu();

		menu.addItem((menuItem) =>
			menuItem
				.setTitle("Delete todo")
				.setIcon("popup-open")
				.onClick(() => {
					api.deleteEventsQueue.enqueue(todo);
				})
		);

		// menu.addItem((menuItem) =>
		// 	menuItem
		// 		.setTitle("Edit todo in obsidian")
		// 		.setIcon("popup-open")
		// 		.onClick(() => {})
		// );

		if (todo.eventHtmlLink) {
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Edit todo in calendar (web)")
					.setIcon("popup-open")
					.onClick(() => {
						const regExp = /eid=([^&]+)/;
						const match = todo.eventHtmlLink!.match(regExp);
						if (match) {
							const eid = match[1];
							const editLink = `https://calendar.google.com/calendar/u/0/r/eventedit/${eid}`;
							console.log(`open ${editLink}`);
							openExternal(editLink);
						}
					})
			);
		}

		menu.showAtPosition({
			x: evt.pageX,
			y: evt.pageY,
		});
	}
</script>

<li
	on:contextmenu={onClickTaskContainer}
	transition:fade={{ duration: 400 }}
	class="
  todo-list-item
  has-time
  {getPriorityClass(todo.priority)} 
  {todo.isOverdue() ? 'todo-overdue' : ''}
  "
>
	<div>
		<input
			disabled={disable}
			class="todo-list-item-checkbox"
			type="checkbox"
			on:click={async () => {
				disable = true;
				await onClickTask(todo);
			}}
		/>
		<MarkdownRenderer
			class="todo-list-todo-content"
			eventId={todo.eventId}
		/>
	</div>
	<div class="todo-metadata">
		<!-- {#if plugin.settings.renderProject && renderProject}
			<div class="todo-project">
				{#if plugin.settings.renderProjectIcon}
					<svg
						class="todo-project-icon"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v7h-2l-1 2H8l-1-2H5V5z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
				{metadata.projects.get_or_default(
					todo.projectID,
					UnknownProject
				).name}
				{#if todo.sectionID}
					|
					{metadata.sections.get_or_default(
						todo.sectionID,
						UnknownSection
					).name}
				{/if}
			</div>
		{/if} -->
		{#if plugin.settings.renderDate && todo.startDateTime}
			<div class="todo-date {todo.isOverdue() ? 'todo-overdue' : ''}">
				<svg
					class="todo-calendar-icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
						clip-rule="evenodd"
					/>
				</svg>
				{Todo.momentString(todo.startDateTime, "🛫")}
			</div>
		{/if}
		{#if plugin.settings.renderTags && todo.tags !== undefined && todo.tags?.length > 0}
			<div class="todo-labels">
				<svg
					class="todo-labels-icon"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
						clip-rule="evenodd"
					/>
				</svg>

				{#each todo.tags as tag, i}
					<a href="tag" class="tag" target="_blank" rel="noopener">
						{tag}
					</a>
					{#if i != todo.tags.length - 1}<span>,</span>{/if}
				{/each}
			</div>
		{/if}
	</div>
</li>
