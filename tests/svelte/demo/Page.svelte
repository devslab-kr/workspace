<script lang="ts">
  import { onMount } from 'svelte'; import { useWorkspacePage, useActiveEffect } from '../../../src/svelte/context.svelte';
  const page = useWorkspacePage(); let count = $state(0); let active = $state(false);
  onMount(() => { window.dispatchEvent(new CustomEvent('page-mounted', { detail: page.id })); return () => window.dispatchEvent(new CustomEvent('page-destroyed', { detail: page.id })); });
  useActiveEffect(() => { active = true; return () => { active = false; }; });
</script>
<h2>{page.id} page</h2><label>Saved input <input aria-label={`${page.id} input`} /></label>
<button onclick={() => count++}>Count {count}</button><p>Activity {active ? 'active' : 'inactive'}</p>
