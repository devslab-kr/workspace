# Changelog

## 0.3.0

- The controller keeps a live screen registry. `screens` is optional and is the starting list. New controller methods: `register(screen, { show, renew })`, `unregister(id)`, `retainOnly(ids)`, `show(id)`, `getScreen(id)`, `getTab(id)` and `canClose(id)`.
- New options: `createTabData` (per-tab `data`, a new value for each tab instance), `home` (keeps the workspace from emptying) and `showRetainedFirst`. `Tab` and `Snapshot` take a data type parameter; `Tab.data` is `undefined` without a factory.
- `Snapshot.pendingId` names the screen whose `beforeActivate` is running. Packaged tabs mark it `aria-busy`; the optional `slots.pendingTab` renders a `pending` part for an id that has no tab yet.
- `show()` and `register(…, { show: true })` run no guard; they are meant for an app's router. `unregister`, `retainOnly` and `reset` revoke without `beforeClose` or a neighbour.
- Adapters read screens from the controller, so re-registered titles update. `AdapterScreen` makes `component` optional on controller definitions; the `screens` prop fills missing components by id. `useWorkspacePage()` returns `data` and `screen` in Solid, React, Vue and Svelte. Close buttons are disabled when `canClose` is false.
- `createHistoryWorkspace` accepts the generic options and returns a typed `HistoryWorkspace`.
- **Breaking:**
  - `open()` with a `beforeActivate` guard now calls the guard for ids that are not registered, and reads the registry afterwards. This includes `createHistoryWorkspace` back/forward.
  - Re-opening the already active screen with a refusing guard now leaves no screen active: a refused check clears the screen when the checked screen is on display.
  - A check whose screen is on display (`showRetainedFirst`, a closed tab's neighbour, or a screen the router showed during its check) is not ended by closing other tabs, an `open` that shows nothing, or `cancelPending()`; it ends when another activation commits, another screen is shown, its screen is closed or revoked, or `reset()` runs. `createHistoryWorkspace` accepts such a screen's URL only once its check allows it.
  - While a guard runs, snapshots change (`pendingId`), so listeners and `onChange` may fire during a check. A close whose neighbour has a guard notifies twice (the commit, then `pendingId` clearing).
  - Solid, React, Vue and Svelte: the switcher choice ids and the Ark tab trigger and content ids are built from the slot, not the screen id.
  - `reset()` and the history adapter's `dispose()` drop run-time registrations and restore the starting list.
  - A controller registry and a `screens` prop that differ no longer throw: the controller's list wins, and prop components fill gaps. A menu item naming an unregistered screen no longer throws either; give it a `label`.
- Closes keep the one-microtask wait from 0.2.0.

## 0.2.0

- **Breaking:** closing the active tab no longer waits for the next screen's `beforeActivate`. After `beforeClose` allows it, the tab leaves at once and its neighbour shows straight away; the neighbour's guard runs afterwards. If it refuses, `close` resolves `denied` and no screen is active; if it throws, `close` rejects with no screen active. If a later `open` or `select` commits, `reset()` runs, or the shown neighbour is closed first, the check no longer applies and `close` resolves `stale`. Before 0.2.0 a refused neighbour kept the closing tab open.
- `createHistoryWorkspace` pushes the neighbour's URL when it shows, before its guard finishes; a refused neighbour's URL stays as the last accepted URL.
- A tab that is reopened while its earlier close is still checking the neighbour gets its own close.
- Solid, React, Vue and Svelte panels show the empty state whenever no screen is active, including while tabs stay open after a refused neighbour. The first remaining tab then stays in the Tab order.
- After a close, focus moves to the shown tab as soon as the closed control disappears, and is not taken from a page the user has already moved into.

## 0.1.2

- Make the default toolbar a continuous tab strip with no gaps between the switcher, tab labels and close controls.
- Use a shared active surface and indicator for tab labels and their close buttons across Solid, React, Vue and Svelte.
- Align the public demo with the package defaults.

## 0.1.1

- Publish with GitHub Actions OIDC only; remove the initial-token fallback.
- Align English and Korean READMEs with the DevsLab OSS format and shared site-kit publisher attribution.
- Add the user-approved blue Workspace Q-line logo, light/dark assets, brand guide and documentation index.
- Change the license to Apache-2.0 for this and future versions. Version 0.1.0 retains its original MIT license.

## 0.1.0

- Initial npm release: framework-independent retained-workspace core, Solid/React/Vue/Svelte adapters, tab shortcuts, open-screen switcher, guards and optional history integration.
- Original license: MIT.
