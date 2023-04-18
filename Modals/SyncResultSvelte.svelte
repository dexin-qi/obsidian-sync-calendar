<script lang="ts">
	export let resDescs: string[];
</script>

<div>
	<!-- {#each resDescs as desc} -->
	<pre>{resDescs.join("\n")}</pre>
	<!-- <br /> -->
	<!-- {/each} -->
</div>
