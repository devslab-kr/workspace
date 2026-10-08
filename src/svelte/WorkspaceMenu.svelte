<script lang="ts">import { useParts } from './context.svelte'; const c = useParts();</script>
<nav data-workspace-part="menu" aria-label={c.labels.menu} class={c.cls('menu')}>
  {#if c.props.slots?.menu}{@render c.props.slots.menu(c.api)}{:else}
    {#each c.props.menus ?? c.props.screens.map(screen => ({ id: screen.id, label: screen.title })) as menu (menu.id)}
      <button type="button" onclick={() => void c.run(c.api.open(menu.id))}>{menu.label ?? c.screen(menu.id).title}</button>
    {/each}
  {/if}
</nav>
