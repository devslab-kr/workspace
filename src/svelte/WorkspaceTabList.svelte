<script lang="ts">
  import type { Snippet } from 'svelte'; import { Tabs } from '@ark-ui/svelte/tabs';
  import { useParts } from './context.svelte'; import WorkspaceTab from './WorkspaceTab.svelte'; import WorkspaceCloseButton from './WorkspaceCloseButton.svelte';
  let { children }: { children?: Snippet } = $props(); const c = useParts();
</script>
{#if children}<Tabs.List data-workspace-part="tabs" aria-label={c.labels.tabs} class={c.cls('tabs')}>{@render children()}</Tabs.List>{:else}
  <div class={c.cls('tabs')} data-workspace-part="tab-strip" style="display:grid;grid-auto-columns:max-content;overflow-x:auto">
    <Tabs.List data-workspace-part="tabs" aria-label={c.labels.tabs} style="display:contents">
      {#each c.state.tabs as tab, index (tab.instance)}<WorkspaceTab id={tab.id} style={`grid-column:${index * 2 + 1};grid-row:1`} />{/each}
    </Tabs.List>
    {#each c.state.tabs as tab, index (tab.instance)}<WorkspaceCloseButton id={tab.id} style={`grid-column:${index * 2 + 2};grid-row:1`} />{/each}
  </div>
{/if}
