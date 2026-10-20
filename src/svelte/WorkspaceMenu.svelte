<script lang="ts">import { useParts, type WorkspaceMenu } from './context.svelte'; const c = useParts();</script>
<nav data-workspace-part="menu" aria-label={c.labels.menu} class={c.cls('menu')}>
  {#if c.props.slots?.menu}{@render c.props.slots.menu(c.api)}{:else}
    {#each c.props.menus ?? (c.props.screens?.length ? c.props.screens : c.state.screens).map((screen): WorkspaceMenu => ({ id: screen.id })) as menu (menu.id)}
      <button type="button" onclick={() => void c.run(c.api.open(menu.id))}>{menu.label ?? c.title(menu.id)}</button>
    {/each}
  {/if}
</nav>
