<script lang="ts">
  import Workspace from '../../../src/svelte/Workspace.svelte'; import type { WorkspaceController } from '../../../src/core'; import type { AdapterScreen } from '../../../src/svelte/context.svelte';
  let { controller }: { controller: WorkspaceController<AdapterScreen, { made: number }> } = $props();
</script>
{#snippet pendingTab(id: string)}Opening {id}{/snippet}
<h1>Dynamic Svelte</h1>
<Workspace {controller} slots={{ pendingTab }} />
