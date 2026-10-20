import { defineComponent, h, Fragment, provide, inject, shallowRef, computed, onMounted, onUnmounted, watchEffect, useId, ssrContextKey, type Component, type InjectionKey, type PropType, type Ref, type VNodeChild } from 'vue';
import { Tabs } from '@ark-ui/vue/tabs';
import { Dialog } from '@ark-ui/vue/dialog';
import { ark } from '@ark-ui/vue/factory';
import { LocaleProvider } from '@ark-ui/vue/locale';
import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type Tab as CoreTab, type WorkspaceController } from './core';

export interface WorkspaceScreen extends Screen { component: Component }
/** A controller definition: its component is optional when the `screens` prop supplies it under the same id (0.2.0 style). */
export type AdapterScreen = Screen & { component?: Component };
/** A menu item; one naming a screen that is not registered yet shows its own label. */
export interface WorkspaceMenuItem { id: string; label?: string }
export interface PageActivity<D = unknown> {
  id: string; active: Readonly<Ref<boolean>>;
  /** This tab instance's `createTabData` value; a renewal gives a new page with new data. */
  data: D;
  /** The live definition: its title updates without remounting the page. */
  screen: Readonly<Ref<WorkspaceScreen | undefined>>;
}
export interface WorkspaceLabels { menu: string; tabs: string; switcher: string; close: (title: string) => string; dismiss: string; empty: string; limit: string; denied: string; error: string }
const defaults: WorkspaceLabels = { menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`, dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached', denied: 'Screen transition cancelled', error: 'Screen transition failed' };
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'pending' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  /** Starting screens (standalone), or components looked up by id for a controller whose definitions carry none. Read once. */
  screens?: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenuItem[]; menu?: boolean; class?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>; unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] }; onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: { menu?: (api: WorkspaceController<AdapterScreen, any>) => VNodeChild; tabLabel?: (screen: WorkspaceScreen, tab: CoreTab) => VNodeChild; switcherItem?: (screen: WorkspaceScreen, tab: CoreTab) => VNodeChild; preview?: (screen: WorkspaceScreen) => VNodeChild; empty?: () => VNodeChild;
    /** Shown after the close buttons, outside the tab list, while a check runs for an id that has no tab yet. */
    pendingTab?: (id: string) => VNodeChild };
}
type Standalone = Omit<Options<AdapterScreen, any>, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController<AdapterScreen, any>; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never; createTabData?: never; home?: never; showRetainedFirst?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
interface Parts { api: WorkspaceController<AdapterScreen, any>; state: Ref<Snapshot<AdapterScreen, any>>; props: WorkspaceProps; labels: () => WorkspaceLabels; screen: (id: string) => WorkspaceScreen | undefined; title: (id: string) => string; cls: (part: WorkspacePart) => string | undefined; run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>; status: Ref<string>; root: Ref<HTMLDivElement | null>; opener: Ref<HTMLElement | null>; showSwitcher: () => void; prefix: string }
const Context: InjectionKey<Parts> = Symbol('Workspace');
const PageContext: InjectionKey<PageActivity<any>> = Symbol('WorkspacePage');
function useParts() { const c = inject(Context); if (!c) throw new Error('Workspace parts require WorkspaceProvider'); return c; }
export function useWorkspace() { return useParts().api; }
export function useWorkspaceState() { const state = useParts().state; return computed(() => state.value); }

export function useWorkspacePage<D = unknown>(): PageActivity<D> { const page = inject(PageContext); if (!page) throw new Error('useWorkspacePage requires a workspace screen'); return page; }
/** Reactive values read by the effect are tracked; cleanup runs on deactivation and unmount. */
export function useActiveEffect(effect: () => void | (() => void)) { const page = useWorkspacePage(); return watchEffect(onCleanup => { if (page.active.value) { const cleanup = effect(); if (cleanup) onCleanup(cleanup); } }); }
function matches(e: KeyboardEvent, shortcut: string | false | undefined) { if (!shortcut) return false; const keys = shortcut.toLowerCase().split('+'); return e.key.toLowerCase() === keys.at(-1) && e.altKey === keys.includes('alt') && e.ctrlKey === keys.includes('ctrl') && e.metaKey === keys.includes('meta') && e.shiftKey === keys.includes('shift'); }
const propNames = ['screens', 'menus', 'menu', 'class', 'dir', 'labels', 'unstyled', 'classNames', 'shortcuts', 'onResult', 'onError', 'slots', 'controller', 'defaultScreen', 'maxTabs', 'beforeActivate', 'beforeClose', 'onChange', 'createTabData', 'home', 'showRetainedFirst'] as const;

/** Options and the `screens` prop are construction-time; screens change through the controller (`register`). Remount for a new app identity. */
export const WorkspaceProvider = defineComponent((props: WorkspaceProps, { slots }) => {
  const api: WorkspaceController<AdapterScreen, any> = props.controller ?? createWorkspace<AdapterScreen, any>(props);
  const components = new Map((props.screens ?? []).map(s => [s.id, s.component]));
  // Server rendering (Vue provides an SSR context only there) never unmounts, so it must not subscribe: state reads the live snapshot instead.
  const server = inject(ssrContextKey, null) !== null;
  const state: Ref<Snapshot<AdapterScreen, any>> = server ? { get value() { return api.getSnapshot(); } } as Ref<Snapshot<AdapterScreen, any>> : shallowRef(api.getSnapshot()); const direction = shallowRef<'ltr' | 'rtl'>('ltr'); const status = shallowRef(''); const root = shallowRef<HTMLDivElement | null>(null); const opener = shallowRef<HTMLElement | null>(null); const prefix = `ws-${useId()}`;
  // On the client, subscribed during setup, so a child that registers in its own setup is seen by the parts after it.
  if (!server) onUnmounted(api.subscribe(s => { state.value = s; }));
  const labels = () => ({ ...defaults, ...props.labels }); const cls = (part: WorkspacePart) => [props.unstyled ? '' : part === 'root' ? 'workspace' : `workspace-${part}`, props.classNames?.[part]].filter(Boolean).join(' ') || undefined;
  // Focus returns to the tab list after a command unless the user moved into the shown page; a close also refocuses on its immediate commit.
  function restoreFocus(onlyIfLost = false) { const element = root.value; if (!element) return; const focused = document.activeElement; if (onlyIfLost ? focused && focused !== document.body : focused instanceof HTMLElement && element.contains(focused) && focused.closest('[data-workspace-part="panel"]:not([hidden])')) return; (element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? element.querySelector<HTMLElement>('[role="tab"]'))?.focus(); }
  async function run(task: Promise<Result>, focus = false) { const stop = focus ? api.subscribe(() => { stop?.(); queueMicrotask(() => restoreFocus()); }) : undefined; try { const result = await task; props.onResult?.(result); status.value = result === 'limit' ? labels().limit : result === 'denied' || result === 'cancelled' ? labels().denied : ''; if ((result === 'ok' || result === 'denied') && focus) queueMicrotask(() => restoreFocus(result === 'denied')); return result; } catch (error) { status.value = labels().error; props.onError?.(error); } finally { stop?.(); } }
  function showSwitcher() { opener.value = document.activeElement instanceof HTMLElement ? document.activeElement : null; api.showSwitcher(); }
  let cleanEvents: (() => void) | undefined; let directionObserver: MutationObserver | undefined;
  onMounted(() => {
    if (props.defaultScreen) void run(api.open(props.defaultScreen)); const element = root.value; if (!element) return; const updateDirection = () => { direction.value = getComputedStyle(element.parentElement ?? element).direction === 'rtl' ? 'rtl' : 'ltr'; }; updateDirection(); directionObserver = new MutationObserver(updateDirection); directionObserver.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['dir'] }); let composing = false;
    const keydown = (e: KeyboardEvent) => { if (props.shortcuts === false || composing || e.isComposing || e.keyCode === 229 || e.repeat || e.defaultPrevented || state.value.switcherOpen) return; if (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="dialog"],[role="alertdialog"]')) return; if (document.querySelector('[aria-modal="true"]')) return; const config = typeof props.shortcuts === 'object' ? props.shortcuts : undefined; if (matches(e, config?.switcher ?? 'Alt+q')) { e.preventDefault(); showSwitcher(); } else { const tab = state.value.tabs.find(t => matches(e, config?.slots ? config.slots[t.slot - 1] : t.slot <= 9 ? `Alt+${t.slot}` : false)); if (tab) { e.preventDefault(); void run(api.select(tab.id), true); } } };
    const start = () => { composing = true; }; const end = () => { composing = false; }; element.addEventListener('keydown', keydown); element.addEventListener('compositionstart', start); element.addEventListener('compositionend', end); cleanEvents = () => { element.removeEventListener('keydown', keydown); element.removeEventListener('compositionstart', start); element.removeEventListener('compositionend', end); };
  }); onUnmounted(() => { cleanEvents?.(); directionObserver?.disconnect(); });
  /** The controller's live definition with its component, else the same id's component from the `screens` prop. */
  function screen(id: string): WorkspaceScreen | undefined {
    const definition = state.value.screens.find(s => s.id === id); if (!definition) return undefined;
    if (definition.component) return definition as WorkspaceScreen;
    const component = components.get(id); return component ? { ...definition, component } : undefined;
  }
  const title = (id: string) => state.value.screens.find(s => s.id === id)?.title ?? props.screens?.find(s => s.id === id)?.title ?? id;
  const slot = (id: string) => state.value.tabs.find(t => t.id === id)?.slot ?? 0;
  provide(Context, { api, state, props, labels, cls, run, status, root, opener, showSwitcher, prefix, screen, title });
  return () => h(LocaleProvider, { locale: (props.dir ?? direction.value) === 'rtl' ? 'ar' : 'en' }, { default: () => h(Tabs.Root, { ref: (instance: unknown) => { root.value = instance instanceof HTMLElement ? instance as HTMLDivElement : (instance as { $el?: HTMLDivElement } | null)?.$el ?? null; }, id: prefix, ids: { trigger: (id: string) => `${prefix}-tab-${slot(id)}`, content: (id: string) => `${prefix}-panel-${slot(id)}` }, dir: props.dir ?? direction.value, modelValue: state.value.activeId ?? '', activationMode: 'manual', 'onUpdate:modelValue': (value: string) => { void run(api.select(value)); }, lazyMount: false, unmountOnExit: false, 'data-workspace-part': 'root', class: [cls('root'), props.class].filter(Boolean).join(' ') }, { default: () => slots.default?.() }) });
}, { name: 'WorkspaceProvider', props: [...propNames] });
export const WorkspaceMenu = defineComponent({ name: 'WorkspaceMenu', setup() { const c = useParts(); return () => h('nav', { 'data-workspace-part': 'menu', 'aria-label': c.labels().menu, class: c.cls('menu') }, c.props.slots?.menu?.(c.api) ?? (c.props.menus ?? (c.props.screens?.length ? c.props.screens : c.state.value.screens).map((s): WorkspaceMenuItem => ({ id: s.id }))).map(m => h('button', { key: m.id, type: 'button', onClick: () => { void c.run(c.api.open(m.id)); } }, m.label ?? c.title(m.id)))); } });
export const WorkspaceTabList = defineComponent({ name: 'WorkspaceTabList', inheritAttrs: false, setup(_, { slots, attrs }) {
  const c = useParts();
  return () => {
    const listProps = { ...attrs, 'data-workspace-part': 'tabs', 'aria-label': c.labels().tabs, class: attrs.class ?? c.cls('tabs') };
    if (slots.default) return h(Tabs.List, listProps, { default: slots.default });
    const pendingTab = c.props.slots?.pendingTab; const pending = c.state.value.pendingId;
    const showPending = !!pendingTab && pending !== undefined && !c.state.value.tabs.some(t => t.id === pending);
    return h('div', { class: c.cls('tabs'), style: { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, c.state.value.tabs.length * 2 + (showPending ? 1 : 0))}, max-content)`, overflowX: 'auto', gap: 0 } }, [
      h(Tabs.List, { ...listProps, class: attrs.class, style: [attrs.style, { display: 'contents' }] }, { default: () => c.state.value.tabs.map((t, index) => h('div', { key: t.instance, role: 'presentation', class: c.cls('tab'), 'data-active': c.state.value.activeId === t.id, style: { display: 'contents' } }, [h(WorkspaceTab, { id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 1 } })])) }),
      ...c.state.value.tabs.map((t, index) => h(WorkspaceCloseButton, { key: t.instance, id: t.id, style: { gridRow: 1, gridColumn: index * 2 + 2 } })),
      showPending ? h('span', { key: 'pending', 'data-workspace-part': 'pending', 'aria-busy': 'true', class: c.cls('pending'), style: { gridRow: 1, gridColumn: c.state.value.tabs.length * 2 + 1 } }, [pendingTab(pending)]) : null,
    ]);
  };
} });export const WorkspaceTab = defineComponent({ name: 'WorkspaceTab', inheritAttrs: false, props: { id: { type: String, required: true } }, setup(props, { slots, attrs }) { const c = useParts(); return () => h(Tabs.Trigger, { ...attrs, ...(!c.state.value.activeId && c.state.value.tabs[0]?.id === props.id ? { tabindex: 0 } : {}), value: props.id, 'aria-busy': c.state.value.pendingId === props.id ? 'true' : attrs['aria-busy'] as boolean | 'true' | 'false' | undefined, class: attrs.class ?? c.cls('tab'), 'data-workspace-part': 'tab', onKeydown: (e: KeyboardEvent) => { (attrs.onKeydown as ((e: KeyboardEvent) => void) | undefined)?.(e); if (!e.defaultPrevented && e.key === 'Delete' && !e.isComposing) { e.preventDefault(); if (c.api.canClose(props.id)) void c.run(c.api.close(props.id), true); } } }, { default: () => { const screen = c.screen(props.id); return slots.default?.() ?? (screen && c.props.slots?.tabLabel?.(screen, c.state.value.tabs.find(t => t.id === props.id)!)) ?? c.title(props.id); } }); } });
export const WorkspaceCloseButton = defineComponent({ name: 'WorkspaceCloseButton', inheritAttrs: false, props: { id: { type: String, required: true } }, setup(props, { slots, attrs }) { const c = useParts(); return () => h(ark.button, { ...attrs, type: 'button', 'data-workspace-part': 'close', 'data-active': c.state.value.activeId === props.id, disabled: (attrs.disabled !== undefined && attrs.disabled !== false) || !c.api.canClose(props.id), class: attrs.class ?? c.cls('close'), 'aria-label': c.labels().close(c.title(props.id)), onClick: (e: MouseEvent) => { (attrs.onClick as ((e: MouseEvent) => void) | undefined)?.(e); if (!e.defaultPrevented) void c.run(c.api.close(props.id), true); } }, { default: () => slots.default?.() ?? '×' }); } });
/** One page instance: its component and data are captured in setup, so a re-registration never remounts it. */
const Page = defineComponent({ props: { tab: { type: Object as PropType<CoreTab<unknown>>, required: true } }, setup(props) {
  const c = useParts(); const { id, data } = props.tab; const component = c.screen(id)?.component;
  const active = computed(() => c.state.value.activeId === id); const screen = computed(() => c.screen(id));
  provide(PageContext, { id, active, data, screen });
  return () => h(Tabs.Content, { value: id, 'data-workspace-part': 'panel', class: c.cls('panel'), style: active.value ? undefined : { display: 'none' }, hidden: !active.value, inert: !active.value }, { default: () => component ? h(component) : null });
} });
export const WorkspacePanels = defineComponent({ name: 'WorkspacePanels', setup() { const c = useParts(); return () => { const panels = c.state.value.tabs.map(t => h(Page, { key: t.instance, tab: t })); return c.state.value.activeId ? panels : [...panels, h(Fragment, { key: 'empty' }, [c.props.slots?.empty?.() ?? h('p', c.labels().empty)])]; }; } });
export const WorkspaceStatus = defineComponent({ name: 'WorkspaceStatus', setup() { const c = useParts(); return () => h('div', { role: 'status', 'aria-live': 'polite', hidden: c.state.value.switcherOpen, 'data-workspace-part': 'status', class: c.cls('status') }, c.status.value); } });
export const WorkspaceSwitcherTrigger = defineComponent({ name: 'WorkspaceSwitcherTrigger', inheritAttrs: false, setup(_, { slots, attrs }) { const c = useParts(); return () => h(ark.button, { ...attrs, type: 'button', 'aria-haspopup': 'dialog', disabled: !c.state.value.tabs.length, 'data-workspace-part': 'switcher-trigger', onClick: (e: MouseEvent) => { (attrs.onClick as ((e: MouseEvent) => void) | undefined)?.(e); if (!e.defaultPrevented) c.showSwitcher(); } }, { default: () => slots.default?.() ?? c.labels().switcher }); } });
export const WorkspaceSwitcher = defineComponent({ name: 'WorkspaceSwitcher', setup(_, { slots }) {
  const c = useParts();
  return () => h(Dialog.Root, { id: `${c.prefix}-switcher`, open: c.state.value.switcherOpen, 'onUpdate:open': (open: boolean) => open ? c.api.showSwitcher() : c.api.hideSwitcher(), initialFocusEl: () => document.getElementById(`${c.prefix}-choice-${c.state.value.tabs.find(t => t.id === c.state.value.activeId)?.slot}`), finalFocusEl: () => { const opener = c.opener.value; return opener?.isConnected && !opener.closest('[hidden],[inert]') ? opener : c.root.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null; }, modal: true, trapFocus: true, preventScroll: true, lazyMount: true, unmountOnExit: true }, { default: () => [h(Dialog.Backdrop, { class: c.cls('overlay') }), h(Dialog.Positioner, { class: c.cls('positioner') }, { default: () => h(Dialog.Content, { class: c.cls('switcher'), 'data-workspace-part': 'switcher' }, { default: () => [h(Dialog.Title, {}, { default: () => c.labels().switcher }), h(Dialog.Description, {}, { default: () => c.labels().tabs }), h('div', { role: 'status', 'aria-live': 'polite', 'data-workspace-part': 'switcher-status', class: c.cls('status') }, c.status.value), slots.default?.() ?? h('div', { class: c.cls('choices'), onKeydown: (e: KeyboardEvent) => { if (e.isComposing) return; const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-workspace-choice]')); const index = items.indexOf(e.target as HTMLButtonElement); if (index < 0) return; const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : ['ArrowDown', 'ArrowRight'].includes(e.key) ? (index + 1) % items.length : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? (index + items.length - 1) % items.length : -1; if (next >= 0) { e.preventDefault(); items[next]?.focus(); } } }, c.state.value.tabs.map(t => { const screen = c.screen(t.id); return h('button', { key: t.id, type: 'button', 'data-workspace-choice': '', id: `${c.prefix}-choice-${t.slot}`, 'aria-current': c.state.value.activeId === t.id ? 'true' : undefined, onClick: () => { void c.run(c.api.select(t.id)).then(result => { if (result === 'ok') c.api.hideSwitcher(); }); } }, [c.props.slots?.preview && screen && h('div', { 'aria-hidden': true, inert: true }, [c.props.slots.preview(screen)]), (screen && c.props.slots?.switcherItem?.(screen, t)) ?? c.title(t.id)]); })), h(Dialog.CloseTrigger, {}, { default: () => c.labels().dismiss })] }) })] });
} });
export const Workspace = defineComponent((props: WorkspaceProps, { slots }) => () => h(WorkspaceProvider, props, { default: () => [slots.default?.(), props.menu !== false && h(WorkspaceMenu), h('div', { class: props.unstyled ? props.classNames?.toolbar : `workspace-toolbar ${props.classNames?.toolbar ?? ''}` }, [h(WorkspaceSwitcherTrigger), h(WorkspaceTabList)]), h(WorkspaceStatus), h(WorkspacePanels), h(WorkspaceSwitcher)] }), { name: 'Workspace', props: [...propNames] });
export { WorkspaceProvider as Provider, WorkspaceTabList as TabList, WorkspaceTab as Tab, WorkspaceCloseButton as CloseButton, WorkspacePanels as Panels, WorkspaceSwitcher as Switcher, WorkspaceSwitcherTrigger as SwitcherTrigger };
