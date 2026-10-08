import { expect, it } from 'vitest';
import { createHistoryWorkspace } from '../src/history';
function memoryHistory() {
  let url = '/a'; const pushed: string[] = []; const replaced: string[] = []; const listeners = new Set<() => void>();
  return { read: () => url, push: (next: string) => { pushed.push(next); url = next; }, replace: (next: string) => { replaced.push(next); url = next; },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    move(next: string) { url = next; }, pop(next: string) { url = next; for (const listener of listeners) listener(); }, pushed, replaced, listeners };
}
it('initial URL and app activation synchronize without duplicate entries; denial restores accepted URL', async () => {
  const history = memoryHistory(); let denied = false;
  const bridge = createHistoryWorkspace({ screens: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], screenFromUrl: url => url.slice(1), urlForScreen: id => `/${id}`, beforeActivate: id => !(denied && id === 'a') }, history);
  await bridge.ready; expect(history.pushed).toEqual([]);
  await bridge.controller.open('b'); expect(history.pushed).toEqual(['/b']);
  denied = true; history.pop('/a'); await Promise.resolve(); await Promise.resolve();
  expect(history.read()).toBe('/b'); expect(bridge.controller.getSnapshot().activeId).toBe('b');
  denied = false; history.pop('/a'); await Promise.resolve(); await Promise.resolve();
  expect(bridge.controller.getSnapshot().activeId).toBe('a'); expect(history.pushed).toEqual(['/b']);
  bridge.dispose(); expect(history.listeners.size).toBe(0); expect(bridge.controller.getSnapshot().tabs).toEqual([]);
});
it.each(['/external', '/missing'])('a newer unmapped or unknown URL cancels an older guard: %s', async next => {
  const history = memoryHistory(); let resolve!: (allowed: boolean) => void;
  const snapshots: unknown[] = [];
  const bridge = createHistoryWorkspace({ screens: ['a', 'b'].map(id => ({ id, title: id })), screenFromUrl: url => url === '/external' ? undefined : url.slice(1), urlForScreen: id => `/${id}`, beforeActivate: id => id === 'b' ? new Promise<boolean>(done => { resolve = done; }) : true, onChange: snapshot => snapshots.push(snapshot) }, history);
  await bridge.ready; const retained = bridge.controller.getSnapshot();
  history.move('/b'); const pending = bridge.sync(); history.move(next); const newer = await bridge.sync();
  expect(newer).toBe(next === '/external' ? undefined : 'unknown');
  resolve(true); expect(await pending).toBe('stale');
  expect(bridge.controller.getSnapshot()).toBe(retained); expect(snapshots).toHaveLength(1); expect(history.pushed).toEqual([]);
  expect(history.read()).toBe(next === '/external' ? '/external' : '/a');
  bridge.controller.showSwitcher(); bridge.controller.hideSwitcher();
  expect(history.pushed).toEqual([]); expect(history.read()).toBe(next === '/external' ? '/external' : '/a');
  bridge.dispose();
});
it('a newer URL blocked by the tab limit cancels pending activation without disposing pages', async () => {
  const history = memoryHistory(); let pendingGuard = false; let resolve!: (allowed: boolean) => void;
  const bridge = createHistoryWorkspace({ screens: ['a', 'b'].map(id => ({ id, title: id })), maxTabs: 1, screenFromUrl: url => url.slice(1), urlForScreen: id => `/${id}`, beforeActivate: () => pendingGuard ? new Promise<boolean>(done => { resolve = done; }) : true }, history);
  await bridge.ready; const retained = bridge.controller.getSnapshot(); pendingGuard = true;
  history.move('/a'); const pending = bridge.sync(); history.move('/b'); expect(await bridge.sync()).toBe('limit');
  resolve(true); expect(await pending).toBe('stale'); expect(bridge.controller.getSnapshot()).toBe(retained); expect(history.read()).toBe('/a'); expect(history.pushed).toEqual([]);
  bridge.dispose();
});
it('URL intent invalidates a pending close and allows a fresh close for the retained page', async () => {
  const history = memoryHistory(); const resolves: ((allowed: boolean) => void)[] = [];
  const bridge = createHistoryWorkspace({ screens: ['a', 'b'].map(id => ({ id, title: id })), screenFromUrl: url => url.slice(1), urlForScreen: id => `/${id}`, beforeClose: () => new Promise<boolean>(resolve => resolves.push(resolve)) }, history);
  await bridge.ready; await bridge.controller.open('b');
  const oldClose = bridge.controller.close('b'); history.move('/a'); expect(await bridge.sync()).toBe('ok');
  const newClose = bridge.controller.close('b'); expect(resolves).toHaveLength(2);
  resolves[0](true); expect(await oldClose).toBe('stale'); expect(bridge.controller.close('b')).toBe(newClose);
  expect(bridge.controller.getSnapshot().tabs.map(tab => tab.id)).toEqual(['a', 'b']);
  resolves[1](true); expect(await newClose).toBe('ok'); expect(bridge.controller.getSnapshot().tabs.map(tab => tab.id)).toEqual(['a']);
  bridge.dispose();
});
it('suppresses stale and disposed subscribed guard errors while preserving caller rejections', async () => {
  const history = memoryHistory(); const rejects: ((error: Error) => void)[] = []; const errors: unknown[] = [];
  const bridge = createHistoryWorkspace({ screens: ['a', 'b', 'c'].map(id => ({ id, title: id })), screenFromUrl: url => url.slice(1), urlForScreen: id => `/${id}`, beforeActivate: id => id === 'b' ? new Promise<boolean>((_, reject) => rejects.push(reject)) : true, onNavigationError: error => errors.push(error) }, history);
  await bridge.ready; history.pop('/b'); history.pop('/c'); rejects[0](new Error('stale subscribed guard'));
  for (let step = 0; step < 6; step++) await Promise.resolve();
  expect(errors).toEqual([]); expect(bridge.controller.getSnapshot().activeId).toBe('c');
  history.move('/b'); const manual = bridge.sync(); const manualRejected = expect(manual).rejects.toThrow('manual guard'); rejects[1](new Error('manual guard')); await manualRejected;
  history.pop('/b'); const currentError = new Error('current subscribed guard'); rejects[2](currentError);
  for (let step = 0; step < 6; step++) await Promise.resolve();
  expect(errors).toEqual([currentError]);
  history.pop('/b'); bridge.dispose(); rejects[3](new Error('disposed subscribed guard'));
  for (let step = 0; step < 6; step++) await Promise.resolve();
  expect(errors).toEqual([currentError]); expect(bridge.controller.getSnapshot().tabs).toEqual([]);
  const initial = createHistoryWorkspace({ screens: [{ id: 'a', title: 'A' }], screenFromUrl: () => 'a', urlForScreen: id => `/${id}`, beforeActivate: () => { throw new Error('initial guard'); } }, memoryHistory());
  await expect(initial.ready).rejects.toThrow('initial guard'); initial.dispose();
});
it('a newer URL cancels pending back navigation and disposal invalidates pending guards', async () => {
  const history = memoryHistory(); const resolves: ((value: boolean) => void)[] = [];
  const bridge = createHistoryWorkspace({ screens: ['a','b','c'].map(id => ({id,title:id})), screenFromUrl: url => url.slice(1), urlForScreen: id => `/${id}`, beforeActivate: id => id === 'b' ? new Promise<boolean>(resolve => resolves.push(resolve)) : true }, history);
  await bridge.ready; history.pop('/b'); history.pop('/c'); await Promise.resolve(); await Promise.resolve(); resolves[0](true); await Promise.resolve(); await Promise.resolve();
  expect(bridge.controller.getSnapshot().activeId).toBe('c'); expect(history.read()).toBe('/c');
  history.pop('/b'); bridge.dispose(); resolves[1](true); await Promise.resolve(); await Promise.resolve();
  expect(bridge.controller.getSnapshot().tabs).toEqual([]);
});
