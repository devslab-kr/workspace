<script lang="ts">
  import type { Snippet } from 'svelte'; import { Tabs, useTabs } from '@ark-ui/svelte/tabs'; import { useParts } from './context.svelte';
  let { ref = $bindable(null), children, dir }: { ref?: Element | null; children?: Snippet; dir: 'ltr' | 'rtl' } = $props();
  const c = useParts();
  // RootProvider keeps activation controlled through the async core guard.
  // Tabs.Root locally updates its bindable value before the guard resolves.
  const tabs = useTabs(() => ({ id: c.prefix, value: c.state.activeId ?? '', activationMode: 'manual', onValueChange: details => void c.run(c.api.select(details.value)) }));
</script>
<Tabs.RootProvider bind:ref value={tabs} {dir} lazyMount={false} unmountOnExit={false} class={[c.cls('root'), c.props.class].filter(Boolean).join(' ')} data-workspace-part="root">{@render children?.()}</Tabs.RootProvider>
