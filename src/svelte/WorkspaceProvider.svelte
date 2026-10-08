<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import WorkspaceRoot from './WorkspaceRoot.svelte';
  import { LocaleProvider } from '@ark-ui/svelte/locale';
  import { createWorkspace } from '../core';
  import { defaultLabels, matches, provideWorkspace, type WorkspaceContext, type WorkspacePart, type WorkspaceProps } from './context.svelte';
  let props: WorkspaceProps = $props();
  // Registry and controller belong to this mounted workspace identity.
  const initialProps = untrack(() => props);
  const api = initialProps.controller ?? createWorkspace(initialProps);
  const registry = new Map(initialProps.screens.map(screen => [screen.id, screen]));
  if (registry.size !== initialProps.screens.length || api.getScreens().length !== registry.size || api.getScreens().some(screen => !registry.has(screen.id))) throw new Error('Controller and component screen registries must match');
  if (initialProps.menus?.some(menu => !registry.has(menu.id))) throw new Error('Menu references an unknown screen');
  let snapshot = $state(api.getSnapshot()); let status = $state(''); let root = $state<Element | null>(null);
  let direction = $state<'ltr' | 'rtl'>('ltr'); let opener: HTMLElement | undefined;
  const instanceId = $props.id(); const prefix = `ws-${instanceId}`;
  onDestroy(api.subscribe(next => { snapshot = next; }));
  const labels = () => ({ ...defaultLabels, ...props.labels });
  const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  async function run(task: ReturnType<typeof api.open>, focus = false) {
    try { const result = await task; props.onResult?.(result); status = result === 'limit' ? labels().limit : result === 'denied' || result === 'cancelled' ? labels().denied : ''; if (result === 'ok' && focus) { await tick(); root?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(); } return result; }
    catch (error) { status = labels().error; props.onError?.(error); }
  }
  function showSwitcher() { opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; api.showSwitcher(); }
  const context: WorkspaceContext = { api, get state() { return snapshot; }, get props() { return props; }, get labels() { return labels(); }, get status() { return status; }, screen: id => registry.get(id)!, cls, run, showSwitcher, root: () => (root ?? undefined) as HTMLElement | undefined, opener: () => opener, prefix };
  provideWorkspace(context);
  onMount(() => {
    if (!root) return;
    const element = root as HTMLElement; let composing = false;
    const updateDirection = () => { direction = getComputedStyle(element.parentElement ?? element).direction === 'rtl' ? 'rtl' : 'ltr'; };
    updateDirection(); const observer = new MutationObserver(updateDirection); observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['dir'] });
    if (props.defaultScreen) void run(api.open(props.defaultScreen));
    function keydown(event: KeyboardEvent) {
      if (props.shortcuts === false || composing || event.isComposing || event.keyCode === 229 || event.repeat || event.defaultPrevented || snapshot.switcherOpen) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[role="alertdialog"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const config = typeof props.shortcuts === 'object' ? props.shortcuts : undefined;
      if (matches(event, config?.switcher ?? 'Alt+q')) { event.preventDefault(); showSwitcher(); }
      else { const tab = snapshot.tabs.find(tab => matches(event, config?.slots ? config.slots[tab.slot - 1] : tab.slot <= 9 ? `Alt+${tab.slot}` : false)); if (tab) { event.preventDefault(); void run(api.select(tab.id), true); } }
    }
    const start = () => { composing = true; }; const end = () => { composing = false; };
    element.addEventListener('keydown', keydown); element.addEventListener('compositionstart', start); element.addEventListener('compositionend', end);
    return () => { observer.disconnect(); element.removeEventListener('keydown', keydown); element.removeEventListener('compositionstart', start); element.removeEventListener('compositionend', end); };
  });
</script>
<LocaleProvider locale={(props.dir ?? direction) === 'rtl' ? 'ar' : 'en'}>
<WorkspaceRoot bind:ref={root} dir={props.dir ?? direction}>
  {@render props.children?.()}
</WorkspaceRoot>
</LocaleProvider>
