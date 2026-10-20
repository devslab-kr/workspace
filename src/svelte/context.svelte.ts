import { getContext, setContext, type Component, type Snippet } from 'svelte';
import type { Options, Result, Screen, Snapshot, Tab, WorkspaceController } from '../core';

export interface WorkspaceScreen extends Screen { component: Component }
/** A controller definition: its component is optional when the `screens` prop supplies it under the same id (0.2.0 style). */
export type AdapterScreen = Screen & { component?: Component };
/** A menu item; one naming a screen that is not registered yet shows its own label. */
export interface WorkspaceMenu { id: string; label?: string }
export interface WorkspaceLabels { menu: string; tabs: string; switcher: string; close: (title: string) => string; dismiss: string; empty: string; limit: string; denied: string; error: string }
export const defaultLabels: WorkspaceLabels = { menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`, dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached', denied: 'Screen transition cancelled', error: 'Screen transition failed' };
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'pending' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  /** Starting screens (standalone), or components looked up by id for a controller whose definitions carry none. Read once. */
  screens?: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenu[]; menu?: boolean;
  children?: Snippet; class?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: { menu?: Snippet<[WorkspaceController<AdapterScreen, any>]>; tabLabel?: Snippet<[WorkspaceScreen, Tab<any>]>; switcherItem?: Snippet<[WorkspaceScreen, Tab<any>]>; preview?: Snippet<[WorkspaceScreen]>; empty?: Snippet;
    /** Shown after the close buttons, outside the tab list, while a check runs for an id that has no tab yet. */
    pendingTab?: Snippet<[string]> };
}
type Standalone = Omit<Options<AdapterScreen, any>, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController<AdapterScreen, any>; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never; createTabData?: never; home?: never; showRetainedFirst?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
export interface WorkspaceContext {
  api: WorkspaceController<AdapterScreen, any>; readonly state: Snapshot<AdapterScreen, any>; readonly props: WorkspaceProps; readonly labels: WorkspaceLabels; readonly status: string;
  /** The live definition with its component, or undefined when none resolves. */
  screen: (id: string) => WorkspaceScreen | undefined; title: (id: string) => string; slot: (id: string) => number; cls: (part: WorkspacePart) => string | undefined;
  run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>;
  showSwitcher: () => void; root: () => HTMLElement | undefined; opener: () => HTMLElement | undefined; prefix: string;
}
const workspaceKey = Symbol('workspace'); const pageKey = Symbol('workspace-page');
export function provideWorkspace(value: WorkspaceContext) { setContext(workspaceKey, value); }
export function useParts(): WorkspaceContext { const value = getContext<WorkspaceContext>(workspaceKey); if (!value) throw new Error('Workspace parts require WorkspaceProvider'); return value; }
export function useWorkspace() { return useParts().api; }
/** Read inside a Svelte effect/derived/template to track updates. */
export function useWorkspaceState() { const c = useParts(); return () => c.state; }
export interface PageActivity<D = unknown> {
  id: string; active: () => boolean;
  /** This tab instance's `createTabData` value; a renewal gives a new page with new data. */
  data: D;
  /** The live definition: its title updates without remounting the page. Read in a template/derived to track it. */
  screen: () => WorkspaceScreen | undefined;
}
export function providePage(value: PageActivity<any>) { setContext(pageKey, value); }
export function useWorkspacePage<D = unknown>(): PageActivity<D> { const page = getContext<PageActivity<D>>(pageKey); if (!page) throw new Error('useWorkspacePage requires a workspace screen'); return page; }
/** Call during component initialization; cleanup runs on inactivity and destruction. */
export function useActiveEffect(effect: () => void | (() => void)) { const page = useWorkspacePage(); $effect(() => { if (page.active()) return effect(); }); }
export function matches(event: KeyboardEvent, shortcut: string | false | undefined) { if (!shortcut) return false; const keys = shortcut.toLowerCase().split('+'); return event.key.toLowerCase() === keys.at(-1) && event.altKey === keys.includes('alt') && event.ctrlKey === keys.includes('ctrl') && event.metaKey === keys.includes('meta') && event.shiftKey === keys.includes('shift'); }
