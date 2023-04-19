<script lang="ts">
	import { Menu, Notice, MarkdownRenderer } from "obsidian";
	import type SyncCalendarPluginSettings from "main";
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";

	import type { Todo } from "../TodoSerialization/Todo";
	// import TaskList from "./TaskList.svelte";

	export let onClickTask: (task: Todo) => Promise<void>;
	export let todo: Todo;
	export let settings: SyncCalendarPluginSettings;

	$: disable = false;

	let taskContentEl: HTMLDivElement;

	onMount(async () => {
		await renderMarkdown(todo.content!);
	});

	async function renderMarkdown(content: string): Promise<void> {
		// Escape leading '#' or '-' so they aren't rendered as headers/bullets.
		if (content.startsWith("#") || content.startsWith("-")) {
			content = `\\${content}`;
		}

		// A task starting with '*' signifies that it cannot be completed, so we should strip it from the front of the task.
		if (content.startsWith("*")) {
			content = content.substring(1);
		}

		await MarkdownRenderer.renderMarkdown(content, taskContentEl, "", null);

		// Remove the wrapping '<p>' tag to force it to inline.
		const markdownContent = taskContentEl.querySelector("p");

		if (markdownContent) {
			markdownContent.parentElement.removeChild(markdownContent);
			taskContentEl.innerHTML += markdownContent.innerHTML;
		}
	}

	// For some reason, the Todoist API returns priority in reverse order from
	// the p1/p2/p3/p4 fluent entry notation.
	function getPriorityClass(priority: null | undefined | string): string {
		if (priority === null || priority === undefined || priority === " ") {
			return "todoist-p4";
		}
		if (priority === "🔽") {
			return "todoist-p3";
		}
		if (priority === "🔼") {
			return "todoist-p2";
		}
		if (priority === "⏫") {
			return "todoist-p1";
		}
		return "todoist-p4";
	}

	function onClickTaskContainer(evt: MouseEvent) {
		evt.stopPropagation();
		evt.preventDefault();

		console.log("show todo's details");

		new Menu()
			.addItem((menuItem) =>
				menuItem
					.setTitle("Delete todo")
					.setIcon("popup-open")
					.onClick(() => {})
			)
			.addItem((menuItem) =>
				menuItem
					.setTitle("Edit todo in obsidian")
					.setIcon("popup-open")
					.onClick(() => {})
			)
			.addItem((menuItem) =>
				menuItem
					.setTitle("Edit todo in calendar (web)")
					.setIcon("popup-open")
					.onClick(() => {})
			)
			.showAtPosition({
				x: evt.pageX,
				y: evt.pageY,
			});

		// showTaskContext(
		// 	{
		// 		task: todo,
		// 		onClickTask: onClickTask,
		// 	},

		// );
	}
</script>

<li
	on:contextmenu={onClickTaskContainer}
	transition:fade={{ duration: 400 }}
	class="
  task-list-item
  has-time
  {getPriorityClass(todo.priority)} 
  {todo.isOverdue() ? 'task-overdue' : ''}
  "
>
	<div>
		<input
			disabled={disable}
			data-line="1"
			class="task-list-item-checkbox"
			type="checkbox"
			on:click={async () => {
				disable = true;
				await onClickTask(todo);
			}}
		/>
		<div bind:this={taskContentEl} class="todoist-task-content" />
	</div>
	<div class="task-metadata">
		<!--	{#if settings.renderProject && renderProject}
			<div class="task-project">
				{#if settings.renderProjectIcon}
					<svg
						class="task-project-icon"
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
		<!--  -->
		{#if settings.renderDate && todo.startDateTime}
			<div class="task-date {todo.isOverdue() ? 'task-overdue' : ''}">
				<svg
					class="task-calendar-icon"
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
				{todo.startDateTime.format("YYYY-MM-DD")}
			</div>
		{/if}
		{#if settings.renderTags && todo.tags !== undefined && todo.tags?.length > 0}
			<div class="task-labels">
				<svg
					class="task-labels-icon"
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
					{tag}{#if i != todo.tags.length - 1},{/if}
				{/each}
			</div>
		{/if}
	</div>
	<!-- {#if todo.children.length != 0}
		<TaskList
			tasks={todo.children}
			{settings}
			{api}
			{sorting}
			{renderProject}
		/>
	{/if} -->
</li>
