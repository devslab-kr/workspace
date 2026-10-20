import { createWorkspace, type Options, type Result, type Screen, type Snapshot, type WorkspaceController } from './core';

/** Synchronous URL history only; async router loaders remain app-owned guards. */
export interface HistoryAdapter {
  read(): string;
  push(url: string): void;
  replace(url: string): void;
  subscribe(listener: () => void): () => void;
}
export interface HistoryOptions<S extends Screen = Screen, D = undefined> extends Options<S, D> {
  screenFromUrl(url: string): string | undefined;
  urlForScreen(id: string): string;
  onNavigationError?: (error: unknown) => void;
}
export interface HistoryWorkspace<S extends Screen = Screen, D = undefined> {
  controller: WorkspaceController<S, D>;
  ready: Promise<Result | undefined>;
  sync(): Promise<Result | undefined>;
  /** Unsubscribes and resets the controller: tabs close without guards and runtime registrations are dropped. */
  dispose(): void;
}
/**
 * Optional two-way URL adapter with guarded back/forward and no network calls. It owns the URL:
 * do not combine it with `show()` from another router. With a guard, back/forward to an id that
 * is not registered still runs the guard, and the registry is read after it.
 */
export function createHistoryWorkspace<S extends Screen = Screen, D = undefined>(options: HistoryOptions<S, D>, history: HistoryAdapter): HistoryWorkspace<S, D> {
  let disposed = false;
  let observed = 0;
  let acceptedUrl = history.read();
  let activeId: string | undefined;
  /** The screen `acceptedUrl` belongs to; undefined while it is the starting URL. */
  let acceptedId: string | undefined;
  const api = createWorkspace<S, D>({ ...options, onChange(snapshot: Snapshot<S, D>) {
    const activationChanged = snapshot.activeId !== activeId;
    activeId = snapshot.activeId;
    // A screen shown while its own check runs (retained-first, a closed tab's neighbour) is accepted only once that check settles.
    const settled = snapshot.activeId !== undefined && snapshot.pendingId !== snapshot.activeId ? snapshot.activeId : undefined;
    if (!disposed && snapshot.activeId && (activationChanged || (settled !== undefined && settled !== acceptedId))) {
      const url = options.urlForScreen(snapshot.activeId);
      if (activationChanged && history.read() !== url) history.push(url);
      if (settled !== undefined) { acceptedUrl = url; acceptedId = settled; }
    }
    options.onChange?.(snapshot);
  } });
  async function sync(): Promise<Result | undefined> {
    const request = ++observed;
    api.cancelPending();
    const id = options.screenFromUrl(history.read());
    if (!id || disposed) return;
    try {
      const result = await api.open(id);
      if (!disposed && request === observed && result !== 'ok' && result !== 'stale') history.replace(acceptedUrl);
      return result;
    } catch (error) {
      if (!disposed && request === observed) history.replace(acceptedUrl);
      throw error;
    }
  }
  const unsubscribe = history.subscribe(() => {
    const request = observed + 1;
    void sync().catch(error => { if (!disposed && request === observed) options.onNavigationError?.(error); });
  });
  const ready = sync();
  return { controller: api, ready, sync, dispose() { if (disposed) return; disposed = true; observed++; unsubscribe(); api.reset(); } };
}
/** Call on the client with its window; import remains SSR-safe. */
export function browserHistory(target: Window): HistoryAdapter {
  return {
    read: () => `${target.location.pathname}${target.location.search}${target.location.hash}`,
    push: url => target.history.pushState(null, '', url),
    replace: url => target.history.replaceState(null, '', url),
    subscribe(listener) { target.addEventListener('popstate', listener); return () => target.removeEventListener('popstate', listener); },
  };
}
