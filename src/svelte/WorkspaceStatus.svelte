<script lang="ts">import { useParts } from './context.svelte'; const c = useParts();</script>
<div role="status" aria-live="polite" hidden={c.state.switcherOpen} data-workspace-part="status" class={c.cls('status')}>{c.status}</div>
