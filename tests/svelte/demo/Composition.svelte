<script lang="ts">
  import WorkspaceProvider from '../../../src/svelte/WorkspaceProvider.svelte'; import WorkspaceTabList from '../../../src/svelte/WorkspaceTabList.svelte'; import WorkspaceTab from '../../../src/svelte/WorkspaceTab.svelte'; import WorkspaceCloseButton from '../../../src/svelte/WorkspaceCloseButton.svelte'; import WorkspaceSwitcherTrigger from '../../../src/svelte/WorkspaceSwitcherTrigger.svelte'; import WorkspaceSwitcher from '../../../src/svelte/WorkspaceSwitcher.svelte'; import WorkspacePanels from '../../../src/svelte/WorkspacePanels.svelte'; import Page from './Page.svelte';
  const screens = [{ id: 'orders', title: 'Orders', component: Page }]; let tabRef = $state<Element | null>(null); let closeRef = $state<Element | null>(null); let triggerRef = $state<Element | null>(null); let clicks = $state(0);
</script>
<h1>Composition fixture</h1><p data-testid="refs">{tabRef && closeRef && triggerRef ? 'ready' : 'waiting'}</p><p data-testid="clicks">{clicks}</p>
<WorkspaceProvider {screens} defaultScreen="orders" classNames={{ tab: 'custom-tab' }}>
  <WorkspaceTabList><WorkspaceTab id="orders" bind:ref={tabRef}>
    {#snippet asChild(props)}<button {...props({ onclick: () => clicks++ })} data-testid="custom-tab">Custom orders</button>{/snippet}
  </WorkspaceTab></WorkspaceTabList>
  <WorkspaceCloseButton id="orders" bind:ref={closeRef}>
    {#snippet asChild(props)}<button {...props({ onclick: () => clicks++ })} data-testid="custom-close">Custom close</button>{/snippet}
  </WorkspaceCloseButton>
  <WorkspaceSwitcherTrigger bind:ref={triggerRef}>
    {#snippet asChild(props)}<button {...props({ onclick: () => clicks++ })} data-testid="custom-trigger">Custom switcher</button>{/snippet}
  </WorkspaceSwitcherTrigger>
  <WorkspacePanels /><WorkspaceSwitcher />
</WorkspaceProvider>
