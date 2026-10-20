<script lang="ts">
  import { untrack } from 'svelte'; import type { Tab } from '../core';
  import { Tabs } from '@ark-ui/svelte/tabs'; import { providePage, useParts } from './context.svelte';
  let { tab }: { tab: Tab<any> } = $props(); const c = useParts();
  // One page instance: its id, data and component are captured once, so a re-registration never remounts it.
  const { id, data } = untrack(() => tab); const Screen = untrack(() => c.screen(id)?.component);
  providePage({ id, active: () => c.state.activeId === id, data, screen: () => c.screen(id) });
</script>
<Tabs.Content value={id} data-workspace-part="panel" class={c.cls('panel')} style={c.state.activeId !== id ? 'display:none' : undefined} hidden={c.state.activeId !== id} inert={c.state.activeId !== id}>{#if Screen}<Screen />{/if}</Tabs.Content>
