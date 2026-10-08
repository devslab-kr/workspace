<script lang="ts">
  import Workspace from '../../../src/svelte/Workspace.svelte'; import Page from './Page.svelte'; import { createWorkspace } from '../../../src/core';
  const screens = [{ id: 'orders', title: 'Orders', component: Page }, { id: 'customers', title: 'Customers', component: Page }];
  let denied = $state(false);
  const controller = createWorkspace({ screens, beforeActivate: id => !(denied && id === 'customers') });
</script>
<h1>Svelte Workspace</h1><button onclick={() => controller.reset()}>Reset workspace</button>
<button onclick={() => { denied = !denied; }}>{denied ? 'Allow customers' : 'Deny customers'}</button>
<button onclick={() => { controller.reset(); void controller.open('orders'); }}>Reset and reopen orders</button>
<Workspace {screens} {controller} classNames={{ tab: 'custom-tab', panel: 'custom-panel' }} />
<style>:global(.custom-panel) { display: flex; }</style>
