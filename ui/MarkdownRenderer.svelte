<script lang="ts">
	import { MarkdownRenderer } from "obsidian";
	import { onMount } from "svelte";
	import { contentStore } from "./ContentStore";
	import { writable } from "svelte/store";

	export let eventId: string;
	let content: string;
	$: content;

	let clazz: string | undefined = undefined;
	export { clazz as class };

	let containerEl: HTMLDivElement;

	async function renderMarkdown() {
		if (!containerEl) return; // 判断 containerEl 是否已绑定完成
		containerEl.innerHTML = "";

		await MarkdownRenderer.renderMarkdown(content, containerEl, "", null);

		if (containerEl.childElementCount > 1) {
			return;
		}
		const markdownContent = containerEl.querySelector("p");
		if (markdownContent) {
			markdownContent.parentElement.removeChild(markdownContent);
			containerEl.innerHTML = markdownContent.innerHTML;
		}
	}

	onMount(async () => {
		if (
			!contentStore.has(eventId) ||
			contentStore.get(eventId) == undefined ||
			contentStore.get(eventId!) == null
		) {
			contentStore.set(eventId, writable("None"));
		}
		let ct = contentStore.get(eventId);
		if (ct !== undefined) {
			ct.subscribe(async (value) => {
				content = value;
				await renderMarkdown();
			});
		}
	});
</script>

<div bind:this={containerEl} class={clazz} />
