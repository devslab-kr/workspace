import { getContext, setContext, type Component, type Snippet } from 'svelte';
import type { Options, Result, Screen, Snapshot, Tab, WorkspaceController } from '../core';

export interface WorkspaceScreen extends Screen { component: Component }
export interface WorkspaceMenu { id: string; label?: string }
export interface WorkspaceLabels { menu: string; tabs: string; switcher: string; close: (title: string) => string; dismiss: string; empty: string; limit: string; denied: string; error: string }
export const defaultLabels: WorkspaceLabels = { menu: 'Screens', tabs: 'Open screens', switcher: 'Switch screens', close: title => `Close ${title}`, dismiss: 'Close switcher', empty: 'Choose a screen', limit: 'Maximum open screens reached', denied: 'Screen transition cancelled', error: 'Screen transition failed' };
export type WorkspacePart = 'root' | 'menu' | 'toolbar' | 'tabs' | 'tab' | 'close' | 'panel' | 'status' | 'overlay' | 'positioner' | 'switcher' | 'choices';
export interface WorkspacePresentation {
  screens: readonly WorkspaceScreen[]; menus?: readonly WorkspaceMenu[]; menu?: boolean;
  children?: Snippet; class?: string; dir?: 'ltr' | 'rtl'; labels?: Partial<WorkspaceLabels>;
  shortcuts?: boolean | { switcher?: string | false; slots?: readonly (string | false)[] };
  unstyled?: boolean; classNames?: Partial<Record<WorkspacePart, string>>;
  onResult?: (result: Result) => void; onError?: (error: unknown) => void;
  slots?: { menu?: Snippet<[WorkspaceController]>; tabLabel?: Snippet<[WorkspaceScreen, Tab]>; switcherItem?: Snippet<[WorkspaceScreen, Tab]>; preview?: Snippet<[WorkspaceScreen]>; empty?: Snippet };
}
type Standalone = Omit<Options, 'screens'> & { controller?: never; defaultScreen?: string };
type Controlled = { controller: WorkspaceController; defaultScreen?: never; maxTabs?: never; beforeActivate?: never; beforeClose?: never; onChange?: never };
export type WorkspaceProps = WorkspacePresentation & (Standalone | Controlled);
export interface WorkspaceContext {
  api: WorkspaceController; readonly state: Snapshot; readonly props: WorkspaceProps; readonly labels: WorkspaceLabels; readonly status: string;
  screen: (id: string) => WorkspaceScreen; cls: (part: WorkspacePart) => string | undefined;
  run: (task: Promise<Result>, focus?: boolean) => Promise<Result | undefined>;
  showSwitcher: () => void; root: () => HTMLElement | undefined; opener: () => HTMLElement | undefined; prefix: string;
}
const workspaceKey = Symbol('workspace'); const pageKey = Symbol('workspace-page');
export function provideWorkspace(value: WorkspaceContext) { setContext(workspaceKey, value); }
export function useParts(): WorkspaceContext { const value = getContext<WorkspaceContext>(workspaceKey); if (!value) throw new Error('Workspace parts require WorkspaceProvider'); return value; }
export function useWorkspace() { return useParts().api; }
/** Read inside a Svelte effect/derived/template to track updates. */
export function useWorkspaceState() { const c = useParts(); return () => c.state; }
export interface PageActivity { id: string; active: () => boolean }
export function providePage(value: PageActivity) { setContext(pageKey, value); }
export function useWorkspacePage(): PageActivity { const page = getContext<PageActivity>(pageKey); if (!page) throw new Error('useWorkspacePage requires a workspace screen'); return page; }
/** Call during component initialization; cleanup runs on inactivity and destruction. */
export function useActiveEffect(effect: () => void | (() => void)) { const page = useWorkspacePage(); $effect(() => { if (page.active()) return effect(); }); }
export function matches(event: KeyboardEvent, shortcut: string | false | undefined) { if (!shortcut) return false; const keys = shortcut.toLowerCase().split('+'); return event.key.toLowerCase() === keys.at(-1) && event.altKey === keys.includes('alt') && event.ctrlKey === keys.includes('ctrl') && event.metaKey === keys.includes('meta') && event.shiftKey === keys.includes('shift'); }
