# Dynamic Screen Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `@devslab/workspace` add, update and remove screens at run time (design option A), identically in Solid, React, Vue and Svelte, and ship it as 0.3.0.

**Architecture:** The framework-free controller in `src/core.ts` gets a live registry with a starting list, per-tab app data, router-driven `show()`, retained-first opens, a `home` screen and revocation. The adapters stop keeping their own registry. They read screens from the controller's snapshot, and fall back to their `screens` prop only for a missing `component`.

**Tech Stack:** TypeScript, Vitest, Playwright, Solid/React/Vue/Svelte 5 with Ark UI, Vite.

**Spec:** `docs/superpowers/specs/2026-10-20-dynamic-screen-registry-design.md`. Section 4A gives the behaviour, section 7 the agreed calls and section 9 the decision. Read it before any task.

## Global Constraints

- The core stays framework-free, with no DOM, network, timers, router or persistence (`src/core.ts:1`). No new runtime dependencies.
- The 0.2.0 close contract is unchanged for user closes: the tab leaves at once, the neighbour shows, then the neighbour's guard runs; refusal gives `denied` with nothing active; being overtaken gives `stale`. Every existing test in `tests/core.test.ts` and the e2e specs must keep passing unmodified, except the two registry-mismatch assertions that Task 6 replaces.
- A retained page is never remounted because the registry changed. Only close, revocation, `reset()` or `renew` disposes it.
- Tests follow the repo's `AGENTS.md`: prefer adding cases to existing test files and fixtures over new files, and assert behaviour, not implementation strings.
- Public API changes update both `README.md` and `README.ko.md`.
- Before any push: `npm run verify` and `node scripts/verify-package.mjs` pass locally on the exact commit (the user's global rule; CI runs the same).
- Commits and PR text carry no AI attribution. Branch: `feat/dynamic-screen-registry` (worktree `C:\Users\jlc48\code\workspace\workspace-kit-registry-impl`). Run `git branch --show-current` before every commit and push.

## Decisions this plan adds (beyond the spec)

These close gaps the spec leaves open. Each has a test.

1. **Showing the screen that is already active is a no-op**, whether or not a check is running. It commits nothing and does not overtake running checks. This covers a router that re-registers the current page on every refresh. If the user goes back to that screen while another open is pending, that open's guard (the router) reports the outcome.
2. **`register(s, { show: true })` over the tab cap still stores the definition, creates no tab and returns `limit`.** The router did allow it, so a later `open` can use it.
3. **Close and home.** When a close leaves no tabs and `home` resolves to an id other than the closed one, `close` returns the result of `open(home)`, called synchronously right after the close commits. This includes `unknown` when there is no guard and home is not registered.
4. **Adapter lookup for compatibility.** A tab's title comes from the controller's definition. Its component comes from the controller's definition if it has one, otherwise from the same id in the adapter's `screens` prop. Existing 0.2.0 apps, whose controller holds `{ id, title }` and whose prop holds components, keep working.
5. **The adapters' controller prop type** is `WorkspaceController<AdapterScreen, any>`, where `AdapterScreen = Screen & { component?: <framework component> }`.
6. **DOM ids come from the slot.** Ark Tabs gets `ids={{ trigger: v => `${prefix}-tab-${slot}`, content: v => `${prefix}-panel-${slot}` }}`. The switcher choice id is `${prefix}-choice-${slot}`.
7. **The pending placeholder** is `slots.pendingTab?: (id: string) => node`. The default strip renders it after the close buttons, outside the tablist, as `<span data-workspace-part="pending" aria-busy="true">`, only while `pendingId` names an id that has no tab.

## Review Focus

1. **A router that re-registers the current screen on every refresh** (fm refreshes every few seconds). Expected: the same tab object, `createTabData` called once, no remount, and nothing pending gets overtaken. Task 2 Step 1 tests this as "re-registering the active screen".
2. **Ids with spaces, slashes, `?` or Korean** (`'/admin/clinics?tab=1 한국'`). Expected: `aria-controls` and `aria-labelledby` resolve to real elements in every adapter. Tasks 5–7 test this as a "path id" case.
3. **A guard that registers and shows its screen, then throws.** Expected: `open` rejects and nothing is active. Task 2 Step 1 tests this as "guard registers then throws".
4. **`retainOnly` given a `Set` or a one-shot generator, or ids that were never registered.** Expected: correct removal and no throw. Task 1 Step 1 tests this.
5. **A revocation in the middle of the screen's own guard** (identity changes while navigating). Expected: that open resolves `stale` and leaves no tab. Task 2 Step 1 tests this as "revoked during its own guard".

---

### Task 1: Core live registry and per-tab data

**Files:**
- Modify: `src/core.ts`
- Test: `tests/core.test.ts` (new `describe('dynamic registry')` block)

**Interfaces:**
- Produces (exported from `src/core.ts`):
  - `interface Screen { readonly id: string; readonly title: string }` (unchanged)
  - `interface Tab<D = undefined> { readonly id: string; readonly slot: number; readonly instance: number; readonly data: D }`
  - `interface Snapshot<S extends Screen = Screen, D = undefined> { tabs: readonly Tab<D>[]; screens: readonly S[]; activeId?: string; pendingId?: string; switcherOpen: boolean }`
  - `interface Options<S extends Screen = Screen, D = undefined> { screens?: readonly S[]; createTabData?: (screen: S) => D; showRetainedFirst?: boolean; home?: string | (() => string | undefined); maxTabs?; beforeActivate?; beforeClose?; onChange?: (snapshot: Snapshot<S, D>) => void }`
  - `interface WorkspaceController<S extends Screen = Screen, D = undefined>`: every existing method, plus `register(screen: S, options?: { show?: boolean; renew?: boolean }): Result`, `unregister(id: string): boolean`, `retainOnly(ids: Iterable<string>): readonly string[]`, `show(id: string): Result`, `getScreen(id: string): S | undefined`, `getTab(id: string): Tab<D> | undefined` and `canClose(id: string): boolean`. `getScreens()` returns `snapshot.screens`.
  - `function createWorkspace<S extends Screen = Screen, D = undefined>(options?: Options<S, D>): WorkspaceController<S, D>`

This task implements `register` (without `show`), `unregister`, `retainOnly`, `getScreen`, `getTab`, `createTabData`, `renew` and the new `reset`. Task 2 adds `show`, `pendingId` and the check rules; Task 3 adds `home` and `canClose`. Until then, `show()` may throw `'not implemented'`.

- [ ] **Step 1: Write the failing tests** in `tests/core.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and confirm that the new ones fail.** Run `npx vitest run tests/core.test.ts`. Expected: the five new cases FAIL (`register` is not a function), and every pre-existing case PASSES.
- [ ] **Step 3: Implement the Task 1 interfaces in `src/core.ts`.** Keep the starting list frozen and keep a separate live `Map` in insertion order. Updating an entry keeps its position. A commit carries `screens: Object.freeze([...live.values()])`. Tab objects are only created for a new tab or a renewal; never rebuild them during a registry change. `retainOnly` iterates its argument once into a `Set`.
- [ ] **Step 4: Run the tests and confirm that they pass.** Run `npx vitest run tests/core.test.ts` and `npx tsc --noEmit`. Expected: all tests PASS, and the type check exits 0.
- [ ] **Step 5: Commit.**

```bash
git add src/core.ts tests/core.test.ts
git commit -m "feat(core): live screen registry with per-tab data, renew and revocation"
```

### Task 2: Core router-driven activation and check rules

**Files:**
- Modify: `src/core.ts`
- Test: `tests/core.test.ts` (new `describe('checks and show')` block)

**Interfaces:**
- Consumes: Task 1's controller.
- Produces: `show(id)`, `register(s, { show: true })`, `snapshot.pendingId`, `Options.showRetainedFirst`. In the spec, a "check" is any `beforeActivate` call: from open/select, a close's neighbour, home (Task 3) or a retained-first open.

- [ ] **Step 1: Write the failing tests.** Use a helper that makes a guard which can be resolved by hand, `const gate = () => { let r!: (v: boolean) => void; const p = new Promise<boolean>(x => { r = x; }); return { p, r }; }`. Write these cases:
  - **Unregistered id, guard registers it:** `createWorkspace({ beforeActivate: id => { api.register({ id, title: id }); return true; } })` → `open('/x 1')` resolves `ok`, and the tab exists and is active.
  - **Unregistered id, guard allows but never registers** → `unknown`, with no tab. **No guard** → `unknown` at once, and the guard is never called.
  - **The cap is checked before the guard for an unregistered id:** with `maxTabs: 1` and one tab open, `open('new')` gives `limit` and the guard call count stays at 0.
  - **The router shows the checked screen inside the guard:** the guard calls `api.register(s, { show: true })` and then awaits `gate`. `activeId === s.id` holds before the gate resolves. With `r(true)` → `ok`. With `r(false)` → `denied` and `activeId` undefined, while the tab stays registered and open.
  - **A refusal for a screen that is not on display changes nothing:** `a` active, `open('b')` with the guard refusing and no show → `denied`, and `activeId` is still `'a'`.
  - **Showing another screen overtakes:** `open('b')` pending, then `show('c')` → the open resolves `stale` and `activeId` is `'c'`. Also, during the close-neighbour check of `b`, `show('c')` → the close resolves `stale` (this extends the 0.2.0 overtaken rule).
  - **Re-registering the active screen** (Review Focus 1): `a` active and `open('c')` pending on a held gate. Then `register(aDefinition, { show: true })` three times, then `r(true)` → `open('c')` resolves `ok`, not `stale`. `getTab('a')` is still the same object, and `createTabData` ran once for `a`.
  - **The guard registers its screen and then throws** (Review Focus 3): `open` rejects, and `activeId` is undefined.
  - **Revoked during its own guard** (Review Focus 5): `open('x')` pending, then `retainOnly([])` → `stale`, and no `x` tab after the guard resolves `true`. A pending `open('y')`, where `y` is kept, resolves `ok`.
  - **Revoked during its close-neighbour check:** closing `a` shows `b` and checks it, then `unregister('b')` → the close resolves `stale`, and nothing is active.
  - **`pendingId`:** it equals the id during an open check, during a retained-first check and during a close-neighbour check, and it becomes undefined after each settles.
  - **`showRetainedFirst: true`:** opening the retained `b` makes it active before the gate resolves. `r(false)` → `denied` and nothing active. Without the option, `b` becomes active only after `r(true)`.
  - **`show()` of an unregistered id** → `unknown`. **`show()` of a new tab over the cap** → `limit` with no change. **`register(s, { show: true })` over the cap** → `limit`, the definition is stored and there is no tab (decision 2).
- [ ] **Step 2: Run the tests and confirm that the new ones fail.** Run `npx vitest run tests/core.test.ts`. Expected: the new cases FAIL, and the existing ones PASS.
- [ ] **Step 3: Implement it in `src/core.ts`.** Track each running check as `{ id, kind }`. When `show(id)` or `register({ show })` matches the running check's id, it commits without bumping; when it matches the already active id it does nothing at all (decision 1). In neither case does it bump the counters that `open` and the close-neighbour check compare. Any other show bumps both counters, so the pending requests resolve `stale`. Before deciding on a refusal, compare `state.activeId === checkedId`. Revocation marks only the pending requests whose target was removed. Keep the 0.2.0 synchronous order: commit, then listeners, then the guard call, with no `await` in between.
- [ ] **Step 4: Run the tests and confirm that they pass.** Run `npx vitest run tests/core.test.ts tests/history.test.ts` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** `src/core.ts tests/core.test.ts` with the message `feat(core): router-driven show, check rules, pendingId and retained-first open`.

### Task 3: Core home screen and canClose

**Files:**
- Modify: `src/core.ts`
- Test: `tests/core.test.ts` (the `describe('checks and show')` block)

**Interfaces:**
- Produces: `Options.home` and `canClose(id)`. The close resolves with the home open's result (decision 3).

- [ ] **Step 1: Write the failing tests:**
  - With `home: 'a'` and only `a` open: `canClose('a')` is `false`, and `close('a')` gives `cancelled` with the tab kept. `canClose('missing')` is `false`.
  - With `home: () => 'a'` and only `b` open (`a` registered): `close('b')` removes `b` at once. The guard for `a` starts before `close` settles (synchronous: assert a `calls` array contains `'a'` straight after calling `close`). `close` resolves `ok`, and `a` is active.
  - Home not registered and no guard: `close('b')` gives `unknown`, with no tabs and nothing active.
  - While other tabs remain, closing the active tab follows the 0.2.0 neighbour rule and the home guard is never called.
- [ ] **Step 2: Run the tests and confirm that the new ones fail.** Run `npx vitest run tests/core.test.ts`.
- [ ] **Step 3: Implement it in `src/core.ts`'s `performClose`.** After the commit, when no tabs are left and the resolved home differs from the closed id, `return open(home)`.
- [ ] **Step 4: Run the tests and confirm that they pass.** Run `npx vitest run tests/core.test.ts` and `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `src/core.ts tests/core.test.ts` with the message `feat(core): home screen and canClose`.

### Task 4: History adapter on the dynamic registry

**Files:**
- Modify: `src/history.ts`
- Test: `tests/history.test.ts`

**Interfaces:**
- Produces: `interface HistoryOptions<S extends Screen = Screen, D = undefined> extends Options<S, D>` and `createHistoryWorkspace<S, D>(options, history)`, returning `{ controller: WorkspaceController<S, D>, ready, sync, dispose }`.

- [ ] **Step 1: Write the failing tests** in `tests/history.test.ts`. Use the file's existing fake history:
  - Popstate to an id that is not registered, with a guard that registers it, opens it and pushes no extra history entry. With a guard that refuses, the URL goes back to the last accepted URL.
  - `dispose()` after `register({ id: 'e', title: 'E' })` leaves `controller.getScreen('e')` undefined.
  - It type-checks with a component-bearing generic screen: `createHistoryWorkspace<{ id: string; title: string; extra: number }>(...)`.
- [ ] **Step 2: Run the tests and confirm that the new ones fail.** Run `npx vitest run tests/history.test.ts`.
- [ ] **Step 3: Make `src/history.ts` generic.** Its behaviour comes from the core. Do not add `show()` usage (the spec says one URL owner).
- [ ] **Step 4: Run the tests and confirm that they pass.** Run `npx vitest run` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** `src/history.ts tests/history.test.ts` with the message `feat(history): generic options over the live registry`.

### Task 5: Solid adapter

**Files:**
- Modify: `src/Workspace.tsx`
- Modify: `tests/fixtures/solid-headless.tsx` (add a `?dynamic` mode; keep the existing default mode byte-for-byte in behaviour)
- Test: `e2e/solid-headless.spec.ts` (new test), `tests/retained-panels.ssr.ts` (new SSR cases; the config already runs this file)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces, for Tasks 6 and 7 to mirror:
  - `WorkspaceProps.controller?: WorkspaceController<Screen & { component?: Component }, any>` (decision 5).
  - `useWorkspacePage<D = unknown>(): { id: string; active: Accessor<boolean>; data: D; screen: Accessor<WorkspaceScreen | undefined> }`.
  - `slots.pendingTab?: (id: string) => JSX.Element` (decision 7).

- [ ] **Step 1: Write the failing e2e test** `dynamic registry: path ids, live titles, revocation, renewal, data and busy state` in `e2e/solid-headless.spec.ts`, against `/tests/fixtures/solid-headless.html?dynamic`. The fixture does four things. It creates `createWorkspace({ createTabData: s => ({ made: ++window.made }), home: '/customers', beforeActivate })`, where `beforeActivate` registers and shows allowed ids (simulating the router). It uses ids `'/orders 1 한국'` and `'/customers'`, and starts with an empty `screens` prop. Its page shows its input and `useWorkspacePage().data.made`, and counts mounts and cleanups on `window.events`. And it exposes `window.workspace`, plus `window.hold` for holding the guard open. Assertions:
  - After `workspace.open('/orders 1 한국')`, the Orders tab is selected. For both the tab and its panel, `document.getElementById(tab.getAttribute('aria-controls'))` is the panel and `getElementById(panel.getAttribute('aria-labelledby'))` is the tab (Review Focus 2).
  - Fill the Orders input with `kept`. Open `/customers`. Then `workspace.register({ ...orders, title: 'Orders (2)' })`: the tab label becomes `Orders (2)`. Selecting it shows the input still holding `kept`, and `events.mounted` is unchanged.
  - `workspace.retainOnly(['/customers'])` removes the Orders tab and raises `events.cleaned` by 1.
  - `workspace.register(customers, { renew: true })` remounts the customers page (mounted +1, cleaned +1), the shown `made` value grows, and the tab keeps slot 1.
  - With only `/customers` open, `Close Customers` is disabled (home).
  - Holding the guard and opening a retained tab with `showRetainedFirst` shows that tab with `aria-busy="true"`. Holding it for an unregistered id shows the `data-workspace-part="pending"` element from `slots.pendingTab`.
  - No page errors, and axe finds no violations.
- [ ] **Step 2: Write the failing SSR cases** in `tests/retained-panels.ssr.ts`:
  - A request-local controller with no starting screens gets `register({ id: '/a b', title: 'Alpha', component: Page }, { show: true })` before `renderToString(() => <Workspace controller={api} />)`. The HTML contains the `Alpha` tab with `aria-selected="true"` and the page text.
  - A child placed before the parts in `<WorkspaceProvider controller={api}><Registrar /><WorkspaceTabList /><WorkspacePanels /></WorkspaceProvider>`, which registers and shows during render, appears in the HTML (fm's pattern).
- [ ] **Step 3: Run the tests and confirm that the new ones fail.** Run `npx playwright test e2e/solid-headless.spec.ts --project=desktop` and `npx vitest run --config tests/retained-panels.ssr.config.ts`. Expected: the new cases FAIL, and the existing ones PASS.
- [ ] **Step 4: Change `src/Workspace.tsx`.**
  - Remove the throws at `:65-66`.
  - `screen(id)` follows decision 4, reading `state().screens`.
  - In `WorkspacePanels`, read each tab's component once, untracked, in the `<For>` callback, so a re-registration cannot remount the page.
  - Set Ark `ids` and the switcher id from the slot (decision 6).
  - Make the close button `disabled={!api.canClose(id)}`.
  - Set `aria-busy` on a tab whose id equals `pendingId`.
  - Render the pending slot (decision 7).
  - The menu's default items come from `props.screens`, falling back to `state().screens`. A menu item for an id that is not registered renders `menu.label`.
  - Add `data` and `screen` to `PageContext`.
- [ ] **Step 5: Run the tests and confirm that they pass.** Run `npx playwright test e2e/solid-headless.spec.ts e2e/workspace.spec.ts`, `npx vitest run --config tests/retained-panels.ssr.config.ts` and `npx tsc --noEmit`. Expected: all PASS on desktop and mobile.
- [ ] **Step 6: Commit** `src/Workspace.tsx tests/fixtures/solid-headless.tsx e2e/solid-headless.spec.ts tests/retained-panels.ssr.ts` with the message `feat(solid): read screens from the live registry`.

### Task 6: React and Vue adapters

**Files:**
- Modify: `src/react.tsx`, `src/vue.ts`
- Modify: `tests/fixtures/react-vue.ts` (add a `dynamic` URL parameter that mirrors Task 5's fixture)
- Test: `e2e/react-vue.spec.ts` (the Task 5 scenario inside the existing `for (const framework …)` loop), `tests/react-vue.test.ts`

**Interfaces:**
- Consumes: Task 5's produced names. Mirror them: `useWorkspacePage<D>()` returns `{ id, active, data, screen }`. React's `active` and `screen` are plain values; Vue's are `Readonly<Ref<…>>`. The `pendingTab` slot keeps the same name.

- [ ] **Step 1: Write the failing tests.**
  - In `e2e/react-vue.spec.ts`, add the Task 5 dynamic scenario for both frameworks.
  - In `tests/react-vue.test.ts`, replace the `rejects a mismatched controller registry` case with `uses the controller's registry and falls back to prop components`. A controller holding `{ id: 'a', title: 'Live' }` plus a `screens` prop holding `{ id: 'a', title: 'Old', component }` renders `Live` and the component's text, for both frameworks.
  - Add `Vue sees a screen registered during a child's setup`. The child is rendered before the parts, registers and shows in its setup, and the server output contains its tab.
- [ ] **Step 2: Run the tests and confirm that the new ones fail.** Run `npx vitest run tests/react-vue.test.ts` and `npx playwright test e2e/react-vue.spec.ts --project=desktop`.
- [ ] **Step 3: Change `src/react.tsx` and `src/vue.ts`** as Task 5 Step 4 did.
  - **React:** capture the component per tab instance in a small `Panel` component with `useState(() => component)`, keyed by `instance` (as now). Do not register during render.
  - **Vue:** move `api.subscribe` from `onMounted` into setup, keeping the unsubscribe in `onUnmounted`, and capture the component in `Page`'s setup.
- [ ] **Step 4: Run the tests and confirm that they pass.** Run `npx vitest run`, `npx playwright test e2e/react-vue.spec.ts` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** `src/react.tsx src/vue.ts tests/fixtures/react-vue.ts e2e/react-vue.spec.ts tests/react-vue.test.ts` with the message `feat(react,vue): read screens from the live registry`.

### Task 7: Svelte adapter

**Files:**
- Modify: `src/svelte/context.svelte.ts`, `WorkspaceProvider.svelte`, `WorkspacePanel.svelte`, `WorkspaceTab.svelte`, `WorkspaceTabList.svelte`, `WorkspaceCloseButton.svelte`, `WorkspaceMenu.svelte`, `WorkspaceSwitcher.svelte` (all in `src/svelte/`)
- Modify: `tests/svelte/demo/main.ts` (route `?dynamic` to a new `Dynamic.svelte` that mirrors Task 5's fixture), `tests/svelte/demo/SSRRun.ts`, `tests/svelte/demo/SSRFixture.svelte`
- Test: `tests/svelte/browser-check.mjs`, `tests/svelte/ssr-check.mjs`

**Interfaces:**
- Consumes: Task 5's produced names. Svelte's `useWorkspacePage<D>()` returns `{ id, active: () => boolean, data, screen: () => WorkspaceScreen | undefined }`. The pending slot is the snippet `slots.pendingTab: Snippet<[string]>`.

- [ ] **Step 1: Write the failing checks.**
  - In `browser-check.mjs`, add the Task 5 dynamic scenario against `?dynamic`, before its final console line.
  - In `ssr-check.mjs` and `SSRRun.ts`, add a `registered` render: a controller with no starting screens, `register({ id: '/orders x', title: 'Orders', component: Page }, { show: true })`, then assert `/orders page/` and `aria-selected="true"`.
- [ ] **Step 2: Run the checks and confirm that the new ones fail.** Run `npm run test:adapters`. Expected: the Svelte steps FAIL on the new assertions.
- [ ] **Step 3: Change the Svelte files** as Task 5 Step 4 did. In `WorkspacePanel.svelte`, replace `$derived(c.screen(id).component)` with a value captured once with `untrack`. Remove the throws in `WorkspaceProvider.svelte:12-13`.
- [ ] **Step 4: Run the checks and confirm that they pass.** Run `npm run test:adapters` and `npm run check:svelte`. Expected: `Adapter verification passed.`
- [ ] **Step 5: Commit** the changed Svelte sources and checks with the message `feat(svelte): read screens from the live registry`.

### Task 8: Docs, version 0.3.0 and full verification

**Files:**
- Modify: `README.md`, `README.ko.md`, `docs/solid.md`, `docs/react-vue.md`, `src/svelte/README.md`, `docs/verification.md`, `CHANGELOG.md`
- Modify: `package.json`, `package-lock.json` (version `0.3.0`), `.github/workflows/publish.yml` (default version `'0.3.0'`)
- Modify: `scripts/verify-package.mjs` (one packed core check, `register` → `show` → `retainOnly`)

- [ ] **Step 1: Replace the "construction-time registry" sentences** (`README.md:70`, `docs/solid.md:44`, `docs/react-vue.md:29`, `src/svelte/README.md:17,19`) with a short "Registering screens at run time" section. It covers `register`/`show` for an app router, `retainOnly` for revocation, `renew`, `home`, `showRetainedFirst`, `useWorkspacePage().data`, the SSR rule (register before render; Solid, Svelte and Vue also during render, before the parts) and that listeners must not register or show screens in reaction to a snapshot change. Mirror it in `README.ko.md`. State that `show()` bypasses guards and is meant for the app's router.
- [ ] **Step 2: Add a `## 0.3.0` CHANGELOG entry.** List the new API. Under **Breaking**: `open()` with a guard calls it for unregistered ids (this includes history back/forward); the switcher and Ark DOM ids use the slot; `reset()` and `dispose()` drop run-time registrations; mismatched controller and prop registries no longer throw (the controller's list wins, and prop components fill gaps).
- [ ] **Step 3: Bump the version** in `package.json`, `package-lock.json` (both the root and `packages[""]` entries) and the `publish.yml` default.
- [ ] **Step 4: Run the full verification and read its output.** Run `npm run verify` and `node scripts/verify-package.mjs`. Expected: typecheck exits 0; vitest passes; `Adapter verification passed.`; the builds succeed; Playwright passes on desktop and mobile with no failures; `All packed consumer checks passed`.
- [ ] **Step 5: Commit** the changed files with the message `docs: dynamic registry guides; release 0.3.0`.

### Task 9: PR, merge and release

- [ ] **Step 1: Push and open the PR.** Run `git push -u origin feat/dynamic-screen-registry`, then open a PR to `main` with an English and Korean body. The body lists the verified SHA, both commands and their results.
- [ ] **Step 2: Merge.** Once the `verify` check is green on that exact head SHA, run `gh pr merge <n> --repo devslab-kr/workspace --squash` as a standalone command.
- [ ] **Step 3: Publish.** The owner pre-approved this on 2026-10-20 (spec section 9). Run `gh workflow run publish.yml --repo devslab-kr/workspace --ref main -f version=0.3.0 -f publish=true`. Confirm that the run succeeds and that `npm view @devslab/workspace@0.3.0 version` prints `0.3.0` (allow about a minute for a 404).
- [ ] **Step 4: Walk the devslab release checklist.** Each surface is updated or explicitly N/A: the `.github` profile READMEs, this repo's READMEs, the CHANGELOG, the docs site (deployed by `pages.yml` from main), Discussions and `devslab-examples` (JVM only, so N/A). Then run `CLAUDE_RELEASE_CHECKLIST_OK=1 gh release create v0.3.0 --repo devslab-kr/workspace --target <merge sha> --title v0.3.0 --notes-file <0.3.0 CHANGELOG section>`.
- [ ] **Step 5: Clean up.** Remove both worktrees (`workspace-kit-registry-impl` and `workspace-kit-dynamic-screens`) and their local branches with `-D`, and delete merged remote branches with `gh api -X DELETE`, after checking the remote head equals the PR's `headRefOid`.
