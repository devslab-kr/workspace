<script lang="ts">import { useParts } from './context.svelte'; import WorkspacePanel from './WorkspacePanel.svelte'; const c = useParts();</script>
{#each c.state.tabs as tab (tab.instance)}<WorkspacePanel id={tab.id} />{:else}
  {#if c.props.slots?.empty}{@render c.props.slots.empty()}{:else}<p>{c.labels.empty}</p>{/if}
{/each}
