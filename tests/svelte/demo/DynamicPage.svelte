<script lang="ts">
  import { onDestroy, onMount } from 'svelte'; import { useWorkspacePage } from '../../../src/svelte/context.svelte';
  const drafts: Record<string, string> = { '/orders 1 한국': 'Orders draft', '/customers': 'Customers draft', '/reports': 'Reports draft' };
  const page = useWorkspacePage<{ made: number }>(); const events = (window as any).events;
  onMount(() => { events.mounted++; }); onDestroy(() => { events.cleaned++; });
</script>
<label>{drafts[page.id]}<input aria-label={drafts[page.id]} /></label><p data-made>{page.data.made}</p>
