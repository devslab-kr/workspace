/** Framework-independent state. No DOM, network, timers, router or persistence. */
export interface Screen { readonly id: string; readonly title: string }
export interface Tab { readonly id: string; readonly slot: number; readonly instance: number }
export interface Snapshot { readonly tabs: readonly Tab[]; readonly activeId?: string; readonly switcherOpen: boolean }
export type Result = 'ok' | 'unknown' | 'limit' | 'denied' | 'cancelled' | 'stale';
export interface Options {
  screens: readonly Screen[];
  maxTabs?: number;
  /** App-owned guard/router bridge, invoked before committing an activation. */
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
  async function performClose(id: string): Promise<Result> {
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return 'unknown';
    const request = ++generation;
    const allowed = await options.beforeClose?.(id);
    if (request !== generation) return 'stale';
    if (allowed === false) return 'cancelled';
    const index = state.tabs.findIndex(t => t.id === id);
    let activeId = state.activeId;
    if (activeId === id) {
      activeId = (state.tabs[index + 1] ?? state.tabs[index - 1])?.id;
      if (activeId) {
        const canActivate = await options.beforeActivate?.(activeId);
        if (request !== generation) return 'stale';
        if (canActivate === false) return 'denied';
      }
    }
    commit(state.tabs.filter(t => t.id !== id), activeId);
    return 'ok';
  }
  return {
    getSnapshot: () => state, getScreens: () => screens, open, select, close,
    showSwitcher() { if (state.tabs.length) commit(state.tabs, state.activeId, true); },
    hideSwitcher() { if (state.switcherOpen) commit(state.tabs, state.activeId, false); },
    subscribe(listener: (state: Snapshot) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Cancel outstanding guard requests without changing retained tabs or activity. */
    cancelPending() { generation++; closing.clear(); },
    /** Immediate disposal for logout/tenant changes/revocation; deliberately bypasses close guards. */
    reset() { generation++; closing.clear(); commit([], undefined, false); }
  };
}
export type WorkspaceController = ReturnType<typeof createWorkspace>;
