import { createElement as h, Fragment, createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode, type DependencyList, type ComponentProps } from 'react';
import { Tabs } from '@ark-ui/react/tabs';
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { ark } from '@ark-ui/react/factory';
import { LocaleProvider } from '@ark-ui/react/locale';
import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type Tab as CoreTab, type WorkspaceController } from './core';
import { mountRetainedPreview } from './retained-preview';
import { switcherIcon } from './switcher-icon';

export interface WorkspaceScreen extends Screen { component: ComponentType }
/** A controller definition: its component is optional when the `screens` prop supplies it under the same id (0.2.0 style). */
export type AdapterScreen = Screen & { component?: ComponentType };
/** A menu item; one naming a screen that is not registered yet shows its own label. */
export interface WorkspaceMenuItem { id: string; label?: string }
export interface PageActivity<D = unknown> {
  id: string; active: boolean;
  /** This tab instance's `createTabData` value; a renewal gives a new page with new data. */
  data: D;
  /** The live definition: its title updates without remounting the page. */
  screen: WorkspaceScreen | undefined;
}
export interface WorkspaceLabels { menu: string; tabs: string; switcher: string; close: (title: string) => string; dismiss: string; empty: string; limit: string; denied: string; error: string }
const defaults: WorkspaceLabels = { menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`, dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached', denied: 'Screen transition cancelled', error: 'Screen transition failed' };
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'pending' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices' | 'preview';
export interface WorkspacePresentation {
  /** Starting screens (standalone), or components looked up by id for a controller whose definitions carry none. Read once. */
  screens?: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenuItem[]; menu?: boolean; children?: ReactNode;
  className?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>; unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  /** Show inert thumbnails of retained panels in the switcher. A preview slot takes precedence. */
  previews?: boolean;
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: { menu?: (api: WorkspaceController<AdapterScreen, any>) => ReactNode; tabLabel?: (screen: WorkspaceScreen, tab: CoreTab) => ReactNode; switcherItem?: (screen: WorkspaceScreen, tab: CoreTab) => ReactNode; preview?: (screen: WorkspaceScreen) => ReactNode; empty?: () => ReactNode;
    /** Shown after the close buttons, outside the tab list, while a check runs for an id that has no tab yet. */
    pendingTab?: (id: string) => ReactNode };
}
type Standalone = Omit<Options<AdapterScreen, any>, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController<AdapterScreen, any>; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never; createTabData?: never; home?: never; showRetainedFirst?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
interface Parts { api: WorkspaceController<AdapterScreen, any>; state: Snapshot<AdapterScreen, any>; props: WorkspaceProps; labels: WorkspaceLabels; screen: (id: string) => WorkspaceScreen | undefined; title: (id: string) => string; cls: (part: WorkspacePart) => string | undefined; run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>; status: string; root: { current: HTMLDivElement | null }; opener: { current: HTMLElement | null }; showSwitcher: () => void; prefix: string; panels: Map<number, HTMLElement> }
const Context = createContext<Parts | null>(null);
const PageContext = createContext<PageActivity<any> | null>(null);
function useParts() { const c = useContext(Context); if (!c) throw new Error('Workspace parts require WorkspaceProvider'); return c; }
export function useWorkspace() { return useParts().api; }
export function useWorkspaceState() { return useParts().state; }
export function useWorkspacePage<D = unknown>(): PageActivity<D> { const page = useContext(PageContext); if (!page) throw new Error('useWorkspacePage requires a workspace screen'); return page; }
export function useActiveEffect(effect: () => void | (() => void), dependencies: DependencyList = []) { const { active } = useWorkspacePage(); useEffect(() => active ? effect() : undefined, [active, ...dependencies]); }
function matches(e: KeyboardEvent, shortcut: string | false | undefined) { if (!shortcut) return false; const keys = shortcut.toLowerCase().split('+'); return e.key.toLowerCase() === keys.at(-1) && e.altKey === keys.includes('alt') && e.ctrlKey === keys.includes('ctrl') && e.metaKey === keys.includes('meta') && e.shiftKey === keys.includes('shift'); }

/** Options and the `screens` prop are construction-time; screens change through the controller (`register`). Remount for a new app identity. */
export function WorkspaceProvider(props: WorkspaceProps) {
  const [api] = useState<WorkspaceController<AdapterScreen, any>>(() => props.controller ?? createWorkspace<AdapterScreen, any>(props));
  const [components] = useState(() => new Map((props.screens ?? []).map(s => [s.id, s.component])));
  const state = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [status, setStatus] = useState(''); const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr'); const root = useRef<HTMLDivElement>(null); const opener = useRef<HTMLElement | null>(null); const prefix = `ws-${useId()}`;
  const panels = useRef(new Map<number, HTMLElement>()).current;
  const labels = { ...defaults, ...props.labels }; const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  // Focus returns to the tab list after a command unless the user moved into the shown page; a close also refocuses on its immediate commit.
  function restoreFocus(onlyIfLost = false) { const element = root.current; if (!element) return; const focused = document.activeElement; if (onlyIfLost ? focused && focused !== document.body : focused instanceof HTMLElement && element.contains(focused) && focused.closest('[data-workspace-part="panel"]:not([hidden])')) return; (element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? element.querySelector<HTMLElement>('[role="tab"]'))?.focus(); }
  async function run(task: Promise<Result>, focus = false) { const stop = focus ? api.subscribe(() => { stop?.(); queueMicrotask(() => restoreFocus()); }) : undefined; try { const result = await task; props.onResult?.(result); setStatus(result === 'limit' ? labels.limit : result === 'denied' || result === 'cancelled' ? labels.denied : ''); if ((result === 'ok' || result === 'denied') && focus) queueMicrotask(() => restoreFocus(result === 'denied')); return result; } catch (error) { setStatus(labels.error); props.onError?.(error); } finally { stop?.(); } }
  function showSwitcher() { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; api.showSwitcher(); }
  useEffect(() => { const element = root.current; if (!element) return; const update = () => setDirection(getComputedStyle(element.parentElement ?? element).direction === 'rtl' ? 'rtl' : 'ltr'); update(); const observer = new MutationObserver(update); observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['dir'] }); return () => observer.disconnect(); }, []);
  const mounted = useRef(false);
  useEffect(() => { if (!mounted.current) { mounted.current = true; if (props.defaultScreen) void run(api.open(props.defaultScreen)); } }, []);
  useEffect(() => {
    const element = root.current; if (!element) return; let composing = false;
    const keydown = (e: KeyboardEvent) => {
      if (props.shortcuts === false || composing || e.isComposing || e.keyCode === 229 || e.repeat || e.defaultPrevented || api.getSnapshot().switcherOpen) return;
      if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[role="alertdialog"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const config = typeof props.shortcuts === 'object' ? props.shortcuts : undefined;
      if (matches(e, config?.switcher ?? 'Alt+q')) { e.preventDefault(); showSwitcher(); } else { const tab = api.getSnapshot().tabs.find(t => matches(e, config?.slots ? config.slots[t.slot - 1] : t.slot <= 9 ? `Alt+${t.slot}` : false)); if (tab) { e.preventDefault(); void run(api.select(tab.id), true); } }
    };
    const start = () => { composing = true; }; const end = () => { composing = false; };
    element.addEventListener('keydown', keydown); element.addEventListener('compositionstart', start); element.addEventListener('compositionend', end);
    return () => { element.removeEventListener('keydown', keydown); element.removeEventListener('compositionstart', start); element.removeEventListener('compositionend', end); };
  }, [api, props.shortcuts]);
  /** The controller's live definition with its component, else the same id's component from the `screens` prop. */
  function screen(id: string): WorkspaceScreen | undefined {
    const definition = state.screens.find(s => s.id === id); if (!definition) return undefined;
    if (definition.component) return definition as WorkspaceScreen;
    const component = components.get(id); return component ? { ...definition, component } : undefined;
  }
  const title = (id: string) => state.screens.find(s => s.id === id)?.title ?? props.screens?.find(s => s.id === id)?.title ?? id;
  const slot = (id: string) => state.tabs.find(t => t.id === id)?.slot ?? 0;
  const context: Parts = { api, state, props, labels, cls, run, status, root, opener, showSwitcher, prefix, screen, title, panels };
  return h(Context.Provider, { value: context }, h(LocaleProvider, { locale: (props.dir ?? direction) === 'rtl' ? 'ar' : 'en' }, h(Tabs.Root, { ref: root, id: prefix, ids: { trigger: (id: string) => `${prefix}-tab-${slot(id)}`, content: (id: string) => `${prefix}-panel-${slot(id)}` }, dir: props.dir ?? direction, value: state.activeId ?? '', activationMode: 'manual', onValueChange: d => { void run(api.select(d.value)); }, lazyMount: false, unmountOnExit: false, ...{ 'data-workspace-part': 'root' }, className: [cls('root'), props.className].filter(Boolean).join(' ') }, props.children)));
}
export function WorkspaceMenu() { const c = useParts(); return h('nav', { 'data-workspace-part': 'menu', 'aria-label': c.labels.menu, className: c.cls('menu') }, c.props.slots?.menu?.(c.api) ?? (c.props.menus ?? (c.props.screens?.length ? c.props.screens : c.state.screens).map((s): WorkspaceMenuItem => ({ id: s.id }))).map(m => h('button', { key: m.id, type: 'button', onClick: () => { void c.run(c.api.open(m.id)); } }, m.label ?? c.title(m.id)))); }
export function WorkspaceTabList(props: Omit<ComponentProps<typeof Tabs.List>, 'children'> & { children?: ReactNode } = {}) {
  const c = useParts();
  const listProps = { ...props, ...{ 'data-workspace-part': 'tabs' }, 'aria-label': c.labels.tabs, className: props.className ?? c.cls('tabs') };
  if (props.children !== undefined) return h(Tabs.List, listProps, props.children);
  const pendingTab = c.props.slots?.pendingTab; const pending = c.state.pendingId;
  const showPending = !!pendingTab && pending !== undefined && !c.state.tabs.some(t => t.id === pending);
  return h('div', { className: c.cls('tabs'), style: { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, c.state.tabs.length * 2 + (showPending ? 1 : 0))}, max-content)`, overflowX: 'auto', gap: 0 } },
    h(Tabs.List, { ...listProps, className: props.className, style: { ...props.style, display: 'contents' } }, c.state.tabs.map((t, index) => h('div', { key: t.instance, role: 'presentation', className: c.cls('tab'), 'data-active': c.state.activeId === t.id, style: { display: 'contents' } }, h(WorkspaceTab, { id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 1 } })))),
    c.state.tabs.map((t, index) => h(WorkspaceCloseButton, { key: t.instance, id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 2 } })),
    showPending && h('span', { 'data-workspace-part': 'pending', 'aria-busy': 'true', className: c.cls('pending'), style: { gridRow: 1, gridColumn: c.state.tabs.length * 2 + 1 } }, pendingTab(pending)));
}export function WorkspaceTab(props: Omit<ComponentProps<typeof Tabs.Trigger>, 'value' | 'id'> & { id: string }) { const c = useParts(); const { id, children, onKeyDown, ...rest } = props; const screen = c.screen(id); return h(Tabs.Trigger, { ...rest, ...(!c.state.activeId && c.state.tabs[0]?.id === id ? { tabIndex: 0 } : {}), value: id, 'aria-busy': c.state.pendingId === id ? true : rest['aria-busy'], className: props.className ?? c.cls('tab'), ...{ 'data-workspace-part': 'tab' }, onKeyDown: e => { onKeyDown?.(e); if (!e.defaultPrevented && e.key === 'Delete' && !e.nativeEvent.isComposing) { e.preventDefault(); if (c.api.canClose(id)) void c.run(c.api.close(id), true); } } }, children ?? (screen && c.props.slots?.tabLabel?.(screen, c.state.tabs.find(t => t.id === id)!)) ?? c.title(id)); }
export function WorkspaceCloseButton(props: Omit<ComponentProps<typeof ark.button>, 'id'> & { id: string }) { const c = useParts(); const { id, children, onClick, ...rest } = props; return h(ark.button, { ...rest, type: 'button', ...{ 'data-workspace-part': 'close', 'data-active': c.state.activeId === id }, disabled: rest.disabled || !c.api.canClose(id), className: props.className ?? c.cls('close'), 'aria-label': c.labels.close(c.title(id)), onClick: e => { onClick?.(e); if (!e.defaultPrevented) void c.run(c.api.close(id), true); } }, children ?? '×'); }
/** One page instance: its component is captured on first render, so a re-registration never remounts it. */
function Panel({ tab }: { tab: CoreTab<unknown> }) {
  const c = useParts(); const [component] = useState(() => c.screen(tab.id)?.component); const active = c.state.activeId === tab.id;
  return h(PageContext.Provider, { value: { id: tab.id, active, data: tab.data, screen: c.screen(tab.id) } }, h(Tabs.Content, { ref: (element: HTMLDivElement | null) => { if (element) c.panels.set(tab.instance, element); else c.panels.delete(tab.instance); }, value: tab.id, ...{ 'data-workspace-part': 'panel' }, className: c.cls('panel'), style: active ? undefined : { display: 'none' }, hidden: !active, inert: !active }, component && h(component)));
}
// Keyed by tab instance: only close, revocation, reset or renew gives a new page.
export function WorkspacePanels() { const c = useParts(); const panels = c.state.tabs.map(t => h(Panel, { key: t.instance, tab: t })); return c.state.activeId ? panels : [...panels, h(Fragment, { key: 'empty' }, c.props.slots?.empty?.() ?? h('p', null, c.labels.empty))]; }
export function WorkspaceStatus() { const c = useParts(); return h('div', { role: 'status', 'aria-live': 'polite', hidden: c.state.switcherOpen, 'data-workspace-part': 'status', className: c.cls('status') }, c.status); }
export function WorkspaceSwitcherTrigger(props: ComponentProps<typeof ark.button> = {}) { const c = useParts(); const { children, onClick, ...rest } = props; return h(ark.button, { ...(children == null ? { 'aria-label': c.labels.switcher, title: c.labels.switcher } : {}), ...rest, type: 'button', 'aria-haspopup': 'dialog', disabled: rest.disabled || !c.state.tabs.length, ...{ 'data-workspace-part': 'switcher-trigger' }, onClick: e => { onClick?.(e); if (!e.defaultPrevented) c.showSwitcher(); } }, children ?? h('svg', { width: 20, height: 20, viewBox: switcherIcon.viewBox, fill: 'none', stroke: 'currentColor', strokeWidth: switcherIcon.strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, 'data-workspace-icon': 'layout-grid', dangerouslySetInnerHTML: { __html: switcherIcon.body } })); }
/** A DOM clone of the existing page: no second component instance or background work. */
function RetainedPreview({ tab }: { tab: CoreTab<unknown> }) {
  const c = useParts(); const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!c.state.switcherOpen) return;
    const bounds = c.root.current?.getBoundingClientRect();
    return mountRetainedPreview(host.current, c.panels.get(tab.instance) ?? null, { sourceWidth: bounds?.width, sourceHeight: bounds?.height });
  }, [c.state.switcherOpen, tab.instance]);
  return h('div', { ref: host, className: c.cls('preview'), 'data-workspace-part': 'preview', 'aria-hidden': true, inert: true });
}
export function WorkspaceSwitcher(props: { children?: ReactNode } = {}) {
  const c = useParts();
  return h(Dialog.Root, { id: `${c.prefix}-switcher`, open: c.state.switcherOpen, onOpenChange: d => d.open ? c.api.showSwitcher() : c.api.hideSwitcher(), initialFocusEl: () => document.getElementById(`${c.prefix}-choice-${c.state.tabs.find(t => t.id === c.state.activeId)?.slot}`), finalFocusEl: () => { const opener = c.opener.current; return opener?.isConnected && !opener.closest('[hidden],[inert]') ? opener : c.root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null; }, modal: true, trapFocus: true, preventScroll: true, lazyMount: true, unmountOnExit: true },
    h(Portal, null, h(Dialog.Backdrop, { className: c.cls('overlay') }), h(Dialog.Positioner, { className: c.cls('positioner') }, h(Dialog.Content, { className: c.cls('switcher'), ...{ 'data-workspace-part': 'switcher' } },
      h(Dialog.Title, null, c.labels.switcher), h(Dialog.Description, null, c.labels.tabs), h('div', { role: 'status', 'aria-live': 'polite', 'data-workspace-part': 'switcher-status', className: c.cls('status') }, c.status), props.children ?? h('div', { className: c.cls('choices'), onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => { if (e.nativeEvent.isComposing) return; const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-workspace-choice]')); const index = items.indexOf(e.target as HTMLButtonElement); if (index < 0) return; const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : ['ArrowDown', 'ArrowRight'].includes(e.key) ? (index + 1) % items.length : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? (index + items.length - 1) % items.length : -1; if (next >= 0) { e.preventDefault(); items[next]?.focus(); } } }, c.state.tabs.map(t => { const screen = c.screen(t.id); return h('button', { key: t.id, type: 'button', 'data-workspace-choice': '', id: `${c.prefix}-choice-${t.slot}`, 'aria-current': c.state.activeId === t.id ? 'true' : undefined, onClick: () => { void c.run(c.api.select(t.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); }); } }, c.props.slots?.preview && screen ? h('div', { 'aria-hidden': true, inert: true }, c.props.slots.preview(screen)) : c.props.previews && c.state.switcherOpen ? h(RetainedPreview, { key: t.instance, tab: t }) : null, (screen && c.props.slots?.switcherItem?.(screen, t)) ?? c.title(t.id)); })), h(Dialog.CloseTrigger, null, c.labels.dismiss)))));
}
export function Workspace(props: WorkspaceProps) { return h(WorkspaceProvider, props, props.children, props.menu !== false && h(WorkspaceMenu), h('div', { className: props.unstyled ? props.classNames?.toolbar : `workspace-toolbar ${props.classNames?.toolbar ?? ''}` }, h(WorkspaceSwitcherTrigger), h(WorkspaceTabList)), h(WorkspaceStatus), h(WorkspacePanels), h(WorkspaceSwitcher)); }
export { WorkspaceProvider as Provider, WorkspaceTabList as TabList, WorkspaceTab as Tab, WorkspaceCloseButton as CloseButton, WorkspacePanels as Panels, WorkspaceSwitcher as Switcher, WorkspaceSwitcherTrigger as SwitcherTrigger };
