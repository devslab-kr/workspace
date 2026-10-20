# Workspace

<p align="center">
  <a href="https://devslab.kr/brand/open-source/"><img src="docs/assets/brand/readme-header.png" alt="Workspace — retained tabs and screen switching. Open source by DevsLab." width="100%"></a>
</p>

<!-- publisher:start -->
Open source by [데브스랩(DevsLab)](https://devslab.kr/).
<!-- publisher:end -->

[![npm](https://img.shields.io/npm/v/%40devslab%2Fworkspace)](https://www.npmjs.com/package/@devslab/workspace)
[![CI](https://github.com/devslab-kr/workspace/actions/workflows/verify.yml/badge.svg)](https://github.com/devslab-kr/workspace/actions/workflows/verify.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](./LICENSE)

**English** · [한국어](README.ko.md) · [Documentation](docs/README.md) · [OSS brand guide](https://devslab.kr/brand/open-source/)

Retained work tabs, scoped shortcuts and an open-screen switcher. A framework-independent core with native Solid, React, Vue and Svelte adapters. Your pages keep their own forms, data, router, authorization and subscriptions.

Opening a registered screen creates its tab. The open-screen switcher is included; you supply the screen components and keep their business logic. Workspace 0.1.1 and later use Apache-2.0; the published 0.1.0 retains its original MIT license. DDS is a separate source-available design system.

## Install

```sh
npm install @devslab/workspace
# Install peers for the adapter you use, for example Solid:
npm install solid-js @ark-ui/solid@5.39.3
```

## Usage

```tsx
import { Workspace } from '@devslab/workspace/solid';
import '@devslab/workspace/style.css'; // optional

const screens = [
  { id: 'orders', title: 'Orders', component: OrdersPage },
  { id: 'customers', title: 'Customers', component: CustomersPage },
];
<Workspace screens={screens} defaultScreen="orders" />;
```

Only visited pages mount. Switching retains them behind `hidden` and `inert`; closing disposes the instance. A later open creates a fresh instance. Maximum nine tabs by default; stable slot numbers keep Alt+1–9 consistent. Alt+Q opens the switcher. Tabs use manual keyboard activation: arrows move focus; Enter/Space selects, Delete closes. Mobile supports every command through buttons.

The root and `./core` exports contain no framework runtime. Install only the optional peers used by your adapter:

| Import | Required peer packages |
| --- | --- |
| `@devslab/workspace` | none |
| `@devslab/workspace/solid` | `solid-js`, `@ark-ui/solid` |
| `@devslab/workspace/react` | `react`, `react-dom`, `@ark-ui/react` |
| `@devslab/workspace/vue` | `vue`, `@ark-ui/vue` |
| `@devslab/workspace/svelte` | `svelte` ≥5.29, `@ark-ui/svelte` |

Ark UI implements accessible interaction internally. Workspace callbacks return our values and results, not Ark details objects. Ark versions are pinned in the manifest; the Svelte adapter uses its independently versioned Ark package.

## Existing menus and guards

```ts
import { createWorkspace } from '@devslab/workspace';
const controller = createWorkspace({
  screens: [{ id: 'orders', title: 'Orders' }],
  beforeActivate: id => routerAuthorizeAndNavigate(id),
  beforeClose: id => confirmDiscardIfDirty(id),
});
await controller.open('orders');
// <Workspace controller={controller} screens={presentationScreens} menu={false} />
```

Use `useWorkspace().open(id)` inside your existing menu. Pass a controller only when the app needs external access. Controller mode and standalone options are mutually exclusive. With a controller, the controller's list is the registry; the `screens` prop only supplies components, by id, for controller definitions that have none. Options and the `screens` prop are read once: screens change at run time through the controller ([below](#registering-screens-at-run-time)). Remount for a different app identity.

Commands: `open`, `select` (already-open tabs only), `close`, `showSwitcher`, `hideSwitcher`, `cancelPending`, `reset`, and the registry methods below. Transitions return `ok`, `unknown`, `limit`, `denied`, `cancelled` or `stale`. For `open` and `select`, a refused or throwing guard keeps the selected page, unless the screen being checked is the one on display (re-opening the active screen, `showRetainedFirst`, or a screen the router already showed): then no screen is active. Only the latest valid transition commits. Closing does not wait for the next screen: after `beforeClose` allows it, the tab leaves at once and its neighbour shows straight away, then the neighbour's `beforeActivate` runs. If that guard refuses, `close` resolves `denied` and no screen is active: the empty state shows and the first remaining tab stays in the Tab order. If it throws, `close` rejects with the same empty state. If a later `open` or `select` commits, `show()` makes another screen active, `reset()` runs, or the shown neighbour is closed or revoked first, the check no longer applies and `close` resolves `stale`. A close still waits one microtask before it commits, as in 0.2.0, even without `beforeClose`. Focus moves to the shown tab when the closed control disappears, but not out of a page the user has already moved into. `reset()` immediately discards all work and invalidates pending guards: use it for logout/company changes. It bypasses dirty-close confirmation deliberately.

## Registering screens at run time

The controller keeps a live registry. The `screens` option (or standalone prop) is optional and is only the starting list. An app router adds a screen when its route succeeds and removes screens when access is lost. Change screens through the controller (`useWorkspace()` inside the workspace, or the controller you pass in), not by changing the `screens` prop.

```ts
import { createWorkspace, type AdapterScreen } from '@devslab/workspace/solid';

const controller = createWorkspace<AdapterScreen, { draft: string }>({
  home: 'dashboard',
  createTabData: () => ({ draft: '' }),
  beforeActivate: id => navigateAndReport(id), // the route registers the screen before this resolves
});
// In the router, once a route is allowed:
controller.register({ id: path, title, component: Page }, { show: true });
// When permissions change:
controller.retainOnly(allowedIds);
```

- `register(screen, { show?, renew? })` adds or updates a definition and returns `ok` or `limit`. Updating an open screen changes its title and the definition the page reads, and keeps the same tab, page and data. A tab keeps the component it was created with; `{ renew: true }` replaces an open tab in place (same slot and position, a new instance and fresh data) and disposes the old page. Over the tab cap the definition is still stored and only the tab is refused.
- `show(id)` makes a registered screen active and returns `ok`, `unknown` or `limit`. **`show()` and `register(…, { show: true })` run no guard.** They are meant for the app's router, which has already allowed the route. Showing the screen whose check is running is part of that check; showing another screen overtakes it (`stale`).
- `unregister(id)` and `retainOnly(ids)` are revocation, not closing. They remove the definition and its tab without `beforeClose` and without showing a neighbour; if the active tab goes, no screen is active until the app shows one. A later `open(id)` asks the guard again. Running checks, opens and closes of removed screens resolve `stale`. `retainOnly` returns the removed ids. `reset()` closes every tab and restores the starting list exactly.
- `open(id)` of an id that is not registered: without `beforeActivate` it returns `unknown`. With a guard it checks the tab cap, runs the guard, then reads the registry: if the route registered the screen meanwhile it opens, otherwise `unknown`.
- `home` (an id, or a function returning one): closing the only tab when it is home is refused (`cancelled`) and `canClose(id)` is false, so packaged close buttons are disabled and Delete does nothing. Closing the last tab of another screen opens home through its guard. If `home` is not registered and there is no `beforeActivate` guard, the last tab is still removed and `close()` resolves `unknown` (the workspace is empty). Packaged parts re-read the disabled state on a snapshot change, so a `home` function that reads outside state takes effect at the next change.
- `showRetainedFirst: true`: `open(id)` of an open tab shows it at once and checks it afterwards; a refusal leaves no screen active. While it runs, closing other tabs, an `open` of another screen that does not commit, or `cancelPending()` (which the URL adapter calls on every new URL) does not end the check: its answer still decides, the same way a closed tab's neighbour check does. The URL adapter accepts that screen's URL only after the check allows it, so a refused back/forward restores the last accepted URL.
- `createTabData(screen)` runs once per tab instance (a new tab or a renewal). Its value is `Tab.data` and `useWorkspacePage().data`. Without it, `data` is `undefined`. The core types' data parameter (`Tab<D>`, `Snapshot<S, D>`, `Options<S, D>`) defaults to `undefined`; `useWorkspacePage<D>()` defaults to `unknown`, so pass `D` to type `data`.
- `snapshot.pendingId` is the id whose `beforeActivate` is running, for every kind of check; when a newer check starts while a check of the screen on display keeps running underneath, it names the newer one. `snapshot.activePending` is `true` while any check of the active screen is running, at either depth, and absent otherwise. Packaged tabs mark `pendingId` `aria-busy`. For an id with no tab yet, the optional `slots.pendingTab(id)` renders a `pending` part after the default tab strip's close buttons, outside the tab list; without that slot nothing is rendered.
- `getScreen(id)`, `getTab(id)` and `canClose(id)` read the current state.
- Pages: `useWorkspacePage()` returns `{ id, active, data, screen }`; `screen` is the live definition, so its title updates without remounting. Packaged panels still render the component with no props.
- Adapter definitions are `AdapterScreen` (`component` optional). With a controller, its list wins and the `screens` prop fills missing components by id. A screen with no component in either renders an empty panel; a component added later takes effect only through `renew`.
- The default menu lists the `screens` prop when it is non-empty, otherwise the live registry. `menus` items may name screens that are not registered yet; give those a `label`.
- Listeners and `onChange` run synchronously inside every commit, including while a guard runs (`pendingId` changes). **They must not register or show screens in reaction to a snapshot change**; registration belongs to the router.
- SSR: register (and show) on a request-local controller before rendering, one controller per request, and replay the same registrations in the same order on the client so slots match. In Vue, bind boolean options such as `showRetainedFirst` (`:show-retained-first="true"`): a bare attribute arrives as `''`, which is not `true`. Solid, Svelte and Vue also accept registration during render, before the tab parts render; Vue then renders that tab with `aria-selected="false"` until hydration, without a mismatch. React supports registration before render only.

## Styling and composition

CSS is optional. Theme through `--ws-*` variables, `classNames`, content `slots`, or `unstyled`. Mechanical visibility and inactive-page focus exclusion work without CSS. Slots change labels/content while preserving accessible buttons. Headless parts provide control over layout:

For DDS styling, load your licensed DDS tokens and `@devslab/workspace/style.css`, then `@devslab/workspace/dds.css`. The optional mapping references DDS variables without bundling DDS assets. Set theme variables on `:root` (or both the workspace and switcher classes) so body-portalled dialogs inherit them. Supported tokens include `--ws-text`, `--ws-background`, `--ws-surface`, `--ws-border`, `--ws-accent`, `--ws-on-accent`, `--ws-focus`, `--ws-overlay`, `--ws-font`, `--ws-dialog-radius` and `--ws-dialog-shadow`.

```tsx
<WorkspaceProvider screens={screens} defaultScreen="orders" unstyled>
  <MyNavigation />
  <WorkspaceSwitcherTrigger />
  <WorkspaceTabList />
  <WorkspaceStatus />
  <WorkspacePanels />
  <WorkspaceSwitcher />
</WorkspaceProvider>
```

Compose `WorkspaceTab` and `WorkspaceCloseButton` for custom tab strips. Keep close controls outside the element with `role="tablist"`. `asChild` supports existing buttons with merged events/ref; `preventDefault()` cancels the Workspace action. Solid receives native attributes in its callback; React/Vue use their native Ark composition convention, Svelte uses a snippet and bindable `ref`.

Pages can optionally use `useWorkspacePage()` and `useActiveEffect()` to run app subscriptions only while active. React uses dependency arrays, Vue uses reactive refs, Solid uses accessors, Svelte uses getter/runes. Inactive page portals must consult page activity. Workspace never refetches, invalidates, clones page DOM, or transmits analytics. Supply static previews through `slots.preview` if useful.

Shortcuts skip editable elements, IME composition, repeat events and app dialogs. They apply only to events originating in the workspace. Disable with `shortcuts={false}` or configure `shortcuts={{switcher:'Ctrl+q',slots:['Alt+1','Alt+2']}}`. Set `dir` explicitly for SSR RTL; otherwise adapters inherit ambient direction after mount.

Default screens open after mounting, so default SSR output is empty. Preopen a request-local controller before SSR to render visited pages (see the registration rule above). Set `dir` explicitly for server RTL. No Next/Nuxt/SvelteKit integration is claimed.

`createHistoryWorkspace(options, browserHistory(window))` optionally connects initial URLs and browser back/forward. Supply `screenFromUrl` and `urlForScreen`; the returned `{controller,ready,dispose}` uses the same activation guard before showing a destination. Rejected back navigation restores the last accepted URL with replaceState, without adding an entry. App selection pushes only a changed URL. Closing the active tab pushes the neighbour's URL as soon as it shows, before its guard finishes. The last accepted URL is always the last screen whose check actually allowed it: a screen shown while its own check runs (a closed tab's neighbour, `showRetainedFirst`), even underneath a newer check, becomes accepted only when that check allows it. If a neighbour's guard refuses, the URL stays on the refused screen, but a later refused navigation restores the last allowed screen's URL; loading the refused screen's URL again runs the guard again. `sync()` reads the current URL again and opens its screen. With a guard, back/forward to an id that is not registered runs the guard, and the registry is read after it. Disposal removes the history listener and resets the controller, dropping run-time registrations. Do not combine the history adapter with `show()` from another router: one URL owner per workspace. The history adapter is synchronous; TanStack/React Router loaders and their async cancellation remain app-owned. A navigation guard bridge alone does not implement an async router integration.

## Verification

`npm run typecheck`, `npm run check:svelte`, `npm test`, `npm run build`, `npm run build:demo`, `npm run test:e2e`, then `node scripts/verify-package.mjs`. Svelte fixtures have separate browser/SSR runners under `tests/svelte/`. Package installation verification checks optional peers, installed exports and Solid browser hydration; source imports alone are insufficient. [SolidJS guide](docs/solid.md), [Native React/Vue examples](docs/react-vue.md), [Svelte guide](src/svelte/README.md), [Korean guide](README.ko.md).

### Externally owned dynamic pages (Solid)

`RetainedPanels` supports an app whose guarded router synchronously registers authorized pages, including during SSR. The app keeps its own list, payloads, activity predicate and navigation commands; this component owns native page retention and inactive `hidden`/`inert` behavior.

```tsx
import { RetainedPanels } from '@devslab/workspace/solid';

<RetainedPanels
  items={authorizedPages()}
  active={page => routeReady() && page === activePage()}
  as="section"
  panelProps={page => ({ id: page.id, role: 'tabpanel', 'aria-labelledby': page.tabId })}
>
  {page => <PageContext.Provider value={page.activity}><Dynamic component={page.component} {...page.payload()} /></PageContext.Provider>}
</RetainedPanels>
```

Keep each item object stable to preserve its component owner. Removing or replacing that object disposes its page; selecting another item retains it. This is a separate integration surface from the `Workspace` controller registry and supplies no router, authorization store or data cache. Gate page-owned portals with the app's activity context. Native attributes are forwarded through `panelProps`; activity always controls `hidden` and `inert`.
`controller.cancelPending()` invalidates outstanding activation/close guards without changing retained tabs, active page, or switcher state. A close that has already removed its tab is not undone; its check of the shown neighbour still applies, and so does any other check whose screen is on display (`showRetainedFirst`, or a screen the router showed during its check). The URL adapter calls it on every new URL intent, including unmapped, unknown, and tab-limited destinations, so an older guard cannot restore an obsolete URL. Switcher-only changes do not push history entries.

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, verification and documentation conventions. Release maintainers should follow [the OIDC release guide](docs/releasing.md).

## Family

- [kokey](https://github.com/devslab-kr/kokey) — keyboard-layout conversion for business forms.
- [numkey](https://github.com/devslab-kr/numkey) — caret-safe numeric inputs.
- [DDS](https://github.com/devslab-kr/dds) — a separately licensed design system, with an optional Workspace token mapping.
- [More open source from DevsLab](https://github.com/devslab-kr).

## License

[Apache-2.0](LICENSE) © [DevsLab](https://devslab.kr/).
