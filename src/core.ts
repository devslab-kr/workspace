/** Framework-independent state. No DOM, network, timers, router or persistence. */
export interface Screen { readonly id: string; readonly title: string }
export interface Tab { readonly id: string; readonly slot: number; readonly instance: number }
export interface Snapshot { readonly tabs: readonly Tab[]; readonly activeId?: string; readonly switcherOpen: boolean }
export type Result = 'ok' | 'unknown' | 'limit' | 'denied' | 'cancelled' | 'stale';
export interface Options {
  screens: readonly Screen[];
  maxTabs?: number;
  /** App-owned guard/router bridge, invoked before committing an activation. Closing the active tab shows its neighbour first and checks it right after. */
  beforeActivate?: (id: string) => boolean | Promise<boolean>;
  beforeClose?: (id: string) => boolean | Promise<boolean>;
  onChange?: (snapshot: Snapshot) => void;
}
export function createWorkspace(options: Options) {
  const max = options.maxTabs ?? 9;
  if (!Number.isInteger(max) || max < 1) throw new Error('maxTabs must be a positive integer');
  const registry = new Map(options.screens.map(screen => [screen.id, screen]));
  if (registry.size !== options.screens.length || options.screens.some(s => !s.id)) throw new Error('Screen IDs must be unique and nonempty');
  const screens = Object.freeze(options.screens.map(screen => Object.freeze({ ...screen })));
  let state: Snapshot = Object.freeze({ tabs: Object.freeze([]), switcherOpen: false });
  let generation = 0;
  let instance = 0;
  /** Counts committed activations (open/select) and resets, so a late close guard knows it was overtaken. */
  let activations = 0;
  const listeners = new Set<(state: Snapshot) => void>();
  const closing = new Map<string, Promise<Result>>();
  function commit(tabs: readonly Tab[], activeId?: string, switcherOpen = state.switcherOpen) {
    state = Object.freeze({ tabs: Object.freeze(tabs.map(t => Object.isFrozen(t) ? t : Object.freeze({ ...t }))), activeId, switcherOpen: switcherOpen && tabs.length > 0 });
    for (const listener of listeners) listener(state);
    options.onChange?.(state);
  }
  function select(id: string): Promise<Result> {
    if (!state.tabs.some(tab => tab.id === id)) return Promise.resolve('unknown');
    return open(id);
  }
  async function open(id: string): Promise<Result> {
    if (!registry.has(id)) return 'unknown';
    if (!state.tabs.some(t => t.id === id) && state.tabs.length >= max) return 'limit';
    const request = ++generation;
    const allowed = await options.beforeActivate?.(id);
    if (request !== generation) return 'stale';
    if (allowed === false) return 'denied';
    let tabs = state.tabs;
    if (!tabs.some(t => t.id === id)) {
      if (tabs.length >= max) return 'limit';
      const used = new Set(tabs.map(t => t.slot));
      let slot = 1;
      while (used.has(slot)) slot++;
      tabs = [...tabs, { id, slot, instance: ++instance }];
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
    if (request !== generation) return 'stale';
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
  return {
    getSnapshot: () => state, getScreens: () => screens, open, select, close,
    showSwitcher() { if (state.tabs.length) commit(state.tabs, state.activeId, true); },
    hideSwitcher() { if (state.switcherOpen) commit(state.tabs, state.activeId, false); },
    subscribe(listener: (state: Snapshot) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Cancel outstanding guard requests without changing retained tabs or activity. */
    cancelPending() { generation++; closing.clear(); },
    /** Immediate disposal for logout/tenant changes/revocation; deliberately bypasses close guards. */
    reset() { generation++; activations++; closing.clear(); commit([], undefined, false); }
  };
}
export type WorkspaceController = ReturnType<typeof createWorkspace>;
