<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import WorkspaceRoot from './WorkspaceRoot.svelte';
  import { LocaleProvider } from '@ark-ui/svelte/locale';
  import { createWorkspace, type WorkspaceController } from '../core';
  import { defaultLabels, matches, provideWorkspace, type AdapterScreen, type WorkspaceContext, type WorkspacePart, type WorkspaceProps, type WorkspaceScreen } from './context.svelte';
  let props: WorkspaceProps = $props();
  // The controller and the `screens` prop belong to this mounted workspace identity; screens change through the controller (`register`).
  const initialProps = untrack(() => props);
  const api: WorkspaceController<AdapterScreen, any> = initialProps.controller ?? createWorkspace<AdapterScreen, any>(initialProps);
  const components = new Map((initialProps.screens ?? []).map(screen => [screen.id, screen.component]));
  const fallbackTitles = new Map((initialProps.screens ?? []).map(screen => [screen.id, screen.title]));
  let snapshot = $state(api.getSnapshot()); let status = $state(''); let root = $state<Element | null>(null);
  let direction = $state<'ltr' | 'rtl'>('ltr'); let opener: HTMLElement | undefined;
  const instanceId = $props.id(); const prefix = `ws-${instanceId}`;
  // Subscribed during initialization, so a child that registers in its own initialization is seen by the parts after it.
  // Svelte's server renderer runs onDestroy once the render finishes, so a server render leaves no listener on a shared controller.
  onDestroy(api.subscribe(next => { snapshot = next; }));
  const labels = () => ({ ...defaultLabels, ...props.labels });
  const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  // Focus returns to the tab list after a command unless the user moved into the shown page; a close also refocuses on its immediate commit.
  async function restoreFocus(onlyIfLost = false) { await tick(); const element = root; if (!element) return; const focused = document.activeElement; if (onlyIfLost ? focused && focused !== document.body : focused instanceof HTMLElement && element.contains(focused) && focused.closest('[data-workspace-part="panel"]:not([hidden])')) return; (element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? element.querySelector<HTMLElement>('[role="tab"]'))?.focus(); }
  async function run(task: ReturnType<typeof api.open>, focus = false) {
    const stop: (() => void) | undefined = focus ? api.subscribe(() => { stop?.(); void restoreFocus(); }) : undefined;
    try { const result = await task; props.onResult?.(result); status = result === 'limit' ? labels().limit : result === 'denied' || result === 'cancelled' ? labels().denied : ''; if ((result === 'ok' || result === 'denied') && focus) await restoreFocus(result === 'denied'); return result; }
    catch (error) { status = labels().error; props.onError?.(error); }
    finally { stop?.(); }
  }
  function showSwitcher() { opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; api.showSwitcher(); }
  /** The controller's live definition with its component, else the same id's component from the `screens` prop. */
  function screen(id: string): WorkspaceScreen | undefined {
    const definition = snapshot.screens.find(screen => screen.id === id); if (!definition) return undefined;
    if (definition.component) return definition as WorkspaceScreen;
    const component = components.get(id); return component ? { ...definition, component } : undefined;
  }
  const title = (id: string) => snapshot.screens.find(screen => screen.id === id)?.title ?? fallbackTitles.get(id) ?? id;
  const slot = (id: string) => snapshot.tabs.find(tab => tab.id === id)?.slot ?? 0;
  const context: WorkspaceContext = { api, get state() { return snapshot; }, get props() { return props; }, get labels() { return labels(); }, get status() { return status; }, screen, title, slot, cls, run, showSwitcher, root: () => (root ?? undefined) as HTMLElement | undefined, opener: () => opener, prefix };
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
