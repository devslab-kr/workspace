<script lang="ts">
  import type { Snippet } from 'svelte'; import { Dialog } from '@ark-ui/svelte/dialog'; import { Portal } from '@ark-ui/svelte/portal'; import { useParts } from './context.svelte';
  let { children }: { children?: Snippet } = $props(); const c = useParts();
  function initialFocus() { return document.getElementById(`${c.prefix}-choice-${c.state.activeId}`); }
  function finalFocus() { const opener = c.opener(); return opener?.isConnected && !opener.closest('[hidden],[inert]') ? opener : c.root()?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? c.root() ?? null; }
  function navigate(event: KeyboardEvent) {
    if (event.isComposing) return;
    const items = Array.from((event.currentTarget as HTMLElement).parentElement!.querySelectorAll<HTMLButtonElement>('[data-workspace-choice]')); const index = items.indexOf(event.target as HTMLButtonElement); if (index < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % items.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + items.length - 1) % items.length : -1;
    if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
  }
</script>
<Dialog.Root id={`${c.prefix}-switcher`} open={c.state.switcherOpen} onOpenChange={details => details.open ? c.api.showSwitcher() : c.api.hideSwitcher()} initialFocusEl={initialFocus} finalFocusEl={finalFocus} modal trapFocus preventScroll lazyMount unmountOnExit>
  <Portal container={c.root()}><Dialog.Backdrop class={c.cls('overlay')} /><Dialog.Positioner class={c.cls('positioner')}><Dialog.Content class={c.cls('switcher')} data-workspace-part="switcher">
    <Dialog.Title>{c.labels.switcher}</Dialog.Title><Dialog.Description>{c.labels.tabs}</Dialog.Description>
    <div role="status" aria-live="polite" data-workspace-part="status" class={c.cls('status')}>{c.status}</div>
    {#if children}{@render children()}{:else}
      <div class={c.cls('choices')} role="group" aria-label={c.labels.tabs}>
        {#each c.state.tabs as tab (tab.id)}
          <button type="button" data-workspace-choice id={`${c.prefix}-choice-${tab.id}`} aria-current={c.state.activeId === tab.id ? 'true' : undefined} onkeydown={navigate} onclick={() => void c.run(c.api.select(tab.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); })}>
            {#if c.props.slots?.preview}<div aria-hidden="true" inert>{@render c.props.slots.preview(c.screen(tab.id))}</div>{/if}
            {#if c.props.slots?.switcherItem}{@render c.props.slots.switcherItem(c.screen(tab.id), tab)}{:else}{c.screen(tab.id).title}{/if}
          </button>
        {/each}
      </div>
    {/if}
    <Dialog.CloseTrigger>{c.labels.dismiss}</Dialog.CloseTrigger>
  </Dialog.Content></Dialog.Positioner></Portal>
</Dialog.Root>
