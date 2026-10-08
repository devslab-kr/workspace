import { Dialog } from '@ark-ui/solid/dialog';
import { Tabs } from '@ark-ui/solid/tabs';
import { LocaleProvider } from '@ark-ui/solid/locale';
import { ark } from '@ark-ui/solid/factory';
import { Dynamic, Portal } from 'solid-js/web';
import { createContext, createEffect, createSignal, createUniqueId, For, mergeProps, onCleanup, onMount, Show, splitProps, useContext, type Accessor, type Component, type JSX } from 'solid-js';
import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type Tab, type WorkspaceController } from './core';

export interface WorkspaceScreen extends Screen { component: Component; }
export interface WorkspaceMenu { id: string; label?: string }
export interface PageActivity { id: string; active: Accessor<boolean> }
const PageContext = createContext<PageActivity>();
export interface WorkspaceLabels {
  menu: string; tabs: string; switcher: string; close: (title: string) => string;
  dismiss: string; empty: string; limit: string; denied: string; error: string;
}
const defaults: WorkspaceLabels = {
  menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`,
  dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached',
  denied: 'Screen transition cancelled', error: 'Screen transition failed',
};
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  screens: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenu[]; menu?: boolean;
  children?: JSX.Element; class?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: {
    menu?: (api: WorkspaceController) => JSX.Element;
    tabLabel?: (screen: WorkspaceScreen, tab: Tab) => JSX.Element;
    switcherItem?: (screen: WorkspaceScreen, tab: Tab) => JSX.Element;
    preview?: (screen: WorkspaceScreen) => JSX.Element; empty?: () => JSX.Element;
  };
}
type Standalone = Omit<Options, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
interface WorkspaceContext {
  api: WorkspaceController; state: Accessor<Snapshot>; props: WorkspaceProps;
  screen: (id: string) => WorkspaceScreen; labels: Accessor<WorkspaceLabels>;
  run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>;
  status: Accessor<string>; cls: (part: WorkspacePart) => string | undefined;
  root: () => HTMLDivElement; opener: () => HTMLElement | undefined;
  showSwitcher: () => void; prefix: string;
}
const Context = createContext<WorkspaceContext>();
function useParts() { const value = useContext(Context); if (!value) throw new Error('Workspace parts require WorkspaceProvider'); return value; }
export function useWorkspace() { return useParts().api; }
export function useWorkspaceState() { return useParts().state; }
export function useWorkspacePage() { const value = useContext(PageContext); if (!value) throw new Error('useWorkspacePage requires a workspace screen'); return value; }
export function useActiveEffect(effect: () => void | (() => void)) {
  const page = useWorkspacePage();
  createEffect(() => { if (page.active()) { const cleanup = effect(); if (cleanup) onCleanup(cleanup); } });
}
function matches(event: KeyboardEvent, shortcut: string | false | undefined) {
  if (!shortcut) return false;
  const keys = shortcut.toLowerCase().split('+');
  return event.key.toLowerCase() === keys.at(-1) && event.altKey === keys.includes('alt') && event.ctrlKey === keys.includes('ctrl') && event.metaKey === keys.includes('meta') && event.shiftKey === keys.includes('shift');
}
/** Registry/options are construction-time. Remount for a new app identity. */
export function WorkspaceProvider(props: WorkspaceProps) {
  const api = props.controller ?? createWorkspace(props);
  const registry = new Map(props.screens.map(screen => [screen.id, screen]));
  if (registry.size !== props.screens.length || api.getScreens().length !== registry.size || api.getScreens().some(screen => !registry.has(screen.id))) throw new Error('Controller and component screen registries must match');
  if (props.menus?.some(menu => !registry.has(menu.id))) throw new Error('Menu references an unknown screen');
  const [state, setState] = createSignal(api.getSnapshot()); const [status, setStatus] = createSignal('');
  const [direction, setDirection] = createSignal<'ltr' | 'rtl'>('ltr');
  onCleanup(api.subscribe(setState));
  const prefix = `ws-${createUniqueId()}`; const labels = () => ({ ...defaults, ...props.labels });
  const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  let root!: HTMLDivElement; let opener: HTMLElement | undefined; let composing = false;
  async function run(task: Promise<Result>, focus = false) {
    try {
      const result = await task; props.onResult?.(result);
      setStatus(result === 'limit' ? labels().limit : result === 'denied' || result === 'cancelled' ? labels().denied : '');
      if (result === 'ok' && focus) queueMicrotask(() => root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
      return result;
    } catch (error) { setStatus(labels().error); props.onError?.(error); }
  }
  function showSwitcher() { opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; api.showSwitcher(); }
  onMount(() => {
    const updateDirection = () => setDirection(getComputedStyle(root.parentElement ?? root).direction === 'rtl' ? 'rtl' : 'ltr');
    updateDirection(); const observer = new MutationObserver(updateDirection);
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['dir'] }); onCleanup(() => observer.disconnect());
    if (props.defaultScreen) void run(api.open(props.defaultScreen));
    const keydown = (event: KeyboardEvent) => {
      if (props.shortcuts === false || composing || event.isComposing || event.keyCode === 229 || event.repeat || event.defaultPrevented || state().switcherOpen) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[role="alertdialog"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const config = typeof props.shortcuts === 'object' ? props.shortcuts : undefined;
      if (matches(event, config?.switcher ?? 'Alt+q')) { event.preventDefault(); showSwitcher(); }
      else { const tab = state().tabs.find(tab => matches(event, config?.slots ? config.slots[tab.slot - 1] : tab.slot <= 9 ? `Alt+${tab.slot}` : false)); if (tab) { event.preventDefault(); void run(api.select(tab.id), true); } }
    };
    const start = () => { composing = true; }; const end = () => { composing = false; };
    root.addEventListener('keydown', keydown); root.addEventListener('compositionstart', start); root.addEventListener('compositionend', end);
    onCleanup(() => { root.removeEventListener('keydown', keydown); root.removeEventListener('compositionstart', start); root.removeEventListener('compositionend', end); });
  });
  const context: WorkspaceContext = { api, state, props, screen: id => registry.get(id)!, labels, run, status, cls, root: () => root, opener: () => opener, showSwitcher, prefix };
  return <Context.Provider value={context}><LocaleProvider locale={(props.dir ?? direction()) === 'rtl' ? 'ar' : 'en'}>
    <Tabs.Root ref={root} id={prefix} dir={props.dir ?? direction()} value={state().activeId ?? ''} activationMode="manual" onValueChange={details => void run(api.select(details.value))}
      lazyMount={false} unmountOnExit={false} data-workspace-part="root" class={[cls('root'), props.class].filter(Boolean).join(' ')}>{props.children}</Tabs.Root>
  </LocaleProvider></Context.Provider>;
}
export function WorkspaceMenu() {
  const c = useParts(); return <nav data-workspace-part="menu" aria-label={c.labels().menu} class={c.cls('menu')}>
    <Show when={c.props.slots?.menu} fallback={<For each={c.props.menus ?? c.props.screens.map(screen => ({ id: screen.id, label: screen.title }))}>{menu =>
      <button type="button" onClick={() => void c.run(c.api.open(menu.id))}>{menu.label ?? c.screen(menu.id).title}</button>
    }</For>}>{slot => slot()(c.api)}</Show></nav>;
}
export function WorkspaceTabList(props: { children?: JSX.Element }) {
  const c = useParts(); return <Show when={props.children} fallback={<div class={c.cls('tabs')} data-workspace-tab-strip style={{ display: 'grid', 'grid-auto-columns': 'max-content', 'align-items': 'center' }}>
    <Tabs.List data-workspace-part="tabs" aria-label={c.labels().tabs} style={{ display: 'contents' }}><For each={c.state().tabs}>{(tab, index) =>
      <WorkspaceTab id={tab.id} style={{ 'grid-column': index() * 2 + 1, 'grid-row': 1 }} />
    }</For></Tabs.List>
    <For each={c.state().tabs}>{(tab, index) => <WorkspaceCloseButton id={tab.id} style={{ 'grid-column': index() * 2 + 2, 'grid-row': 1 }} />}</For>
  </div>}><Tabs.List data-workspace-part="tabs" aria-label={c.labels().tabs} class={c.cls('tabs')}>{props.children}</Tabs.List></Show>;
}
type ButtonPartProps = Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, 'id'> & { asChild?: (props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => JSX.Element };
// Ark's Solid factory supplies a prop-merging function and omits the parent
// ref. Our public callback receives native attributes with its caller ref.
function childAdapter(child: ButtonPartProps['asChild'], ref: ButtonPartProps['ref']) {
  return child ? (merge: unknown) => child(mergeProps((merge as (props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) => JSX.ButtonHTMLAttributes<HTMLButtonElement>)({}), { ref })) : undefined;
}
function callHandler<E extends Event>(handler: JSX.EventHandlerUnion<HTMLButtonElement, E> | undefined, event: E & { currentTarget: HTMLButtonElement; target: Element }) {
  if (Array.isArray(handler)) handler[0](handler[1], event); else if (typeof handler === 'function') handler(event);
}
export function WorkspaceTab(props: ButtonPartProps & { id: string }) {
  const [local, rest] = splitProps(props, ['id', 'children', 'class', 'onKeyDown', 'asChild']);
  const c = useParts(); const tab = () => c.state().tabs.find(tab => tab.id === props.id)!;
  return <Tabs.Trigger {...rest} value={local.id} class={local.class ?? c.cls('tab')} asChild={childAdapter(local.asChild, props.ref)} data-workspace-part="tab" onKeyDown={event => { callHandler(local.onKeyDown, event); if (!event.defaultPrevented && event.key === 'Delete' && !event.isComposing) { event.preventDefault(); void c.run(c.api.close(local.id), true); } }}>
    {local.children ?? c.props.slots?.tabLabel?.(c.screen(local.id), tab()) ?? c.screen(local.id).title}
  </Tabs.Trigger>;
}
export function WorkspaceCloseButton(props: ButtonPartProps & { id: string }) {
  const [local, rest] = splitProps(props, ['id', 'children', 'class', 'onClick', 'asChild']);
  const c = useParts(); return <ark.button {...rest} type="button" asChild={childAdapter(local.asChild, props.ref)} data-workspace-part="close" class={local.class ?? c.cls('close')} aria-label={c.labels().close(c.screen(local.id).title)} onClick={event => { callHandler(local.onClick, event); if (!event.defaultPrevented) void c.run(c.api.close(local.id), true); }}>{local.children ?? '×'}</ark.button>;
}
export function WorkspacePanels() {
  const c = useParts(); return <Show when={c.state().tabs.length} fallback={c.props.slots?.empty?.() ?? <p>{c.labels().empty}</p>}><For each={c.state().tabs}>{tab =>
    <PageContext.Provider value={{ id: tab.id, active: () => c.state().activeId === tab.id }}>
      <Tabs.Content value={tab.id} data-workspace-part="panel" class={c.cls('panel')} hidden={c.state().activeId !== tab.id} inert={c.state().activeId !== tab.id} style={{ display: c.state().activeId === tab.id ? undefined : 'none' }}><Dynamic component={c.screen(tab.id).component} /></Tabs.Content>
    </PageContext.Provider>
  }</For></Show>;
}
export function WorkspaceStatus() { const c = useParts(); return <div hidden={c.state().switcherOpen} role="status" aria-live="polite" data-workspace-part="status" class={c.cls('status')}>{c.status()}</div>; }
export function WorkspaceSwitcherTrigger(props: ButtonPartProps) {
  const [local, rest] = splitProps(props, ['children', 'onClick', 'asChild']);
  const c = useParts(); return <ark.button {...rest} type="button" asChild={childAdapter(local.asChild, props.ref)} aria-haspopup="dialog" disabled={!c.state().tabs.length || props.disabled} data-workspace-part="switcher-trigger" onClick={event => { callHandler(local.onClick, event); if (!event.defaultPrevented) c.showSwitcher(); }}>{local.children ?? c.labels().switcher}</ark.button>;
}
export function WorkspaceSwitcher(props: { children?: JSX.Element }) {
  const c = useParts(); return <Dialog.Root id={`${c.prefix}-switcher`} open={c.state().switcherOpen} onOpenChange={details => details.open ? c.api.showSwitcher() : c.api.hideSwitcher()}
    initialFocusEl={() => document.getElementById(`${c.prefix}-choice-${c.state().activeId}`)}
    finalFocusEl={() => { const opener = c.opener(); return opener?.isConnected && !opener.closest('[hidden],[inert]') ? opener : c.root().querySelector('[role="tab"][aria-selected="true"]'); }}
    modal trapFocus preventScroll lazyMount unmountOnExit>
    <Portal><Dialog.Backdrop class={c.cls('overlay')} /><Dialog.Positioner class={c.cls('positioner')}><Dialog.Content class={c.cls('switcher')} data-workspace-part="switcher">
      <Dialog.Title>{c.labels().switcher}</Dialog.Title><Dialog.Description>{c.labels().tabs}</Dialog.Description>
      <div role="status" aria-live="polite">{c.status()}</div>
      {props.children ?? <div class={c.cls('choices')} onKeyDown={event => {
        if (event.isComposing) return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-workspace-choice]'));
        const index = items.indexOf(event.target as HTMLButtonElement); if (index < 0) return;
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % items.length : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + items.length - 1) % items.length : -1;
        if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
      }}><For each={c.state().tabs}>{tab => <button type="button" data-workspace-choice id={`${c.prefix}-choice-${tab.id}`} aria-current={c.state().activeId === tab.id ? 'true' : undefined}
        onClick={() => void c.run(c.api.select(tab.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); })}>
        <Show when={c.props.slots?.preview}><div aria-hidden="true" inert>{c.props.slots?.preview?.(c.screen(tab.id))}</div></Show>
        {c.props.slots?.switcherItem?.(c.screen(tab.id), tab) ?? c.screen(tab.id).title}
      </button>}</For></div>}
      <Dialog.CloseTrigger>{c.labels().dismiss}</Dialog.CloseTrigger>
    </Dialog.Content></Dialog.Positioner></Portal>
  </Dialog.Root>;
}
export function Workspace(props: WorkspaceProps) {
  return <WorkspaceProvider {...props}>{props.children}<Show when={props.menu !== false}><WorkspaceMenu /></Show>
    <div class={props.unstyled ? props.classNames?.toolbar : `workspace-toolbar ${props.classNames?.toolbar ?? ''}`}><WorkspaceSwitcherTrigger /><WorkspaceTabList /></div>
    <WorkspaceStatus /><WorkspacePanels /><WorkspaceSwitcher />
  </WorkspaceProvider>;
}
