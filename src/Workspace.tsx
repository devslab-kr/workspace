import { Dialog } from '@ark-ui/solid/dialog';
import { Tabs } from '@ark-ui/solid/tabs';
import { LocaleProvider } from '@ark-ui/solid/locale';
import { ark } from '@ark-ui/solid/factory';
import { Dynamic, Portal } from 'solid-js/web';
import { createContext, createEffect, createSignal, createUniqueId, For, mergeProps, onCleanup, onMount, Show, splitProps, untrack, useContext, type Accessor, type Component, type JSX } from 'solid-js';
import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type Tab, type WorkspaceController } from './core';

export interface WorkspaceScreen extends Screen { component: Component; }
/** A controller definition: its component is optional when the `screens` prop supplies it under the same id (0.2.0 style). */
export type AdapterScreen = Screen & { component?: Component };
/** A menu item; one naming a screen that is not registered yet shows its own label. */
export interface WorkspaceMenu { id: string; label?: string }
export interface PageActivity<D = unknown> {
  id: string; active: Accessor<boolean>;
  /** This tab instance's `createTabData` value; a renewal gives a new page with new data. */
  data: D;
  /** The live definition: its title updates without remounting the page. */
  screen: Accessor<WorkspaceScreen | undefined>;
}
const PageContext = createContext<PageActivity<any>>();
export interface WorkspaceLabels {
  menu: string; tabs: string; switcher: string; close: (title: string) => string;
  dismiss: string; empty: string; limit: string; denied: string; error: string;
}
const defaults: WorkspaceLabels = {
  menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`,
  dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached',
  denied: 'Screen transition cancelled', error: 'Screen transition failed',
};
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'pending' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  /** Starting screens (standalone), or components looked up by id for a controller whose definitions carry none. Read once. */
  screens?: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenu[]; menu?: boolean;
  children?: JSX.Element; class?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: {
    menu?: (api: WorkspaceController<AdapterScreen, any>) => JSX.Element;
    tabLabel?: (screen: WorkspaceScreen, tab: Tab) => JSX.Element;
    switcherItem?: (screen: WorkspaceScreen, tab: Tab) => JSX.Element;
    preview?: (screen: WorkspaceScreen) => JSX.Element; empty?: () => JSX.Element;
    /** Shown after the close buttons, outside the tab list, while a check runs for an id that has no tab yet. */
    pendingTab?: (id: string) => JSX.Element;
  };
}
type Standalone = Omit<Options<AdapterScreen, any>, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController<AdapterScreen, any>; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never; createTabData?: never; home?: never; showRetainedFirst?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
interface WorkspaceContext {
  api: WorkspaceController<AdapterScreen, any>; state: Accessor<Snapshot<AdapterScreen, any>>; props: WorkspaceProps;
  screen: (id: string) => WorkspaceScreen | undefined; title: (id: string) => string; labels: Accessor<WorkspaceLabels>;
  run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>;
  status: Accessor<string>; cls: (part: WorkspacePart) => string | undefined;
  root: () => HTMLDivElement; opener: () => HTMLElement | undefined;
  showSwitcher: () => void; prefix: string;
}
const Context = createContext<WorkspaceContext>();
function useParts() { const value = useContext(Context); if (!value) throw new Error('Workspace parts require WorkspaceProvider'); return value; }
export function useWorkspace() { return useParts().api; }
export function useWorkspaceState() { return useParts().state; }
export function useWorkspacePage<D = unknown>(): PageActivity<D> { const value = useContext(PageContext); if (!value) throw new Error('useWorkspacePage requires a workspace screen'); return value; }
export function useActiveEffect(effect: () => void | (() => void)) {
  const page = useWorkspacePage();
  createEffect(() => { if (page.active()) { const cleanup = effect(); if (cleanup) onCleanup(cleanup); } });
}
function matches(event: KeyboardEvent, shortcut: string | false | undefined) {
  if (!shortcut) return false;
  const keys = shortcut.toLowerCase().split('+');
  return event.key.toLowerCase() === keys.at(-1) && event.altKey === keys.includes('alt') && event.ctrlKey === keys.includes('ctrl') && event.metaKey === keys.includes('meta') && event.shiftKey === keys.includes('shift');
}
/** Options and the `screens` prop are construction-time; screens change through the controller (`register`). Remount for a new app identity. */
export function WorkspaceProvider(props: WorkspaceProps) {
  const api: WorkspaceController<AdapterScreen, any> = props.controller ?? createWorkspace<AdapterScreen, any>(props);
  const components = new Map((props.screens ?? []).map(screen => [screen.id, screen.component]));
  // Subscribed during setup (below), so a child that registers during render, also on the server, is seen by the parts after it.
  const [state, setState] = createSignal(api.getSnapshot()); const [status, setStatus] = createSignal('');
  const [direction, setDirection] = createSignal<'ltr' | 'rtl'>('ltr');
  onCleanup(api.subscribe(setState));
  const prefix = `ws-${createUniqueId()}`; const labels = () => ({ ...defaults, ...props.labels });
  const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  let root!: HTMLDivElement; let opener: HTMLElement | undefined; let composing = false;
  /** Puts keyboard focus back on the tab list, unless the user has already moved into the shown page (or, if onlyIfLost, anywhere). */
  function restoreFocus(onlyIfLost = false) {
    const focused = document.activeElement;
    if (onlyIfLost ? focused && focused !== document.body : focused instanceof HTMLElement && root.contains(focused) && focused.closest('[data-workspace-part="panel"]:not([hidden])')) return;
    (root.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? root.querySelector<HTMLElement>('[role="tab"]'))?.focus();
  }
  async function run(task: Promise<Result>, focus = false) {
    // A close removes the focused tab or button at once, before the next screen's guard settles: refocus on that change too.
    const stop = focus ? api.subscribe(() => { stop?.(); queueMicrotask(() => restoreFocus()); }) : undefined;
    try {
      const result = await task; props.onResult?.(result);
      setStatus(result === 'limit' ? labels().limit : result === 'denied' || result === 'cancelled' ? labels().denied : '');
      if ((result === 'ok' || result === 'denied') && focus) queueMicrotask(() => restoreFocus(result === 'denied'));
      return result;
    } catch (error) { setStatus(labels().error); props.onError?.(error); }
    finally { stop?.(); }
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
  /** The controller's live definition with its component, else the same id's component from the `screens` prop. */
  function screen(id: string): WorkspaceScreen | undefined {
    const definition = state().screens.find(screen => screen.id === id); if (!definition) return undefined;
    if (definition.component) return definition as WorkspaceScreen;
    const component = components.get(id); return component ? { ...definition, component } : undefined;
  }
  const title = (id: string) => state().screens.find(screen => screen.id === id)?.title ?? props.screens?.find(screen => screen.id === id)?.title ?? id;
  const slot = (id: string) => state().tabs.find(tab => tab.id === id)?.slot ?? 0;
  const context: WorkspaceContext = { api, state, props, screen, title, labels, run, status, cls, root: () => root, opener: () => opener, showSwitcher, prefix };
  return <Context.Provider value={context}><LocaleProvider locale={(props.dir ?? direction()) === 'rtl' ? 'ar' : 'en'}>
    <Tabs.Root ref={root} id={prefix} ids={{ trigger: id => `${prefix}-tab-${slot(id)}`, content: id => `${prefix}-panel-${slot(id)}` }} dir={props.dir ?? direction()} value={state().activeId ?? ''} activationMode="manual" onValueChange={details => void run(api.select(details.value))}
      lazyMount={false} unmountOnExit={false} data-workspace-part="root" class={[cls('root'), props.class].filter(Boolean).join(' ')}>{props.children}</Tabs.Root>
  </LocaleProvider></Context.Provider>;
}
export function WorkspaceMenu() {
  const c = useParts(); return <nav data-workspace-part="menu" aria-label={c.labels().menu} class={c.cls('menu')}>
    <Show when={c.props.slots?.menu} fallback={<For each={c.props.menus ?? (c.props.screens?.length ? c.props.screens : c.state().screens).map((screen): WorkspaceMenu => ({ id: screen.id }))}>{menu =>
      <button type="button" onClick={() => void c.run(c.api.open(menu.id))}>{menu.label ?? c.title(menu.id)}</button>
    }</For>}>{slot => slot()(c.api)}</Show></nav>;
}
export function WorkspaceTabList(props: { children?: JSX.Element }) {
  const c = useParts(); return <Show when={props.children} fallback={<div class={c.cls('tabs')} data-workspace-tab-strip style={{ display: 'grid', 'grid-auto-columns': 'max-content', 'align-items': 'center' }}>
    <Tabs.List data-workspace-part="tabs" aria-label={c.labels().tabs} style={{ display: 'contents' }}><For each={c.state().tabs}>{(tab, index) =>
      <WorkspaceTab id={tab.id} style={{ 'grid-column': index() * 2 + 1, 'grid-row': 1 }} />
    }</For></Tabs.List>
    <For each={c.state().tabs}>{(tab, index) => <WorkspaceCloseButton id={tab.id} style={{ 'grid-column': index() * 2 + 2, 'grid-row': 1 }} />}</For>
    <Show when={c.props.slots?.pendingTab && !c.state().tabs.some(tab => tab.id === c.state().pendingId) && c.state().pendingId}>{id =>
      <span data-workspace-part="pending" aria-busy="true" class={c.cls('pending')} style={{ 'grid-column': c.state().tabs.length * 2 + 1, 'grid-row': 1 }}>{c.props.slots!.pendingTab!(id())}</span>
    }</Show>
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
  // With no screen active no tab is selected, so the first tab stays in the Tab order.
  const entry = () => !c.state().activeId && c.state().tabs[0]?.id === local.id ? 0 : undefined;
  const label = () => { const screen = c.screen(local.id); return (screen && c.props.slots?.tabLabel?.(screen, tab())) ?? c.title(local.id); };
  return <Tabs.Trigger {...rest} tabIndex={entry() ?? rest.tabIndex} value={local.id} aria-busy={c.state().pendingId === local.id ? 'true' : rest['aria-busy']} class={local.class ?? c.cls('tab')} asChild={childAdapter(local.asChild, props.ref)} data-workspace-part="tab" onKeyDown={event => { callHandler(local.onKeyDown, event); if (!event.defaultPrevented && event.key === 'Delete' && !event.isComposing) { event.preventDefault(); if (c.api.canClose(local.id)) void c.run(c.api.close(local.id), true); } }}>
    {local.children ?? label()}
  </Tabs.Trigger>;
}
export function WorkspaceCloseButton(props: ButtonPartProps & { id: string }) {
  const [local, rest] = splitProps(props, ['id', 'children', 'class', 'onClick', 'asChild']);
  const c = useParts(); return <ark.button {...rest} type="button" asChild={childAdapter(local.asChild, props.ref)} data-workspace-part="close" data-active={c.state().activeId === local.id} disabled={rest.disabled || (c.state(), !c.api.canClose(local.id))} class={local.class ?? c.cls('close')} aria-label={c.labels().close(c.title(local.id))} onClick={event => { callHandler(local.onClick, event); if (!event.defaultPrevented) void c.run(c.api.close(local.id), true); }}>{local.children ?? '×'}</ark.button>;
}
export function WorkspacePanels() {
  // Retained panels stay mounted; the empty state shows whenever no screen is active (none open, or a closed tab's neighbour was refused).
  // Each tab object is one page instance: its component is read once, untracked, so a re-registration never remounts it.
  const c = useParts(); return <><For each={c.state().tabs}>{tab => {
    const component = untrack(() => c.screen(tab.id)?.component);
    return <PageContext.Provider value={{ id: tab.id, active: () => c.state().activeId === tab.id, data: tab.data, screen: () => c.screen(tab.id) }}>
      <Tabs.Content value={tab.id} data-workspace-part="panel" class={c.cls('panel')} hidden={c.state().activeId !== tab.id} inert={c.state().activeId !== tab.id} style={{ display: c.state().activeId === tab.id ? undefined : 'none' }}>{component && <Dynamic component={component} />}</Tabs.Content>
    </PageContext.Provider>;
  }}</For><Show when={!c.state().activeId}>{c.props.slots?.empty?.() ?? <p>{c.labels().empty}</p>}</Show></>;
}
export function WorkspaceStatus() { const c = useParts(); return <div hidden={c.state().switcherOpen} role="status" aria-live="polite" data-workspace-part="status" class={c.cls('status')}>{c.status()}</div>; }
export function WorkspaceSwitcherTrigger(props: ButtonPartProps) {
  const [local, rest] = splitProps(props, ['children', 'onClick', 'asChild']);
  const c = useParts(); return <ark.button {...rest} type="button" asChild={childAdapter(local.asChild, props.ref)} aria-haspopup="dialog" disabled={!c.state().tabs.length || props.disabled} data-workspace-part="switcher-trigger" onClick={event => { callHandler(local.onClick, event); if (!event.defaultPrevented) c.showSwitcher(); }}>{local.children ?? c.labels().switcher}</ark.button>;
}
export function WorkspaceSwitcher(props: { children?: JSX.Element }) {
  const c = useParts(); return <Dialog.Root id={`${c.prefix}-switcher`} open={c.state().switcherOpen} onOpenChange={details => details.open ? c.api.showSwitcher() : c.api.hideSwitcher()}
    initialFocusEl={() => document.getElementById(`${c.prefix}-choice-${c.state().tabs.find(tab => tab.id === c.state().activeId)?.slot}`)}
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
      }}><For each={c.state().tabs}>{tab => <button type="button" data-workspace-choice id={`${c.prefix}-choice-${tab.slot}`} aria-current={c.state().activeId === tab.id ? 'true' : undefined}
        onClick={() => void c.run(c.api.select(tab.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); })}>
        <Show when={c.props.slots?.preview && c.screen(tab.id)}>{screen => <div aria-hidden="true" inert>{c.props.slots!.preview!(screen())}</div>}</Show>
        {(() => { const screen = c.screen(tab.id); return (screen && c.props.slots?.switcherItem?.(screen, tab)) ?? c.title(tab.id); })()}
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
