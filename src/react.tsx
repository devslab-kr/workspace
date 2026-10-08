import { createElement as h, createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode, type DependencyList, type ComponentProps } from 'react';
import { Tabs } from '@ark-ui/react/tabs';
import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { ark } from '@ark-ui/react/factory';
import { LocaleProvider } from '@ark-ui/react/locale';
import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type Tab as CoreTab, type WorkspaceController } from './core';

export interface WorkspaceScreen extends Screen { component: ComponentType }
export interface WorkspaceMenuItem { id: string; label?: string }
export interface WorkspaceLabels { menu: string; tabs: string; switcher: string; close: (title: string) => string; dismiss: string; empty: string; limit: string; denied: string; error: string }
const defaults: WorkspaceLabels = { menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`, dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached', denied: 'Screen transition cancelled', error: 'Screen transition failed' };
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  screens: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenuItem[]; menu?: boolean; children?: ReactNode;
  className?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>; unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: { menu?: (api: WorkspaceController) => ReactNode; tabLabel?: (screen: WorkspaceScreen, tab: CoreTab) => ReactNode; switcherItem?: (screen: WorkspaceScreen, tab: CoreTab) => ReactNode; preview?: (screen: WorkspaceScreen) => ReactNode; empty?: () => ReactNode };
}
type Standalone = Omit<Options, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
interface Parts { api: WorkspaceController; state: Snapshot; props: WorkspaceProps; labels: WorkspaceLabels; screen: (id: string) => WorkspaceScreen; cls: (part: WorkspacePart) => string | undefined; run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>; status: string; root: { current: HTMLDivElement | null }; opener: { current: HTMLElement | null }; showSwitcher: () => void; prefix: string }
const Context = createContext<Parts | null>(null);
const PageContext = createContext<{ id: string; active: boolean } | null>(null);
function useParts() { const c = useContext(Context); if (!c) throw new Error('Workspace parts require WorkspaceProvider'); return c; }
export function useWorkspace() { return useParts().api; }
export function useWorkspaceState() { return useParts().state; }
export function useWorkspacePage() { const page = useContext(PageContext); if (!page) throw new Error('useWorkspacePage requires a workspace screen'); return page; }
export function useActiveEffect(effect: () => void | (() => void), dependencies: DependencyList = []) { const { active } = useWorkspacePage(); useEffect(() => active ? effect() : undefined, [active, ...dependencies]); }
function matches(e: KeyboardEvent, shortcut: string | false | undefined) { if (!shortcut) return false; const keys = shortcut.toLowerCase().split('+'); return e.key.toLowerCase() === keys.at(-1) && e.altKey === keys.includes('alt') && e.ctrlKey === keys.includes('ctrl') && e.metaKey === keys.includes('meta') && e.shiftKey === keys.includes('shift'); }

/** The registry and controller options are construction-time; remount for a new app identity. */
export function WorkspaceProvider(props: WorkspaceProps) {
  const [api] = useState(() => props.controller ?? createWorkspace(props));
  const [registry] = useState(() => { const map = new Map(props.screens.map(s => [s.id, s])); if (map.size !== props.screens.length || api.getScreens().length !== map.size || api.getScreens().some(s => !map.has(s.id))) throw new Error('Controller and component screen registries must match'); if (props.menus?.some(m => !map.has(m.id))) throw new Error('Menu references an unknown screen'); return map; });
  const state = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const [status, setStatus] = useState(''); const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr'); const root = useRef<HTMLDivElement>(null); const opener = useRef<HTMLElement | null>(null); const prefix = `ws-${useId()}`;
  const labels = { ...defaults, ...props.labels }; const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  async function run(task: Promise<Result>, focus = false) { try { const result = await task; props.onResult?.(result); setStatus(result === 'limit' ? labels.limit : result === 'denied' || result === 'cancelled' ? labels.denied : ''); if (result === 'ok' && focus) queueMicrotask(() => root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus()); return result; } catch (error) { setStatus(labels.error); props.onError?.(error); } }
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
  const context: Parts = { api, state, props, labels, cls, run, status, root, opener, showSwitcher, prefix, screen: id => registry.get(id)! };
  return h(Context.Provider, { value: context }, h(LocaleProvider, { locale: (props.dir ?? direction) === 'rtl' ? 'ar' : 'en' }, h(Tabs.Root, { ref: root, id: prefix, dir: props.dir ?? direction, value: state.activeId ?? '', activationMode: 'manual', onValueChange: d => { void run(api.select(d.value)); }, lazyMount: false, unmountOnExit: false, ...{ 'data-workspace-part': 'root' }, className: [cls('root'), props.className].filter(Boolean).join(' ') }, props.children)));
}
export function WorkspaceMenu() { const c = useParts(); return h('nav', { 'data-workspace-part': 'menu', 'aria-label': c.labels.menu, className: c.cls('menu') }, c.props.slots?.menu?.(c.api) ?? (c.props.menus ?? c.props.screens.map(s => ({ id: s.id, label: s.title }))).map(m => h('button', { key: m.id, type: 'button', onClick: () => { void c.run(c.api.open(m.id)); } }, m.label ?? c.screen(m.id).title))); }
export function WorkspaceTabList(props: Omit<ComponentProps<typeof Tabs.List>, 'children'> & { children?: ReactNode } = {}) {
  const c = useParts();
  const listProps = { ...props, ...{ 'data-workspace-part': 'tabs' }, 'aria-label': c.labels.tabs, className: props.className ?? c.cls('tabs') };
  if (props.children !== undefined) return h(Tabs.List, listProps, props.children);
  return h('div', { className: c.cls('tabs'), style: { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, c.state.tabs.length * 2)}, max-content)`, overflowX: 'auto', gap: 0 } },
    h(Tabs.List, { ...listProps, className: props.className, style: { ...props.style, display: 'contents' } }, c.state.tabs.map((t, index) => h('div', { key: t.instance, role: 'presentation', className: c.cls('tab'), 'data-active': c.state.activeId === t.id, style: { display: 'contents' } }, h(WorkspaceTab, { id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 1 } })))),
    c.state.tabs.map((t, index) => h(WorkspaceCloseButton, { key: t.instance, id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 2 } })));
}export function WorkspaceTab(props: Omit<ComponentProps<typeof Tabs.Trigger>, 'value' | 'id'> & { id: string }) { const c = useParts(); const { id, children, onKeyDown, ...rest } = props; return h(Tabs.Trigger, { ...rest, value: id, className: props.className ?? c.cls('tab'), ...{ 'data-workspace-part': 'tab' }, onKeyDown: e => { onKeyDown?.(e); if (!e.defaultPrevented && e.key === 'Delete' && !e.nativeEvent.isComposing) { e.preventDefault(); void c.run(c.api.close(id), true); } } }, children ?? c.props.slots?.tabLabel?.(c.screen(id), c.state.tabs.find(t => t.id === id)!) ?? c.screen(id).title); }
export function WorkspaceCloseButton(props: Omit<ComponentProps<typeof ark.button>, 'id'> & { id: string }) { const c = useParts(); const { id, children, onClick, ...rest } = props; return h(ark.button, { ...rest, type: 'button', ...{ 'data-workspace-part': 'close', 'data-active': c.state.activeId === id }, className: props.className ?? c.cls('close'), 'aria-label': c.labels.close(c.screen(id).title), onClick: e => { onClick?.(e); if (!e.defaultPrevented) void c.run(c.api.close(id), true); } }, children ?? '×'); }
export function WorkspacePanels() { const c = useParts(); return c.state.tabs.length ? c.state.tabs.map(t => h(PageContext.Provider, { key: t.instance, value: { id: t.id, active: c.state.activeId === t.id } }, h(Tabs.Content, { value: t.id, ...{ 'data-workspace-part': 'panel' }, className: c.cls('panel'), style: c.state.activeId === t.id ? undefined : { display: 'none' }, hidden: c.state.activeId !== t.id, inert: c.state.activeId !== t.id }, h(c.screen(t.id).component)))) : c.props.slots?.empty?.() ?? h('p', null, c.labels.empty); }
export function WorkspaceStatus() { const c = useParts(); return h('div', { role: 'status', 'aria-live': 'polite', hidden: c.state.switcherOpen, 'data-workspace-part': 'status', className: c.cls('status') }, c.status); }
export function WorkspaceSwitcherTrigger(props: ComponentProps<typeof ark.button> = {}) { const c = useParts(); const { children, onClick, ...rest } = props; return h(ark.button, { ...rest, type: 'button', 'aria-haspopup': 'dialog', disabled: !c.state.tabs.length, ...{ 'data-workspace-part': 'switcher-trigger' }, onClick: e => { onClick?.(e); if (!e.defaultPrevented) c.showSwitcher(); } }, children ?? c.labels.switcher); }
export function WorkspaceSwitcher(props: { children?: ReactNode } = {}) {
  const c = useParts();
  return h(Dialog.Root, { id: `${c.prefix}-switcher`, open: c.state.switcherOpen, onOpenChange: d => d.open ? c.api.showSwitcher() : c.api.hideSwitcher(), initialFocusEl: () => document.getElementById(`${c.prefix}-choice-${c.state.activeId}`), finalFocusEl: () => { const opener = c.opener.current; return opener?.isConnected && !opener.closest('[hidden],[inert]') ? opener : c.root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null; }, modal: true, trapFocus: true, preventScroll: true, lazyMount: true, unmountOnExit: true },
    h(Portal, null, h(Dialog.Backdrop, { className: c.cls('overlay') }), h(Dialog.Positioner, { className: c.cls('positioner') }, h(Dialog.Content, { className: c.cls('switcher'), ...{ 'data-workspace-part': 'switcher' } },
      h(Dialog.Title, null, c.labels.switcher), h(Dialog.Description, null, c.labels.tabs), h('div', { role: 'status', 'aria-live': 'polite', 'data-workspace-part': 'switcher-status', className: c.cls('status') }, c.status), props.children ?? h('div', { className: c.cls('choices'), onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => { if (e.nativeEvent.isComposing) return; const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-workspace-choice]')); const index = items.indexOf(e.target as HTMLButtonElement); if (index < 0) return; const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : ['ArrowDown', 'ArrowRight'].includes(e.key) ? (index + 1) % items.length : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? (index + items.length - 1) % items.length : -1; if (next >= 0) { e.preventDefault(); items[next]?.focus(); } } }, c.state.tabs.map(t => h('button', { key: t.id, type: 'button', 'data-workspace-choice': '', id: `${c.prefix}-choice-${t.id}`, 'aria-current': c.state.activeId === t.id ? 'true' : undefined, onClick: () => { void c.run(c.api.select(t.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); }); } }, c.props.slots?.preview && h('div', { 'aria-hidden': true, inert: true }, c.props.slots.preview(c.screen(t.id))), c.props.slots?.switcherItem?.(c.screen(t.id), t) ?? c.screen(t.id).title))), h(Dialog.CloseTrigger, null, c.labels.dismiss)))));
}
export function Workspace(props: WorkspaceProps) { return h(WorkspaceProvider, props, props.children, props.menu !== false && h(WorkspaceMenu), h('div', { className: props.unstyled ? props.classNames?.toolbar : `workspace-toolbar ${props.classNames?.toolbar ?? ''}` }, h(WorkspaceSwitcherTrigger), h(WorkspaceTabList)), h(WorkspaceStatus), h(WorkspacePanels), h(WorkspaceSwitcher)); }
export { WorkspaceProvider as Provider, WorkspaceTabList as TabList, WorkspaceTab as Tab, WorkspaceCloseButton as CloseButton, WorkspacePanels as Panels, WorkspaceSwitcher as Switcher, WorkspaceSwitcherTrigger as SwitcherTrigger };
