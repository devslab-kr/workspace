import { describe, expect, it } from 'vitest';
import { createWorkspace } from '../src/core';
const screens = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id }));
describe('workspace state', () => {
  it('select never opens a screen and switcher commands share a retained snapshot', async () => {
    const api = createWorkspace({ screens });
    expect(await api.select('a')).toBe('unknown');
    api.showSwitcher(); expect(api.getSnapshot().switcherOpen).toBe(false);
    await api.open('a'); const retained = api.getSnapshot().tabs[0];
    api.showSwitcher(); expect(api.getSnapshot().switcherOpen).toBe(true);
    expect(api.getSnapshot().tabs[0]).toBe(retained);
    api.hideSwitcher(); expect(api.getSnapshot().switcherOpen).toBe(false);
    api.showSwitcher(); api.reset(); expect(api.getSnapshot().switcherOpen).toBe(false);
  });
  it('deduplicates, preserves retained identities and stable slots, enforces the cap', async () => {
    const api = createWorkspace({ screens, maxTabs: 3 });
    await api.open('a'); const retained = api.getSnapshot().tabs[0];
    await api.open('b'); await api.open('c'); await api.select('a');
    expect(api.getSnapshot().tabs[0]).toBe(retained);
    expect(await api.open('d')).toBe('limit');
    await api.close('b'); await api.open('d');
    expect(api.getSnapshot().tabs.map(t => [t.id, t.slot])).toEqual([['a', 1], ['c', 3], ['d', 2]]);
    expect(await api.open('missing')).toBe('unknown');
  });
  it('cancels closing unsaved work and does not activate a denied destination', async () => {
    const api = createWorkspace({ screens, beforeClose: () => false, beforeActivate: id => id !== 'c' });
    await api.open('a');
    expect(await api.close('a')).toBe('cancelled');
    expect(await api.open('c')).toBe('denied');
    expect(api.getSnapshot().activeId).toBe('a');
  });
  it('closes at once and shows the neighbour while its guard runs; a refused or failed neighbour leaves nothing active', async () => {
    let resolve!: (allowed: boolean) => void; let guarded = false;
    const api = createWorkspace({ screens, beforeActivate: id => guarded && id === 'b' ? new Promise<boolean>(r => { resolve = r; }) : true });
    await api.open('a'); await api.open('b'); await api.select('a'); guarded = true;
    const closing = api.close('a'); await Promise.resolve();
    expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['b']); expect(api.getSnapshot().activeId).toBe('b');
    resolve(false);
    expect(await closing).toBe('denied');
    expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['b']); expect(api.getSnapshot().activeId).toBeUndefined();
    guarded = false;
    const failing = createWorkspace({ screens, beforeActivate: id => { if (guarded && id === 'b') throw new Error('guard failed'); return true; } });
    await failing.open('a'); await failing.open('b'); await failing.select('a'); guarded = true;
    await expect(failing.close('a')).rejects.toThrow('guard failed');
    expect(failing.getSnapshot().tabs.map(t => t.id)).toEqual(['b']); expect(failing.getSnapshot().activeId).toBeUndefined();
  });
  it('a later activation or a reopened tab overtakes a pending close guard (stale); closing another tab does not', async () => {
    const resolves: ((allowed: boolean) => void)[] = []; let guarded = false;
    const ids = (api: ReturnType<typeof createWorkspace>) => api.getSnapshot().tabs.map(t => t.id);
    const setup = async () => {
      guarded = false;
      const api = createWorkspace({ screens, beforeActivate: id => guarded && id === 'b' ? new Promise<boolean>(r => resolves.push(r)) : true });
      for (const id of ['a', 'b', 'c']) await api.open(id);
      await api.select('a'); guarded = true; return api;
    };
    let api = await setup(); let closing = api.close('a'); await Promise.resolve();
    expect(await api.close('c')).toBe('ok'); resolves.shift()!(false);
    expect(await closing).toBe('denied'); expect(ids(api)).toEqual(['b']); expect(api.getSnapshot().activeId).toBeUndefined();
    api = await setup(); closing = api.close('a'); await Promise.resolve();
    expect(await api.open('a')).toBe('ok'); expect(await api.close('a')).toBe('ok');
    resolves.shift()!(false);
    expect(await closing).toBe('stale'); expect(ids(api)).toEqual(['b', 'c']); expect(api.getSnapshot().activeId).toBe('c');
    api = await setup(); closing = api.close('a'); await Promise.resolve();
    const selecting = api.select('b'); resolves[1](true); expect(await selecting).toBe('ok');
    resolves[0](false); resolves.length = 0;
    expect(await closing).toBe('stale'); expect(api.getSnapshot().activeId).toBe('b');
  });
  it('latest transition wins and reset invalidates pending activations', async () => {
    let resolve!: (allowed: boolean) => void;
    const api = createWorkspace({ screens, beforeActivate: id => id === 'a' ? new Promise<boolean>(r => { resolve = r; }) : true });
    const first = api.open('a'); await api.open('b'); resolve(true);
    expect(await first).toBe('stale'); expect(api.getSnapshot().activeId).toBe('b');
    const pending = api.open('a'); api.reset(); resolve(true);
    expect(await pending).toBe('stale'); expect(api.getSnapshot().tabs).toEqual([]);
  });
  it('deduplicates concurrent close confirmations, propagates guard errors without mutation', async () => {
    let calls = 0; let resolve!: (allowed: boolean) => void;
    const api = createWorkspace({ screens, beforeClose: () => { calls++; return new Promise<boolean>(r => { resolve = r; }); } });
    await api.open('a'); const one = api.close('a'); const two = api.close('a'); resolve(true);
    expect(await one).toBe('ok'); expect(await two).toBe('ok'); expect(calls).toBe(1);
    const failure = createWorkspace({ screens, beforeActivate: () => { throw new Error('guard failed'); } });
    await expect(failure.open('a')).rejects.toThrow('guard failed'); expect(failure.getSnapshot().tabs).toEqual([]);
  });
  it('emits immutable snapshots, supports unsubscribe and empty final closure', async () => {
    const api = createWorkspace({ screens }); let calls = 0;
    const stop = api.subscribe(() => calls++); await api.open('a'); stop(); await api.close('a');
    expect(calls).toBe(1); expect(api.getSnapshot().activeId).toBeUndefined();
    expect(Object.isFrozen(api.getSnapshot().tabs)).toBe(true);
    expect(() => createWorkspace({ screens, maxTabs: 0 })).toThrow();
    expect(() => createWorkspace({ screens: [screens[0], screens[0]] })).toThrow();
  });
  it('reset does not reuse a pending close confirmation for a newly opened instance', async () => {
    const resolves: ((allowed: boolean) => void)[] = [];
    const api = createWorkspace({ screens, beforeClose: () => new Promise<boolean>(resolve => resolves.push(resolve)) });
    await api.open('a'); const oldClose = api.close('a'); api.reset(); await api.open('a');
    const newClose = api.close('a'); expect(resolves).toHaveLength(2);
    resolves[0](true); expect(await oldClose).toBe('stale');
    expect(api.close('a')).toBe(newClose);
    resolves[1](true); expect(await newClose).toBe('ok');
  });
});
describe('dynamic registry', () => {
  it('starts empty, registers at run time and lists screens in registration order', async () => {
    const api = createWorkspace();
    expect(await api.open('a')).toBe('unknown');
    expect(api.register({ id: 'a', title: 'A' })).toBe('ok'); api.register({ id: 'b', title: 'B' });
    expect(api.getSnapshot().screens.map(s => s.id)).toEqual(['a', 'b']);
    expect(await api.open('a')).toBe('ok');
    expect(() => api.register({ id: '', title: 'x' })).toThrow();
  });
  it('updating an open screen keeps its tab object and data, and notifies', async () => {
    let made = 0; const api = createWorkspace({ screens, createTabData: () => ({ n: ++made }) });
    await api.open('a'); const tab = api.getTab('a')!; let calls = 0; api.subscribe(() => calls++);
    for (let i = 0; i < 3; i++) api.register({ id: 'a', title: `A${i}` });
    expect(api.getTab('a')).toBe(tab); expect(tab.data).toEqual({ n: 1 }); expect(made).toBe(1);
    expect(api.getScreen('a')!.title).toBe('A2'); expect(calls).toBe(3);
  });
  it('renew replaces an open tab in place with a new instance and fresh data', async () => {
    let made = 0; const api = createWorkspace({ screens, createTabData: () => ++made });
    await api.open('a'); await api.open('b'); const old = api.getTab('a')!;
    api.register({ id: 'a', title: 'A' }, { renew: true });
    const renewed = api.getTab('a')!;
    expect(renewed).not.toBe(old); expect(renewed.slot).toBe(old.slot); expect(renewed.instance).toBeGreaterThan(old.instance);
    expect(renewed.data).toBe(3); expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a', 'b']);
  });
  it('revocation removes definitions and tabs without guards and leaves nothing active', async () => {
    let closeGuard = 0; const api = createWorkspace({ screens, beforeClose: () => { closeGuard++; return false; } });
    await api.open('a'); await api.open('b');
    expect(api.retainOnly(new Set(['a', 'zzz']))).toEqual(['b', 'c', 'd']);
    expect(api.getSnapshot().activeId).toBeUndefined(); expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a']);
    expect(api.unregister('a')).toBe(true); expect(api.unregister('a')).toBe(false);
    expect(closeGuard).toBe(0); expect(api.getScreen('a')).toBeUndefined();
    function* once() { yield 'x'; } expect(api.retainOnly(once())).toEqual([]);
  });
  it('reset restores the exact starting list', async () => {
    const api = createWorkspace({ screens });
    api.register({ id: 'e', title: 'E' }); api.register({ id: 'a', title: 'changed' }); api.unregister('b');
    api.reset();
    expect(api.getSnapshot().screens).toEqual(screens); expect(api.getSnapshot().tabs).toEqual([]);
  });
});
describe('checks and show', () => {
  const gate = () => { let r!: (v: boolean) => void; const p = new Promise<boolean>(x => { r = x; }); return { p, r }; };
  const tick = () => new Promise(r => setTimeout(r, 0));
  it('an unregistered id opens when its guard registers it, and is unknown otherwise', async () => {
    const api = createWorkspace({ beforeActivate: id => { api.register({ id, title: id }); return true; } });
    expect(await api.open('/x 1')).toBe('ok');
    expect(api.getTab('/x 1')).toBeDefined(); expect(api.getSnapshot().activeId).toBe('/x 1');
    const silent = createWorkspace({ beforeActivate: () => true });
    expect(await silent.open('x')).toBe('unknown'); expect(silent.getSnapshot().tabs).toEqual([]);
    let calls = 0; const unguarded = createWorkspace({ onChange: () => calls++ });
    expect(await unguarded.open('x')).toBe('unknown'); expect(calls).toBe(0);
  });
  it('checks the cap before the guard for an unregistered id', async () => {
    let calls = 0;
    const api = createWorkspace({ screens, maxTabs: 1, beforeActivate: id => { if (id === 'new') calls++; return true; } });
    await api.open('a');
    expect(await api.open('new')).toBe('limit'); expect(calls).toBe(0);
  });
  it('the router shows the checked screen inside the guard; the guard answer still decides', async () => {
    for (const allowed of [true, false]) {
      const g = gate(); const s = { id: 's', title: 'S' };
      const api = createWorkspace({ beforeActivate: async () => { api.register(s, { show: true }); return g.p; } });
      const opening = api.open('s');
      expect(api.getSnapshot().activeId).toBe('s');
      g.r(allowed);
      expect(await opening).toBe(allowed ? 'ok' : 'denied');
      expect(api.getSnapshot().activeId).toBe(allowed ? 's' : undefined);
      expect(api.getScreen('s')).toBeDefined(); expect(api.getTab('s')).toBeDefined();
    }
  });
  it('a refusal for a screen that is not on display changes nothing', async () => {
    const api = createWorkspace({ screens, beforeActivate: id => id !== 'b' });
    await api.open('a');
    expect(await api.open('b')).toBe('denied'); expect(api.getSnapshot().activeId).toBe('a');
  });
  it('showing another screen overtakes a pending open and a pending close-neighbour check', async () => {
    const g = gate(); let held = false;
    const api = createWorkspace({ screens, beforeActivate: id => held && id === 'b' ? g.p : true });
    await api.open('a'); await api.open('c'); await api.select('a'); held = true;
    const opening = api.open('b');
    expect(api.show('c')).toBe('ok'); g.r(true);
    expect(await opening).toBe('stale'); expect(api.getSnapshot().activeId).toBe('c');
    const n = gate(); held = false;
    const api2 = createWorkspace({ screens, beforeActivate: id => held && id === 'b' ? n.p : true });
    for (const id of ['a', 'b', 'c']) await api2.open(id);
    await api2.select('a'); held = true;
    const closing = api2.close('a'); await tick();
    expect(api2.getSnapshot().activeId).toBe('b');
    expect(api2.show('c')).toBe('ok'); n.r(false);
    expect(await closing).toBe('stale'); expect(api2.getSnapshot().activeId).toBe('c');
  });
  it('re-registering the active screen with show overtakes nothing and keeps its tab', async () => {
    const g = gate(); let made = 0; let held = false;
    const api = createWorkspace({ screens, createTabData: () => ++made, beforeActivate: id => held && id === 'c' ? g.p : true });
    await api.open('a'); const tab = api.getTab('a'); held = true;
    const opening = api.open('c');
    for (let i = 0; i < 3; i++) expect(api.register(screens[0], { show: true })).toBe('ok');
    expect(api.getSnapshot().activeId).toBe('a');
    g.r(true);
    expect(await opening).toBe('ok'); expect(api.getSnapshot().activeId).toBe('c');
    expect(api.getTab('a')).toBe(tab); expect(made).toBe(2);
  });
  it('a guard that registers and shows its screen, then throws, rejects with nothing active', async () => {
    const api = createWorkspace({ beforeActivate: id => { api.register({ id, title: id }, { show: true }); throw new Error('route failed'); } });
    await expect(api.open('x')).rejects.toThrow('route failed');
    expect(api.getSnapshot().activeId).toBeUndefined();
  });
  it('a screen revoked during its own guard resolves stale; a kept screen still opens', async () => {
    const g = gate();
    const api = createWorkspace({ screens: [...screens, { id: 'x', title: 'x' }], beforeActivate: () => g.p });
    const opening = api.open('x'); api.retainOnly([]); g.r(true);
    expect(await opening).toBe('stale'); expect(api.getTab('x')).toBeUndefined();
    const y = gate();
    const kept = createWorkspace({ screens: [...screens, { id: 'y', title: 'y' }], beforeActivate: () => y.p });
    const openingY = kept.open('y'); kept.retainOnly(['y']); y.r(true);
    expect(await openingY).toBe('ok'); expect(kept.getSnapshot().activeId).toBe('y');
    const again = gate();
    const back = createWorkspace({ screens, beforeActivate: () => again.p });
    const reopening = back.open('a'); back.unregister('a'); back.register({ id: 'a', title: 'A' }); again.r(true);
    expect(await reopening).toBe('stale'); expect(back.getTab('a')).toBeUndefined();
  });
  it('a close neighbour revoked during its check resolves stale with nothing active', async () => {
    const n = gate(); let held = false;
    const api = createWorkspace({ screens, beforeActivate: id => held && id === 'b' ? n.p : true });
    await api.open('a'); await api.open('b'); await api.select('a'); held = true;
    const closing = api.close('a'); await tick();
    expect(api.getSnapshot().activeId).toBe('b');
    api.unregister('b'); n.r(true);
    expect(await closing).toBe('stale'); expect(api.getSnapshot().activeId).toBeUndefined();
  });
  it('a close whose tab is revoked or renewed during beforeClose resolves stale and leaves the renewed tab', async () => {
    for (const change of ['revoke', 'renew'] as const) {
      const g = gate();
      const api = createWorkspace({ screens, beforeClose: () => g.p });
      await api.open('a'); await api.open('b');
      const closing = api.close('a');
      if (change === 'revoke') api.unregister('a'); else api.register(screens[0], { renew: true });
      const after = api.getTab('a'); g.r(true);
      expect(await closing).toBe('stale');
      expect(api.getTab('a')).toBe(after);
      if (change === 'renew') expect(after).toBeDefined();
    }
  });
  it('pendingId names the checked id during open, retained-first and close-neighbour checks', async () => {
    let g = gate(); let held = false;
    const api = createWorkspace({ screens, showRetainedFirst: true, beforeActivate: () => held ? g.p : true });
    await api.open('a'); await api.open('b'); held = true;
    const opening = api.open('c'); expect(api.getSnapshot().pendingId).toBe('c');
    g.r(true); await opening; expect(api.getSnapshot().pendingId).toBeUndefined();
    g = gate(); const retained = api.open('a'); expect(api.getSnapshot().pendingId).toBe('a');
    g.r(true); await retained; expect(api.getSnapshot().pendingId).toBeUndefined();
    g = gate(); const closing = api.close('a'); await tick();
    expect(api.getSnapshot().activeId).toBe('b'); expect(api.getSnapshot().pendingId).toBe('b');
    g.r(true); await closing; expect(api.getSnapshot().pendingId).toBeUndefined();
  });
  it('showRetainedFirst shows a retained tab before its check; a refusal leaves nothing active', async () => {
    for (const first of [true, false]) {
      const g = gate(); let held = false;
      const api = createWorkspace({ screens, showRetainedFirst: first, beforeActivate: () => held ? g.p : true });
      await api.open('a'); await api.open('b'); await api.select('a'); held = true;
      const opening = api.open('b');
      expect(api.getSnapshot().activeId).toBe(first ? 'b' : 'a');
      g.r(!first);
      expect(await opening).toBe(first ? 'denied' : 'ok');
      expect(api.getSnapshot().activeId).toBe(first ? undefined : 'b');
    }
  });
  it('re-opening the active tab with a refusing guard leaves nothing active (it is on display)', async () => {
    let refuse = false; const api = createWorkspace({ screens, beforeActivate: () => !refuse });
    await api.open('a'); refuse = true;
    expect(await api.open('a')).toBe('denied');
    expect(api.getSnapshot().activeId).toBeUndefined(); expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a']);
  });
  it('show and register-with-show report unknown and limit without changing tabs', async () => {
    const api = createWorkspace({ screens, maxTabs: 1 });
    await api.open('a');
    expect(api.show('zzz')).toBe('unknown');
    expect(api.show('b')).toBe('limit'); expect(api.getSnapshot().activeId).toBe('a');
    expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a']);
    expect(api.register({ id: 'n', title: 'N' }, { show: true })).toBe('limit');
    expect(api.getScreen('n')).toBeDefined(); expect(api.getTab('n')).toBeUndefined();
    expect(api.getSnapshot().activeId).toBe('a');
  });
  it('home: the only tab cannot be closed when it is home; canClose reports it', async () => {
    const api = createWorkspace({ screens, home: 'a' });
    await api.open('a');
    expect(api.canClose('a')).toBe(false); expect(api.canClose('missing')).toBe(false);
    expect(await api.close('a')).toBe('cancelled');
    expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a']); expect(api.getSnapshot().activeId).toBe('a');
    await api.open('b');
    expect(api.canClose('a')).toBe(true); expect(api.canClose('b')).toBe(true);
  });
  it('home: closing the last other tab removes it at once and opens home through its guard', async () => {
    const calls: string[] = []; const g = gate(); let held = false;
    const api = createWorkspace({ screens, home: () => 'a', beforeActivate: id => { calls.push(id); return held ? g.p : true; } });
    await api.open('b'); calls.length = 0; held = true;
    let guardCalledAtCommit: boolean | undefined;
    api.subscribe(s => { if (guardCalledAtCommit === undefined && !s.tabs.some(t => t.id === 'b')) guardCalledAtCommit = calls.includes('a'); });
    const closing = api.close('b');
    await Promise.resolve();
    expect(guardCalledAtCommit).toBe(false);
    expect(calls).toEqual(['a']);
    expect(api.getSnapshot().tabs).toEqual([]); expect(api.getSnapshot().pendingId).toBe('a');
    g.r(true);
    expect(await closing).toBe('ok');
    expect(api.getSnapshot().activeId).toBe('a'); expect(api.getSnapshot().tabs.map(t => t.id)).toEqual(['a']);
    expect(api.getSnapshot().pendingId).toBeUndefined();
  });
  it('home: an unregistered home without a guard leaves the workspace empty (unknown)', async () => {
    const api = createWorkspace({ screens, home: 'zzz' });
    await api.open('b');
    expect(await api.close('b')).toBe('unknown');
    expect(api.getSnapshot().tabs).toEqual([]); expect(api.getSnapshot().activeId).toBeUndefined();
  });
  it('home plays no part while other tabs remain: the neighbour rule applies', async () => {
    const calls: string[] = [];
    const api = createWorkspace({ screens, home: 'a', beforeActivate: id => { calls.push(id); return true; } });
    await api.open('b'); await api.open('c'); await api.select('b'); calls.length = 0;
    expect(await api.close('b')).toBe('ok');
    expect(api.getSnapshot().activeId).toBe('c'); expect(calls).toEqual(['c']);
    expect(api.getTab('a')).toBeUndefined();
  });
  it('a refused open does not hide a running close-neighbour check (pendingId stays on the neighbour)', async () => {
    const n = gate(); let held = false;
    const api = createWorkspace({ screens, beforeActivate: id => held && id === 'b' ? n.p : id !== 'c' });
    await api.open('a'); await api.open('b'); await api.select('a'); held = true;
    const closing = api.close('a'); await tick();
    expect(api.getSnapshot().pendingId).toBe('b');
    expect(await api.open('c')).toBe('denied');
    expect(api.getSnapshot().pendingId).toBe('b'); expect(api.getSnapshot().activeId).toBe('b');
    n.r(true);
    expect(await closing).toBe('ok');
    expect(api.getSnapshot().pendingId).toBeUndefined(); expect(api.getSnapshot().activeId).toBe('b');
  });
});
