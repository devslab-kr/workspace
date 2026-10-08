<script lang="ts">
  import type { WorkspaceProps } from './context.svelte'; import WorkspaceProvider from './WorkspaceProvider.svelte'; import WorkspaceMenu from './WorkspaceMenu.svelte'; import WorkspaceTabList from './WorkspaceTabList.svelte'; import WorkspacePanels from './WorkspacePanels.svelte'; import WorkspaceStatus from './WorkspaceStatus.svelte'; import WorkspaceSwitcher from './WorkspaceSwitcher.svelte'; import WorkspaceSwitcherTrigger from './WorkspaceSwitcherTrigger.svelte';
  let props: WorkspaceProps = $props();
</script>
<WorkspaceProvider {...props}>
  {@render props.children?.()}
  {#if props.menu !== false}<WorkspaceMenu />{/if}
  <div class={props.unstyled ? props.classNames?.toolbar : `workspace-toolbar ${props.classNames?.toolbar ?? ''}`}><WorkspaceSwitcherTrigger /><WorkspaceTabList /></div>
  <WorkspaceStatus /><WorkspacePanels /><WorkspaceSwitcher />
</WorkspaceProvider>
