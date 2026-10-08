<script lang="ts">
  import type { Snippet, ComponentProps } from 'svelte';
  import { Tabs } from '@ark-ui/svelte/tabs'; import { useParts } from './context.svelte';
  let { id, children, asChild, ref = $bindable(null), ...rest }: { id: string; children?: Snippet } & Omit<ComponentProps<typeof Tabs.Trigger>, 'id' | 'value' | 'children'> = $props();
  const c = useParts();
  function keydown(event: KeyboardEvent) { rest.onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }); if (!event.defaultPrevented && event.key === 'Delete' && !event.isComposing) { event.preventDefault(); void c.run(c.api.close(id), true); } }
</script>
<Tabs.Trigger {...rest} value={id} {asChild} bind:ref class={[c.cls('tab'), rest.class].filter(Boolean).join(' ')} data-workspace-part="tab" onkeydown={keydown}>
  {#if children}{@render children()}{:else if c.props.slots?.tabLabel}{@render c.props.slots.tabLabel(c.screen(id), c.state.tabs.find(tab => tab.id === id)!)}{:else}{c.screen(id).title}{/if}
</Tabs.Trigger>
