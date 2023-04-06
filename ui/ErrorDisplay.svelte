<script lang="ts">
	export let error: Error = null;
</script>

<div class="calendar-sync-error">
	<p>Oh no, something went wrong!</p>
	<code>{error}</code>
</div>
