# Dynamic screen registry — design proposal

**English** · [한국어](2026-10-20-dynamic-screen-registry-design.ko.md)

- Date: 2026-10-20
- Status: **proposal, waiting for the owner's choice.** No package code has been written.
- Package: `@devslab/workspace` 0.2.0 (main `08ae79a`)
- First intended consumer: fm-dental (`src/features/admin/workspace/`)

## 1. Why

Today the package needs the full list of screens when the workspace is created, and that list never changes. fm-dental does not know its screens up front: a screen exists only after the router has checked the user's permission and loaded its data. So fm built its own tab model (fm PR #67, 2026-10-01, a week before the package existed) and, when it adopted the package in fm PR #126, took only `RetainedPanels` and kept its own tabs.

The cost showed up on 2026-10-20: the "close a tab without waiting for the next screen" fix had to be written twice, once in the package (devslab-kr/workspace#7, 0.2.0) and once in fm (fm PR #151). The owner agreed the package should learn to take its screen list dynamically, so that fm can later hand its tab rules to the package and keep only what is really fm's: the router, permissions and business data.

**Goal:** the package can add, update and remove screens while it runs, with the same behaviour in Solid, React, Vue and Svelte, so that fm could move its tab model onto it.

**Not in scope:** a router, permission checks, a data cache, or fm's visual design. The package still never calls the network.

**Would make this a failure even if it works:** a retained page that loses its typed input because the list changed; a revoked screen that stays visible; the 0.2.0 close rules quietly changing; a second state machine that fm still has to keep in step by hand.

## 2. What fm needs and what the package offers

| fm need | How fm does it today | Package 0.2.0 | Gap |
| --- | --- | --- | --- |
| **Register a screen only after the router succeeds.** A screen (its component and loader data) appears only once `beforeLoad` and the loader have passed. | `WorkspaceRoute` calls `register()` from the route's render once the router reports success (`AdminWorkspaceRoute.tsx:33-50`; on the server it registers synchronously, `:45`). | The registry is fixed in `createWorkspace({ screens })` (`core.ts:17`). `open()` of an id that is not in it returns `unknown` before any guard runs (`core.ts:37`). | No way to add a screen at run time. |
| **Router-driven activation.** Links, back/forward and direct URLs make a screen active without anyone calling `open()`. | `register()` itself activates the path (`AdminWorkspace.tsx:212`). | Activation only happens through `open()`/`select()`, which always run `beforeActivate`. | No "the router already allowed this, show it" entry point. |
| **Per-tab app data that keeps its identity.** Each tab carries loader props, a refresh counter, a hand-over selection and an attention counter; their accessors must survive route outlet swaps. | `WorkTab` holds `payload`, `version`, `selection`, `attention` signals (`AdminWorkspace.tsx:31-45`). | `Tab = { id, slot, instance }` (`core.ts:3`); nothing for app data. | No place for app data on the tab. |
| **Partial revoke by an allowed set.** When the menu grants shrink, only the screens that lost access close; the rest stay. | Filters tabs against the allowed set on every registration (`AdminWorkspace.tsx:169-172`). | Only `reset()`, which closes everything. | No partial removal. |
| **Identity reset.** A different user, role or company drops every tab and page. | Compares an identity string and calls `clear()` (`AdminWorkspace.tsx:164-166`, `:132-139`). | `reset()` exists (`core.ts:99`). | Covered, but `reset()` would also have to forget registered screens. |
| **Show a retained tab at once, check it afterwards.** Clicking an open tab shows it immediately while the router revalidates it in the background. | `open()` sets the active path before navigating (`AdminWorkspace.tsx:229-238`). | `open()` commits only after `beforeActivate` resolves (`core.ts:40-53`). Only the 0.2.0 close shows a neighbour first. | Retained-first display is missing for `open()`. |
| **Tab cap with app feedback.** At 9 tabs a new screen is refused with a toast, including when the router (not `open()`) brings the 10th screen; the app then returns to the previous screen. | `MAX_WORKSPACE_TABS = 9`, toast and navigate back (`AdminWorkspace.tsx:182-191`, `:220-223`). | `maxTabs` (default 9) and the `limit` result for `open()`. | Router-driven registration over the cap has no result to react to. |
| **Path-like ids.** Screen ids are URL paths such as `/admin/clinics`. | Ids are paths; DOM ids come from the slot (`work-tab-${slot}`, `AdminWorkspace.tsx:327-328`). | Ids are opaque strings; Ark builds trigger ids from the value, and the switcher builds `${prefix}-choice-${id}` (`Workspace.tsx:177`). | Works for paths today, but DOM ids should not depend on id characters. |
| **Pending feedback.** While the router is still checking a new screen, the tab bar already shows a placeholder tab with the menu's title, marked busy. | `readChromeTabs()` adds a chrome-only tab (`AdminWorkspace.tsx:107-118`). | Nothing; the snapshot has no pending state. | No pending state to render from. |
| **Never empty.** Closing the last tab goes to the area's home screen; the home tab cannot be closed when it is the only one. | `close()` falls back to `home()` and the close button is disabled (`AdminWorkspace.tsx:273-275`, `:375`). | Closing the last tab leaves the empty state. | No "home" rule. |
| **SSR.** The server renders the visited page with its tab. | The route registers during server render, before the tab bar renders; the bar reads lazily on the server (`AdminWorkspace.tsx:116-118`). | "Preopen a request-local controller before SSR" (README). Works for a fixed registry only. | Needs a rule for registered screens on all four adapters. |

fm also has things the package should **not** take: the router bridge itself, the permission/menu model, `warmPageCode`, the selection hand-over, Realtime/Usage/Guide providers, the error boundary, the DOM-cloning switcher preview and the DDS-based visual design.

## 3. Rules any option must keep

1. **The 0.2.0 close contract stays exactly as released.** Closing the active tab removes it at once and shows its neighbour, then checks the neighbour with `beforeActivate`; a refusal resolves `denied` with no screen active; being overtaken resolves `stale` (CHANGELOG 0.2.0).
2. **The core stays framework-free**: no DOM, network, timers, router or persistence (`core.ts:1`). Router integration stays in app-supplied guards.
3. **A retained page is never remounted** because the list changed. Only removal (close, revoke, reset) or an explicit renewal disposes it.
4. **Solid, React, Vue and Svelte behave the same.** Each rule gets a core test and adapter parity checks.
5. **Versioning:** the package is 0.x, so a minor release (0.3.0) may break; every break is listed in the CHANGELOG under **Breaking**.

## 4. Options

### Option A — Live registry inside the controller (push)

The controller keeps its registry but it becomes changeable. The app pushes screens in when its router succeeds and takes them out when access is lost.

```ts
interface Tab<D = undefined> { id: string; slot: number; instance: number; data: D }
interface Snapshot<S, D> {
  tabs: readonly Tab<D>[];
  screens: readonly S[];       // the current registry; replaced on every change
  activeId?: string;
  pendingId?: string;          // the id whose check (beforeActivate) is running
  switcherOpen: boolean;
}
interface Options<S extends Screen, D> {
  screens?: readonly S[];                      // the starting list (was required)
  createTabData?: (screen: S) => D;            // called once per new tab instance
  showRetainedFirst?: boolean;                 // default false
  home?: string | (() => string | undefined);  // the screen that keeps the workspace from emptying
  maxTabs?: number; beforeActivate?; beforeClose?; onChange?;   // unchanged
}
// New controller methods (open/select/close/showSwitcher/... keep their signatures)
register(screen: S, options?: { show?: boolean; renew?: boolean }): Result; // 'ok' | 'limit'
unregister(id: string): boolean;
retainOnly(ids: Iterable<string>): readonly string[];   // returns the removed ids
show(id: string): Result;                                // 'ok' | 'unknown' | 'limit'; runs no guard
getScreen(id: string): S | undefined;
getTab(id: string): Tab<D> | undefined;
canClose(id: string): boolean;
```

**Behaviour, in plain words.** A "check" below is any `beforeActivate` call the controller makes: for `open()`/`select()`, for a closed tab's neighbour (0.2.0), for home, and for a retained tab shown first.

- **The registry is one list with a starting point.** `screens` passed at construction is the starting list. `register`, `unregister` and `retainOnly` change the live list; `reset()` closes every tab and puts the live list back to the starting list exactly (registrations, updates and removals are all dropped).
- `register(screen)` adds or updates a definition. Updating an open screen changes its title and the screen object the page can read, but **keeps the same tab object, page and data**. A tab keeps rendering the component it was created with: a new `component` takes effect only through `renew`, never by itself, so an update can never remount a page. With `{ show: true }` it also makes the screen active without running `beforeActivate`, because the router has already allowed it. With `{ renew: true }` an open tab is replaced in place (same slot, same position, a new instance and fresh data), which disposes the old page. fm needs this for driver routes that swap an allowed page for the "menu denied" page.
- `show(id)` is the router's "this is now the screen" for an already registered id. It never runs a guard.
  - **Showing the screen that is being checked is part of that check.** In fm every check is "navigate the router", and the route calls `register(page, { show: true })` for that very screen before the check returns. That show does not end or overtake the check: the check still finishes with the guard's own answer.
  - **Showing a different screen overtakes any running check**, which then resolves `stale`, exactly like a later `open` or `select` in 0.2.0.
- **A refused check clears the screen only if the checked screen is on display.** If the screen being checked is active when its guard says no (retained-first, a closed tab's neighbour, or a new screen the router already showed), the result is `denied` and no screen is active. If it was not on display (a plain `open()` that nothing showed yet), a refusal changes nothing, as today. A guard that throws behaves like a refusal and the error is passed on, as in 0.2.0.
- `open(id)` of an id that is not registered yet: with no `beforeActivate`, it still returns `unknown` at once. With a guard, it first checks the tab cap (a new tab), then runs the guard (fm's guard is "navigate the router"), and checks the registry **after** the guard: if the route registered the screen meanwhile, it opens; if not, `unknown`.
- `showRetainedFirst: true`: `open(id)` of an already open tab makes it active at once and checks it afterwards, the same way 0.2.0 shows a closed tab's neighbour.
- `unregister`, `retainOnly` and `reset` are **revocation, not closing**. They remove the definition as well as its tab, so a later `open(id)` asks the guard again (the router decides whether access is back). No `beforeClose` runs (an unsaved-form prompt is meaningless once access is gone), no neighbour is shown, and if the active tab is removed no screen is active until the app or router shows one. Running checks, opens and closes of the removed screens resolve `stale`; other running requests continue.
- `home`: closing the only tab when it is the home screen is refused (`cancelled`), and `canClose` reports false so the parts disable that button. Closing the last tab of any other screen removes it at once and then opens home through its guard; `close` resolves with that open's result. While other tabs remain, home plays no part.
- `pendingId` is the id whose check is running, whichever kind of check it is, so the busy marker also shows while a close's neighbour or home is being checked. The parts mark a retained tab busy; a placeholder tab for a not-yet-registered id is an opt-in slot, because only the app knows its title (fm takes it from the menu).
- **Screens are added through the controller**, not by changing a component prop: `useWorkspace().register(...)` inside the workspace, or an external controller passed in. The `screens` prop stays the starting list, read once, as today. This keeps SSR replay simple.
- **Pages read their tab.** `useWorkspacePage()` gains `data` (the tab's data) and `screen` (the current definition, updating when it is re-registered) in all four adapters; packaged panels still render the component with no props. Apps that need props read them from there, or render their own pages through `RetainedPanels` as fm does.
- **Listeners must not register or show screens in reaction to a snapshot change.** Subscribers and `onChange` run synchronously inside every commit, before the next check starts; registration belongs to the app's router, which acts later.

**How fm would use it.** `WorkspaceRoute` stays; its `register()` becomes: identity changed → `reset()`; `retainOnly(allowed + this path)`; `register(page, { show: true, renew: driverSwap })`; on `limit`, the same toast and navigate-back as today. `beforeActivate` is "navigate the router to this path and report whether that path succeeded". fm keeps rendering pages through `RetainedPanels`, fed from `snapshot.tabs`, and keeps its own DDS tab bar, switcher dialog and hotkeys.

**Adapters.** All four: drop the "controller and component screen registries must match" and "menu references an unknown screen" checks (`Workspace.tsx:65-66`, `react.tsx:37`, `vue.ts:37-38`, `WorkspaceProvider.svelte:12-13`); the controller becomes the only registry, holding the component-bearing screens; look screens up from the snapshot so titles update; build DOM ids from the slot; disable the close button when `canClose` is false; render the busy state. Menu items may name screens that are not registered yet, and those items must carry their own label. Vue reads the snapshot during setup but subscribes only after mount (`vue.ts:39-40`), so on the server it misses registrations made after the provider's setup; it should subscribe during setup, as the Svelte adapter does.

**SSR.** The core stays synchronous. The rule for all four adapters: register and show screens on a request-local controller **before** rendering, and replay the same registrations in the same order on the client so slots match during hydration. Solid and Svelte also tolerate registering during render, as long as it happens before the tab parts render (this is what fm does today); React does not allow side effects during render, so only "before render" is supported there.

**0.2.0 close contract.** Unchanged for user closes. Revocation is defined as separate from closing, as `reset()` already is. The 0.2.0 sentence "if a later `open` or `select` commits" gains "or `show()` makes another screen active"; for apps that never call `show()` nothing changes. One ordering fact is written down because fm depends on it: a close commits, then notifies its listeners synchronously, then starts the neighbour's (or home's) `beforeActivate` in the same synchronous step, with nothing awaited in between. A router bridge therefore moves the location before any awaited task (a loader, a refresh) can run, and the closed screen cannot register itself back. Listener code is the only thing that runs first, which is why listeners must not register screens.

**URL adapter.** `createHistoryWorkspace` keeps its job (the package owns the URL) and only adopts the new generic options. Back/forward to an id that is not registered now runs the guard (the registry is checked after it), and `dispose()` resets the live list to the starting list. An app whose own router owns the URL, like fm, uses `show()` and does not combine it with `createHistoryWorkspace`; two URL owners are not supported.

**Versioning.** 0.3.0, breaking: `open()` with a guard now calls the guard for unregistered ids (this also reaches `createHistoryWorkspace` back/forward); the switcher's DOM ids change from the screen id to the slot; `reset()` and the history adapter's `dispose()` drop runtime registrations. Everything else is additive.

- **For:** one state machine, tested once, used by fm and everyone else; the ordering rules fm fixed by hand (close order, stale, cap, retained-first) live in package tests; static apps keep working by passing `screens` as before.
- **Against:** the largest change of the three (core plus four adapters); the core API grows by seven methods and three options; `show()` and `register({ show })` bypass guards by design, so their docs must say plainly that they are for an app's router.

### Option B — App-owned list, package-provided parts (no core change)

Extend the `RetainedPanels` idea to the tab bar, the switcher and the shortcuts: new parts that take an app-owned `items` list plus `activeId`, `onSelect`, `onClose`, `title`, `slot` callbacks. The package draws and handles the keyboard; the app keeps all state.

- **fm would delete** only its tab bar markup, the switcher's arrow-key handling and the hotkey setup — about 50 lines — and keep its whole state machine.
- **Adapters:** two or three new parts in each of the four; the core is untouched.
- **SSR:** easiest, since the app renders whatever it already has.
- **0.2.0 close contract:** the package no longer enforces it for these apps; each app re-implements the close order (fm already does since #151).
- **Versioning:** 0.3.0, additive only, nothing breaks.
- **For:** smallest, safest change; nothing for existing users to migrate.
- **Against:** it does not do what was agreed. The duplicated rule set that caused the double fix on 2026-10-20 stays duplicated, and every future fix to tab ordering is written twice again.

### Option C — Screen resolver (pull)

Instead of the app pushing screens in, the controller asks: `createWorkspace({ resolveScreen(id): S | undefined | Promise<S | undefined> })`. `open(id)` of an unknown id calls the resolver after the guard and caches the answer. Revocation still needs `retainOnly`.

- **Fits** apps whose allowed screens come from a server list ("which screens may this user open?").
- **Does not fit fm alone:** fm's screens also appear through links, back/forward and direct URLs, where no `open()` is called and nothing would ask the resolver. fm would still need A's push methods (`register`, `show`).
- **SSR:** an async resolver cannot run during render, so it falls back to A's "before render" rule.
- **Versioning:** 0.3.0, mostly additive.
- **For:** neat for permission-catalogue apps.
- **Against:** for fm it is A plus an extra concept; it can be added later on top of A if a real consumer asks for it.

## 5. Recommendation

**Option A**, released as 0.3.0, then fm adopts **the core only** in its own PR, keeping its DDS tab bar, switcher dialog, hotkeys and `RetainedPanels`. Whether fm later also uses the package's switcher and shortcut parts is a separate, later choice.

Suggested order (the builder may merge steps): core rules and their tests → the four adapters, docs and CHANGELOG → 0.3.0 release → fm adoption PR under fm's own release rules.

**Where the first plan stops.** The package plan ends at a merged, verified 0.3.0 pull request. Publishing to npm goes through the package's release workflow with the owner's go-ahead (`docs/releasing.md`). fm adoption is a separate, later plan: fm's `AGENTS.md` currently forbids running tests, lint, build and typecheck and limits merges, so that work can only be planned once fm's own rules allow verifying it.

## 6. What fm-dental would delete if it adopted Option A

In `src/features/admin/workspace/AdminWorkspace.tsx` (473 lines), roughly 150 lines go:

- `WorkTab`'s slot, title and component handling (`:31-45`); the four signals move into fm's `createTabData`, so the type shrinks to fm's own data.
- The `tabs` signal and the request bookkeeping: `pendingPath`, `retainedPendingPath`, `navigationVersion`, `rejectedPath` (`:79-92`).
- `readChromeTabs`, `chromeTabs` and `selectedTabPath` (`:107-119`), replaced by `snapshot.tabs` and `snapshot.pendingId` plus a short menu-title lookup.
- The tab half of `clear()` (`:132-139`), replaced by `reset()`.
- Most of `register()` (`:161-215`, about 55 lines to about 20).
- The ordering part of `open()` (`:217-262`, about 45 lines to about 15: `warmPageCode`, the selection hand-over and the attention bump stay).
- `close()` (`:270-284`), replaced by `close()` with the `home` option.

In `src/features/admin/workspace/workspace-state.ts`: `MAX_WORKSPACE_TABS` and `nextWorkspaceSlot` (`:1-9`); the package default `maxTabs: 9` is the same number.

**fm keeps:** `AdminWorkspaceRoute.tsx` (the router bridge, now calling the package), its contexts in `admin-workspace-context.ts`, the router-success part of `visible()`, the DDS tab bar and switcher dialog, TanStack hotkeys, `WorkspacePreview`, the error boundary, the driver page header and the Realtime/Usage/Guide providers.

Every boundary in fm's `docs/qa/workspace-oss-migration.ko.md` ("유지해야 하는 경계") still holds: the router keeps validating, retained screens show first, tab data keeps its identity, revocation and identity changes still dispose pages. The last boundary, "do not bypass fm's dynamic route registration with a fixed-registry component", stops being a reason to keep the tab model in fm, because the registry is no longer fixed.

## 7. Calls made in this design (not yet agreed by the owner)

These came up when a reviewer read the draft as a builder. They are the author's calls; the owner may overturn any of them.

1. A `show()` of the screen being checked is part of that check; the guard's answer still decides. A `show()` of another screen overtakes it (`stale`).
2. A refused check empties the screen only if the checked screen is on display; otherwise it changes nothing.
3. Revocation removes the definition too, and `reset()` returns to the exact starting list.
4. A re-registered screen keeps the component its tab was created with; only `renew` swaps it.
5. `pendingId` covers every check, including a close's neighbour and home.
6. Screens are added through the controller; the `screens` prop stays a starting list read once.
7. `useWorkspacePage()` gains `data` and `screen`; packaged panels still pass no props.
8. `home` and `showRetainedFirst` are in the package (fm needs both, and both are about order, which is the package's job); both are off unless set.
9. `createHistoryWorkspace` is not combined with `show()`; one URL owner per workspace.

## 8. Left to the builder

- Internal mechanics (how running checks are tracked, whether `register({ show })` and `retainOnly` notify once or twice in the same turn). If tests show a visible flash between two commits, a small `transaction(fn)` helper is acceptable.
- Exact type parameter names and default type arguments.
- Whether the placeholder slot is one slot per adapter or reuses `tabLabel`.
- Test file layout, as long as every rule in section 4A has a core test and the adapters have parity checks, an SSR check with a preopened request-local controller, and an end-to-end case with path-like ids.

## 9. Decision

_To be filled in with the owner's choice._
