/** Framework-independent state. No DOM, network, timers, router or persistence. */
export interface Screen { readonly id: string; readonly title: string }
export interface Tab<D = undefined> { readonly id: string; readonly slot: number; readonly instance: number; readonly data: D }
export interface Snapshot<S extends Screen = Screen, D = undefined> {
  readonly tabs: readonly Tab<D>[];
  /** The current registry, in registration order; replaced on every change. */
  readonly screens: readonly S[];
  readonly activeId?: string;
  /** The id whose check (beforeActivate) is running. */
  readonly pendingId?: string;
  readonly switcherOpen: boolean;
}
export type Result = 'ok' | 'unknown' | 'limit' | 'denied' | 'cancelled' | 'stale';
export interface Options<S extends Screen = Screen, D = undefined> {
  /** The starting list. `reset()` returns the live registry to exactly this list. */
  screens?: readonly S[];
  /** Called once per new tab instance (a new tab or a renewal). */
  createTabData?: (screen: S) => D;
  showRetainedFirst?: boolean;
  /** The screen that keeps the workspace from emptying. */
  home?: string | (() => string | undefined);
  maxTabs?: number;
  /** App-owned guard/router bridge, invoked before committing an activation. Closing the active tab shows its neighbour first and checks it right after. */
  beforeActivate?: (id: string) => boolean | Promise<boolean>;
  beforeClose?: (id: string) => boolean | Promise<boolean>;
  onChange?: (snapshot: Snapshot<S, D>) => void;
}
export interface WorkspaceController<S extends Screen = Screen, D = undefined> {
  getSnapshot(): Snapshot<S, D>;
  /** The current registry; the same array as `getSnapshot().screens`. */
  getScreens(): readonly S[];
  getScreen(id: string): S | undefined;
  getTab(id: string): Tab<D> | undefined;
  open(id: string): Promise<Result>;
  select(id: string): Promise<Result>;
  close(id: string): Promise<Result>;
  /**
   * Add or update a definition. Updating an open screen keeps its tab object and data;
   * `{ renew: true }` replaces an open tab in place with a new instance and fresh data.
   */
  register(screen: S, options?: { show?: boolean; renew?: boolean }): Result;
  /** Revocation, not closing: removes the definition and its tab without `beforeClose` or a neighbour. */
  unregister(id: string): boolean;
  /** Revokes every registered screen not in `ids`; returns the removed ids in registration order. */
  retainOnly(ids: Iterable<string>): readonly string[];
  /** Make an already registered screen active without running a guard (for an app's router). */
  show(id: string): Result;
  canClose(id: string): boolean;
  showSwitcher(): void;
  hideSwitcher(): void;
  subscribe(listener: (state: Snapshot<S, D>) => void): () => void;
  /** Cancel outstanding guard requests without changing retained tabs or activity. */
  cancelPending(): void;
  /** Immediate disposal for logout/tenant changes/revocation; deliberately bypasses close guards and restores the starting list. */
  reset(): void;
}
export function createWorkspace<S extends Screen = Screen, D = undefined>(options: Options<S, D> = {}): WorkspaceController<S, D> {
  const max = options.maxTabs ?? 9;
  if (!Number.isInteger(max) || max < 1) throw new Error('maxTabs must be a positive integer');
  const starting = options.screens ?? [];
  if (new Set(starting.map(s => s.id)).size !== starting.length || starting.some(s => !s.id)) throw new Error('Screen IDs must be unique and nonempty');
  const initial = Object.freeze(starting.map(screen => Object.freeze({ ...screen })));
  /** The live registry; a Map keeps insertion order and an update keeps its position. */
  let live = new Map(initial.map(screen => [screen.id, screen]));
  let state: Snapshot<S, D> = Object.freeze({ tabs: Object.freeze([]), screens: initial, switcherOpen: false });
  let generation = 0;
  let instance = 0;
  /** Counts committed activations (open/select) and resets, so a late close guard knows it was overtaken. */
  let activations = 0;
  /** Per-id revocation count, so a running open of a revoked screen resolves stale. */
  const revocations = new Map<string, number>();
  const listeners = new Set<(state: Snapshot<S, D>) => void>();
  const closing = new Map<string, Promise<Result>>();
  function newTab(screen: S, slot: number): Tab<D> {
    return Object.freeze({ id: screen.id, slot, instance: ++instance, data: options.createTabData?.(screen) as D });
  }
  function commit(tabs: readonly Tab<D>[], activeId?: string, switcherOpen = state.switcherOpen, screens = state.screens) {
    state = Object.freeze({ tabs: Object.freeze([...tabs]), screens, activeId, switcherOpen: switcherOpen && tabs.length > 0 });
    for (const listener of listeners) listener(state);
    options.onChange?.(state);
  }
  const liveScreens = () => Object.freeze([...live.values()]);
  /** Drop the given ids' definitions and tabs in one commit. No guard runs and no neighbour is shown. */
  function revoke(ids: readonly string[]) {
    for (const id of ids) { live.delete(id); closing.delete(id); revocations.set(id, (revocations.get(id) ?? 0) + 1); }
    const removed = new Set(ids);
    const activeId = state.activeId !== undefined && removed.has(state.activeId) ? undefined : state.activeId;
    commit(state.tabs.filter(t => !removed.has(t.id)), activeId, state.switcherOpen, liveScreens());
  }
  function select(id: string): Promise<Result> {
    if (!state.tabs.some(tab => tab.id === id)) return Promise.resolve('unknown');
    return open(id);
  }
  async function open(id: string): Promise<Result> {
    if (!live.has(id)) return 'unknown';
    if (!state.tabs.some(t => t.id === id) && state.tabs.length >= max) return 'limit';
    const request = ++generation;
    const revoked = revocations.get(id);
    const allowed = await options.beforeActivate?.(id);
    if (request !== generation || revoked !== revocations.get(id)) return 'stale';
    if (allowed === false) return 'denied';
    const screen = live.get(id);
    if (!screen) return 'stale';
    let tabs = state.tabs;
    if (!tabs.some(t => t.id === id)) {
      if (tabs.length >= max) return 'limit';
      const used = new Set(tabs.map(t => t.slot));
      let slot = 1;
      while (used.has(slot)) slot++;
      tabs = [...tabs, newTab(screen, slot)];
    }
    activations++;
    commit(tabs, id);
    return 'ok';
  }
  function close(id: string): Promise<Result> {
    const existing = closing.get(id);
    if (existing) return existing;
    const task = performClose(id).finally(() => { if (closing.get(id) === task) closing.delete(id); });
    closing.set(id, task);
    return task;
  }
  /**
   * The closed tab leaves at once and a retained neighbour shows straight away; the neighbour's
   * beforeActivate runs afterwards. If it refuses or throws, nothing is active (the empty state).
   */
  async function performClose(id: string): Promise<Result> {
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return 'unknown';
    const request = ++generation;
    const allowed = await options.beforeClose?.(id);
    // A revocation or renewal replaced or removed this tab while its guard ran.
    if (request !== generation || state.tabs.find(t => t.id === id) !== tab) return 'stale';
    if (allowed === false) return 'cancelled';
    const wasActive = state.activeId === id;
    const index = state.tabs.findIndex(t => t.id === id);
    const next = wasActive ? (state.tabs[index + 1] ?? state.tabs[index - 1])?.id : state.activeId;
    commit(state.tabs.filter(t => t.id !== id), next);
    // The tab is gone: a reopened instance must get its own close, not this one.
    closing.delete(id);
    if (!wasActive || !next || !options.beforeActivate) return 'ok';
    // A later activation, reset or close of the shown neighbour owns the active screen; closing other tabs meanwhile does not.
    const shown = activations;
    const current = () => activations === shown && state.activeId === next;
    let canActivate: boolean;
    try { canActivate = (await options.beforeActivate(next)) !== false; }
    catch (error) { if (current()) commit(state.tabs, undefined); throw error; }
    if (!current()) return 'stale';
    if (canActivate) return 'ok';
    commit(state.tabs, undefined);
    return 'denied';
  }
  function register(screen: S, opts?: { show?: boolean; renew?: boolean }): Result {
    if (!screen?.id) throw new Error('Screen IDs must be nonempty');
    const definition = Object.freeze({ ...screen });
    live.set(screen.id, definition);
    let tabs = state.tabs;
    if (opts?.renew) {
      const index = tabs.findIndex(t => t.id === screen.id);
      if (index >= 0) {
        // The old instance is disposed: its pending close no longer applies.
        closing.delete(screen.id);
        tabs = tabs.map((t, i) => i === index ? newTab(definition, t.slot) : t);
      }
    }
    commit(tabs, state.activeId, state.switcherOpen, liveScreens());
    return 'ok';
  }
  return {
    getSnapshot: () => state, getScreens: () => state.screens, open, select, close, register,
    getScreen: id => live.get(id),
    getTab: id => state.tabs.find(t => t.id === id),
    unregister(id) { if (!live.has(id)) return false; revoke([id]); return true; },
    retainOnly(ids) {
      const keep = new Set(ids);
      const removed = Object.freeze([...live.keys()].filter(id => !keep.has(id)));
      if (removed.length) revoke(removed);
      return removed;
    },
    show() { throw new Error('not implemented'); },
    canClose: id => state.tabs.some(t => t.id === id),
    showSwitcher() { if (state.tabs.length) commit(state.tabs, state.activeId, true); },
    hideSwitcher() { if (state.switcherOpen) commit(state.tabs, state.activeId, false); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancelPending() { generation++; closing.clear(); },
    reset() { generation++; activations++; closing.clear(); live = new Map(initial.map(s => [s.id, s])); commit([], undefined, false, initial); }
  };
}
