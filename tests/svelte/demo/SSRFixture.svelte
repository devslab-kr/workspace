<script lang="ts">
  import Workspace from '../../../src/svelte/Workspace.svelte'; import Page from './Page.svelte'; import type { WorkspaceController } from '../../../src/core'; import type { AdapterScreen, WorkspaceScreen } from '../../../src/svelte/context.svelte';
  let { controller, screens = [{ id: 'orders', title: 'Orders', component: Page }, { id: 'customers', title: 'Customers', component: Page }] }: { controller?: WorkspaceController<AdapterScreen, any>; screens?: WorkspaceScreen[] } = $props();
</script>
{#if controller}<Workspace {screens} {controller} />{:else}<Workspace {screens} defaultScreen="orders" />{/if}
