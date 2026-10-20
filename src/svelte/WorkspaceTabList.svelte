<script lang="ts">
  import type { Snippet } from 'svelte'; import { Tabs } from '@ark-ui/svelte/tabs';
  import { useParts } from './context.svelte'; import WorkspaceTab from './WorkspaceTab.svelte'; import WorkspaceCloseButton from './WorkspaceCloseButton.svelte';
  let { children }: { children?: Snippet } = $props(); const c = useParts();
  // The pending placeholder shows only with a pendingTab slot, while a check runs for an id that has no tab yet.
  const pending = $derived(c.props.slots?.pendingTab && c.state.pendingId !== undefined && !c.state.tabs.some(tab => tab.id === c.state.pendingId) ? c.state.pendingId : undefined);
</script>
{#if children}<Tabs.List data-workspace-part="tabs" aria-label={c.labels.tabs} class={c.cls('tabs')}>{@render children()}</Tabs.List>{:else}
  <div class={c.cls('tabs')} data-workspace-part="tab-strip" style="display:grid;grid-auto-columns:max-content;overflow-x:auto">
    <Tabs.List data-workspace-part="tabs" aria-label={c.labels.tabs} style="display:contents">
      {#each c.state.tabs as tab, index (tab.instance)}<WorkspaceTab id={tab.id} style={`grid-column:${index * 2 + 1};grid-row:1`} />{/each}
    </Tabs.List>
    {#each c.state.tabs as tab, index (tab.instance)}<WorkspaceCloseButton id={tab.id} style={`grid-column:${index * 2 + 2};grid-row:1`} />{/each}
    {#if pending !== undefined && c.props.slots?.pendingTab}<span data-workspace-part="pending" aria-busy="true" class={c.cls('pending')} style={`grid-column:${c.state.tabs.length * 2 + 1};grid-row:1`}>{@render c.props.slots.pendingTab(pending)}</span>{/if}
  </div>
{/if}
