<script lang="ts">
	export let error: Error = null;
</script>

<div class="todo-list-error">
	<p>Oh no, something went wrong!</p>
	<code>{error}</code>
</div>
