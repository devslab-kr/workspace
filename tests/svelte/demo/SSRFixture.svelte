<script lang="ts">
  import Workspace from '../../../src/svelte/Workspace.svelte'; import Page from './Page.svelte'; import type { WorkspaceController } from '../../../src/core';
  let { controller }: { controller?: WorkspaceController } = $props();
  const screens = [{ id: 'orders', title: 'Orders', component: Page }, { id: 'customers', title: 'Customers', component: Page }];
</script>
{#if controller}<Workspace {screens} {controller} />{:else}<Workspace {screens} defaultScreen="orders" />{/if}
