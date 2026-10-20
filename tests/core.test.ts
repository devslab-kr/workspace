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
