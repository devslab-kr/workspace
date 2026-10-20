<script lang="ts">
  import type { Snippet, ComponentProps } from 'svelte';
  import { Tabs } from '@ark-ui/svelte/tabs'; import { useParts } from './context.svelte';
  let { id, children, asChild, ref = $bindable(null), ...rest }: { id: string; children?: Snippet } & Omit<ComponentProps<typeof Tabs.Trigger>, 'id' | 'value' | 'children'> = $props();
  const c = useParts(); const screen = $derived(c.screen(id)); const tab = $derived(c.state.tabs.find(tab => tab.id === id));
  // A tab that cannot close (the home screen as the last tab) ignores Delete instead of reporting a cancelled transition.
  function keydown(event: KeyboardEvent) { rest.onkeydown?.(event as KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }); if (!event.defaultPrevented && event.key === 'Delete' && !event.isComposing) { event.preventDefault(); if (c.api.canClose(id)) void c.run(c.api.close(id), true); } }
</script>
<Tabs.Trigger {...rest} {...(!c.state.activeId && c.state.tabs[0]?.id === id ? { tabindex: 0 } : {})} value={id} {asChild} bind:ref aria-busy={c.state.pendingId === id ? 'true' : rest['aria-busy']} class={[c.cls('tab'), rest.class].filter(Boolean).join(' ')} data-workspace-part="tab" onkeydown={keydown}>
  {#if children}{@render children()}{:else if c.props.slots?.tabLabel && screen && tab}{@render c.props.slots.tabLabel(screen, tab)}{:else}{c.title(id)}{/if}
</Tabs.Trigger>
