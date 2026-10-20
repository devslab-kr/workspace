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
/** A running beforeActivate call: from open/select, a retained-first open, or a closed tab's neighbour. */
interface Check {
  readonly id: string; readonly kind: 'open' | 'retained' | 'neighbour';
  /** A close-neighbour check still running underneath this open; it is the running check again if this one ends without committing. */
  under?: Check;
}
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
  /** The running check (a beforeActivate call); its id is the snapshot's pendingId. */
  let check: Check | undefined;
  function newTab(screen: S, slot: number): Tab<D> {
    return Object.freeze({ id: screen.id, slot, instance: ++instance, data: options.createTabData?.(screen) as D });
  }
  /** `tabs` with `screen` open (a new tab takes the lowest free slot), or undefined when the cap is reached. */
  function withTab(tabs: readonly Tab<D>[], screen: S): readonly Tab<D>[] | undefined {
    if (tabs.some(t => t.id === screen.id)) return tabs;
    if (tabs.length >= max) return undefined;
    const used = new Set(tabs.map(t => t.slot));
    let slot = 1;
    while (used.has(slot)) slot++;
    return [...tabs, newTab(screen, slot)];
  }
  function commit(tabs: readonly Tab<D>[], activeId?: string, switcherOpen = state.switcherOpen, screens = state.screens) {
    state = Object.freeze({ tabs: Object.freeze([...tabs]), screens, activeId, pendingId: check?.id, switcherOpen: switcherOpen && tabs.length > 0 });
    for (const listener of listeners) listener(state);
    options.onChange?.(state);
  }
  /**
   * Ends the check `mine` if it is still the running one. With `refuse`, a checked screen that is on
   * display is cleared (nothing active); one that is not on display stays as it is.
   */
  function settle(mine: Check | undefined, refuse: boolean) {
    const ours = mine !== undefined && check === mine;
    if (ours) check = mine.under;
    else if (mine !== undefined && check?.under === mine) check.under = undefined;
    const clear = refuse && mine !== undefined && state.activeId === mine.id;
    if (ours || clear) commit(state.tabs, clear ? undefined : state.activeId);
  }
  /**
   * A router show of `screen` over `tabs`. Showing the active screen does nothing; showing the screen
   * being checked is part of that check; showing any other screen overtakes running checks (stale).
   */
  function routerShow(screen: S, tabs: readonly Tab<D>[]): { result: Result; tabs: readonly Tab<D>[]; activeId?: string } {
    if (state.activeId === screen.id) return { result: 'ok', tabs, activeId: state.activeId };
    const next = withTab(tabs, screen);
    if (!next) return { result: 'limit', tabs, activeId: state.activeId };
    if (check?.id !== screen.id) { generation++; activations++; check = undefined; }
    return { result: 'ok', tabs: next, activeId: screen.id };
  }
  const liveScreens = () => Object.freeze([...live.values()]);
  /** Drop the given ids' definitions and tabs in one commit. No guard runs and no neighbour is shown. */
  function revoke(ids: readonly string[]) {
    for (const id of ids) { live.delete(id); closing.delete(id); revocations.set(id, (revocations.get(id) ?? 0) + 1); }
    const removed = new Set(ids);
    if (check?.under && removed.has(check.under.id)) check.under = undefined;
    if (check && removed.has(check.id)) check = check.under;
    const activeId = state.activeId !== undefined && removed.has(state.activeId) ? undefined : state.activeId;
    commit(state.tabs.filter(t => !removed.has(t.id)), activeId, state.switcherOpen, liveScreens());
  }
  function select(id: string): Promise<Result> {
    if (!state.tabs.some(tab => tab.id === id)) return Promise.resolve('unknown');
    return open(id);
  }
  /**
   * With a guard, an id that is not registered yet is still checked (the cap first, a new tab), and
   * the registry is read after the guard: the router may have registered the screen meanwhile.
   */
  async function open(id: string): Promise<Result> {
    const guard = options.beforeActivate;
    if (!guard && !live.has(id)) return 'unknown';
    const retained = state.tabs.some(t => t.id === id);
    if (!retained && state.tabs.length >= max) return 'limit';
    const request = ++generation;
    const revoked = revocations.get(id);
    const current = () => request === generation && revoked === revocations.get(id);
    let mine: Check | undefined;
    if (guard) {
      // Commit, listeners, then the guard call, with nothing awaited in between.
      const first = retained && options.showRetainedFirst === true;
      const shows = first && state.activeId !== id;
      // A running close-neighbour check keeps running underneath, unless this open shows another screen (which overtakes it).
      const under = shows ? undefined : check?.kind === 'neighbour' ? check : check?.under;
      mine = check = { id, kind: first ? 'retained' : 'open', under };
      if (shows) activations++;
      commit(state.tabs, first ? id : state.activeId);
    }
    let allowed: boolean | undefined;
    try { allowed = await guard?.(id); }
    catch (error) { settle(mine, current()); throw error; }
    if (!current()) { settle(mine, false); return 'stale'; }
    if (allowed === false) { settle(mine, true); return 'denied'; }
    const screen = live.get(id);
    const tabs = screen && withTab(state.tabs, screen);
    if (!tabs) { settle(mine, false); return screen ? 'limit' : 'unknown'; }
    if (mine && check === mine) check = undefined;
    activations++;
    commit(tabs, id);
    return 'ok';
  }
  const homeId = () => typeof options.home === 'function' ? options.home() : options.home;
  /** Closing the only tab is refused when it is the home screen. */
  const isLastHome = (id: string) => state.tabs.length === 1 && state.tabs[0].id === id && homeId() === id;
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
    if (isLastHome(id)) return 'cancelled';
    const request = ++generation;
    const allowed = await options.beforeClose?.(id);
    // A revocation or renewal replaced or removed this tab while its guard ran.
    if (request !== generation || state.tabs.find(t => t.id === id) !== tab) return 'stale';
    if (allowed === false || isLastHome(id)) return 'cancelled';
    const wasActive = state.activeId === id;
    const index = state.tabs.findIndex(t => t.id === id);
    const next = wasActive ? (state.tabs[index + 1] ?? state.tabs[index - 1])?.id : state.activeId;
    const guard = options.beforeActivate;
    const neighbour: Check | undefined = wasActive && next && guard ? { id: next, kind: 'neighbour' } : undefined;
    // Any open check is already overtaken (this close moved the generation); an earlier close's neighbour check is not.
    const kept = check?.kind === 'neighbour' ? check : check?.under;
    // A kept check of the tab being closed no longer shows anything.
    check = neighbour ?? (kept?.id === id ? undefined : kept);
    commit(state.tabs.filter(t => t.id !== id), next);
    // The tab is gone: a reopened instance must get its own close, not this one.
    closing.delete(id);
    // The workspace emptied: open home through its guard, started in this same synchronous step.
    if (state.tabs.length === 0) {
      const home = homeId();
      if (home !== undefined && home !== id) return open(home);
    }
    if (!neighbour || !guard || !next) return 'ok';
    // A later activation, show, reset, revocation or close of the shown neighbour owns the active screen; closing other tabs meanwhile does not.
    const shown = activations;
    const revoked = revocations.get(next);
    const current = () => activations === shown && state.activeId === next && revocations.get(next) === revoked;
    let canActivate: boolean;
    try { canActivate = (await guard(next)) !== false; }
    catch (error) { settle(neighbour, current()); throw error; }
    if (!current()) { settle(neighbour, false); return 'stale'; }
    settle(neighbour, !canActivate);
    return canActivate ? 'ok' : 'denied';
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
    // Over the cap the definition is still stored (the router allowed it); only the tab is refused.
    const shown = opts?.show ? routerShow(definition, tabs) : { result: 'ok' as Result, tabs, activeId: state.activeId };
    commit(shown.tabs, shown.activeId, state.switcherOpen, liveScreens());
    return shown.result;
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
    show(id) {
      const screen = live.get(id);
      if (!screen) return 'unknown';
      if (state.activeId === id) return 'ok';
      const shown = routerShow(screen, state.tabs);
      if (shown.result === 'ok') commit(shown.tabs, shown.activeId);
      return shown.result;
    },
    canClose: id => state.tabs.some(t => t.id === id) && !isLastHome(id),
    showSwitcher() { if (state.tabs.length) commit(state.tabs, state.activeId, true); },
    hideSwitcher() { if (state.switcherOpen) commit(state.tabs, state.activeId, false); },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    cancelPending() {
      generation++; closing.clear();
      // Open checks are now stale; a close's neighbour check keeps running, as in 0.2.0.
      if (check && check.kind !== 'neighbour') { check = check.under; commit(state.tabs, state.activeId); }
    },
    reset() { generation++; activations++; closing.clear(); check = undefined; live = new Map(initial.map(s => [s.id, s])); commit([], undefined, false, initial); }
  };
}
