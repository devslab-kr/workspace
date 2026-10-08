import { createWorkspace, type Options, type Result, type Snapshot } from './core';

/** Synchronous URL history only; async router loaders remain app-owned guards. */
export interface HistoryAdapter {
  read(): string;
  push(url: string): void;
  replace(url: string): void;
  subscribe(listener: () => void): () => void;
}
export interface HistoryOptions extends Options {
  screenFromUrl(url: string): string | undefined;
  urlForScreen(id: string): string;
  onNavigationError?: (error: unknown) => void;
}
/** Optional two-way URL adapter with guarded back/forward and no network calls. */
export function createHistoryWorkspace(options: HistoryOptions, history: HistoryAdapter) {
  let disposed = false;
  let observed = 0;
  let acceptedUrl = history.read();
  let activeId: string | undefined;
  const api = createWorkspace({ ...options, onChange(snapshot: Snapshot) {
    const activationChanged = snapshot.activeId !== activeId;
    activeId = snapshot.activeId;
    if (!disposed && activationChanged && snapshot.activeId) {
      const url = options.urlForScreen(snapshot.activeId);
      if (history.read() !== url) history.push(url);
      acceptedUrl = url;
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
