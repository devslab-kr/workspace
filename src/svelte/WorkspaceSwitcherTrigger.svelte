<script lang="ts">
  import type { Snippet, ComponentProps } from 'svelte'; import type { HTMLButtonAttributes } from 'svelte/elements'; import { Ark } from '@ark-ui/svelte/factory'; import { Tabs } from '@ark-ui/svelte/tabs'; import { useParts } from './context.svelte';
  let { children, asChild, ref = $bindable(null), ...rest }: { children?: Snippet; asChild?: ComponentProps<typeof Tabs.Trigger>['asChild']; ref?: Element | null } & Omit<HTMLButtonAttributes, 'children'> = $props(); const c = useParts();
  function open(event: MouseEvent) { rest.onclick?.(event as MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }); if (!event.defaultPrevented) c.showSwitcher(); }
</script>
<Ark as="button" {...rest} {asChild} bind:ref type="button" aria-haspopup="dialog" disabled={!c.state.tabs.length || rest.disabled} data-workspace-part="switcher-trigger" onclick={open}>{#if children}{@render children()}{:else}{c.labels.switcher}{/if}</Ark>
