<script lang="ts">
  import { Tabs } from '@ark-ui/svelte/tabs'; import { providePage, useParts } from './context.svelte';
  let { id }: { id: string } = $props(); const c = useParts(); const Screen = $derived(c.screen(id).component);
  providePage({ get id() { return id; }, active: () => c.state.activeId === id });
</script>
<Tabs.Content value={id} data-workspace-part="panel" class={c.cls('panel')} style={c.state.activeId !== id ? 'display:none' : undefined} hidden={c.state.activeId !== id} inert={c.state.activeId !== id}><Screen /></Tabs.Content>
