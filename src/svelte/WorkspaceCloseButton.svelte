<script lang="ts">
  import type { Snippet, ComponentProps } from 'svelte'; import type { HTMLButtonAttributes } from 'svelte/elements'; import { Ark } from '@ark-ui/svelte/factory'; import { Tabs } from '@ark-ui/svelte/tabs'; import { useParts } from './context.svelte';
  let { id, children, asChild, ref = $bindable(null), ...rest }: { id: string; children?: Snippet; asChild?: ComponentProps<typeof Tabs.Trigger>['asChild']; ref?: Element | null } & Omit<HTMLButtonAttributes, 'id' | 'children'> = $props(); const c = useParts();
  // Reading the snapshot makes the home rule re-evaluate whenever the tabs change.
  const closable = $derived.by(() => { void c.state; return c.api.canClose(id); });
  function close(event: MouseEvent) { rest.onclick?.(event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }); if (!event.defaultPrevented) void c.run(c.api.close(id), true); }
</script>
<Ark as="button" {...rest} {asChild} bind:ref type="button" disabled={rest.disabled || !closable} data-workspace-part="close" data-active={c.state.activeId === id} class={[c.cls('close'), rest.class].filter(Boolean).join(' ')} aria-label={c.labels.close(c.title(id))} onclick={close}>{#if children}{@render children()}{:else}×{/if}</Ark>
