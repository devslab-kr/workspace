# SolidJS

SolidJS is Workspace's primary adapter. Register your existing components once; Workspace opens tabs, keeps inactive screens mounted and supplies the open-screen switcher. Your app owns business data, permissions, forms and routing.

## Install

```sh
npm install @devslab/workspace solid-js @ark-ui/solid@5.39.3
```

Use `@devslab/workspace/solid` for the Solid components and hooks. Import the optional stylesheet once at your application entry.

## Start with existing screens

```tsx
import { createSignal } from 'solid-js';
import { Workspace, type WorkspaceScreen } from '@devslab/workspace/solid';
import '@devslab/workspace/style.css';

function Orders() {
  const [query, setQuery] = createSignal('');
  return <label>Find an order
    <input value={query()} onInput={event => setQuery(event.currentTarget.value)} />
  </label>;
}

function Notes() {
  const [draft, setDraft] = createSignal('');
  return <label>Draft
    <textarea value={draft()} onInput={event => setDraft(event.currentTarget.value)} />
  </label>;
}

const screens: WorkspaceScreen[] = [
  { id: 'orders', title: 'Orders', component: Orders },
  { id: 'notes', title: 'Notes', component: Notes },
];

export function App() {
  return <Workspace screens={screens} defaultScreen="orders" maxTabs={9} />;
}
```

Opening Notes creates a tab. Switching back to Orders preserves its input. Closing a tab disposes that component; reopening creates a fresh instance. Screen IDs must be unique and nonempty. Controller options and the `screens` prop are read once; remount the workspace when the user identity changes. To add or remove screens while it runs, see [Registering screens at run time](#registering-screens-at-run-time).

## Connect an existing menu

Create the controller inside your app component. The controller's list is the registry; the `screens` prop supplies components, by id, for controller definitions that carry none (here both use the same list). With a supplied controller, put `maxTabs`, guards and `onChange` on `createWorkspace`; do not also pass standalone options or `defaultScreen` to `Workspace`.

```tsx
import { Workspace, createWorkspace } from '@devslab/workspace/solid';

export function App() {
  const controller = createWorkspace({ screens, maxTabs: 9 });
  return <>
    <nav aria-label="Business screens">
      <button onClick={async () => {
        const result = await controller.open('orders');
        if (result === 'limit') window.alert('Close a tab before opening another screen.');
      }}>Orders</button>
      <button onClick={() => controller.open('notes')}>Notes</button>
    </nav>
    <Workspace screens={screens} controller={controller} menu={false} />
  </>;
}
```

The `screens` variable here is the registry from the first example. `open(id)` opens or selects a screen, `select(id)` selects an already open tab and `close(id)` closes it. Handle the returned result when your app invokes the controller directly. The built-in menu displays transition feedback for its own actions.

## Registering screens at run time

The controller's registry can change while the workspace runs. A router registers a screen when its route succeeds and shows it; `retainOnly` removes screens whose access is gone.

```tsx
import { Workspace, createWorkspace, useWorkspacePage, type AdapterScreen } from '@devslab/workspace/solid';

type Draft = { text: string };
const controller = createWorkspace<AdapterScreen, Draft>({
  createTabData: () => ({ text: '' }),
  beforeActivate: id => navigateAndReport(id), // the route registers the screen before this resolves
});

function Report() {
  const page = useWorkspacePage<Draft>();
  return <h2>{page.screen()?.title}</h2>; // page.data is this tab's Draft
}

// In the router, once a route is allowed:
controller.register({ id: '/reports/2026', title: 'Reports 2026', component: Report }, { show: true });
// When permissions change:
controller.retainOnly(allowedIds);

export const App = () => <Workspace controller={controller} menu={false} />;
```

`show()` and `register(…, { show: true })` run no guard; they are meant for the app's router. `unregister` and `retainOnly` revoke without `beforeClose`, and `renew` replaces an open tab with a new instance. `home`, `showRetainedFirst`, `pendingId` and `slots.pendingTab` are described with the full rules in [Registering screens at run time](../README.md#registering-screens-at-run-time). In Solid, `page.active()` and `page.screen()` are accessors and `page.data` is a plain value. Listeners must not register or show screens in reaction to a snapshot change.

## Protect unsaved changes

`beforeClose` belongs to the app. Return `false` to retain the tab or a promise that resolves after your own confirmation dialog. Use `beforeActivate` for an app-owned permission or router bridge. When the active tab closes, its neighbour shows first and `beforeActivate` checks it right after; a refusal leaves no screen active.

```tsx
const [dirty, setDirty] = createSignal(false);
const controller = createWorkspace({
  screens,
  beforeClose: id => {
    if (id !== 'notes' || !dirty()) return true;
    const accepted = window.confirm('Discard unsaved notes?');
    if (accepted) setDirty(false);
    return accepted;
  },
});
```

Wire the same dirty signal to your Notes component's input and save actions. This signal is example application state, not a Workspace persistence store. See the [complete runnable demo](https://github.com/devslab-kr/workspace/blob/main/demo/main.tsx) and [live demo](https://devslab-kr.github.io/workspace/demo/).

## Run effects only while visible

Inactive panels are retained but hidden and inert. Their component effects still exist unless you explicitly gate them. `useActiveEffect` runs its callback when the screen becomes active and cleans up when it becomes inactive or closes.

```tsx
import { createSignal } from 'solid-js';
import { useActiveEffect, useWorkspacePage } from '@devslab/workspace/solid';

function Activity() {
  const [seconds, setSeconds] = createSignal(0);
  const page = useWorkspacePage();
  useActiveEffect(() => {
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  });
  return <p>{page.active() ? 'Visible' : 'Hidden'}: {seconds()} seconds</p>;
}
```

These hooks require a component mounted as a workspace screen. Gate page-owned portals with `page.active()` too: a portal renders outside the hidden panel. `useWorkspace()` and `useWorkspaceState()` require `WorkspaceProvider` context; the latter returns a reactive accessor, so read `state()` inside Solid's reactive scope.

## Compose and style

The Solid entry also exports `Provider`, `TabList`, `Tab`, `CloseButton`, `Panels`, `Switcher` and `SwitcherTrigger` aliases. Use them inside the provider to integrate your own shell. `Workspace` assembles these parts for the common case.

Use `slots.tabLabel`, `slots.preview` and `slots.switcherItem` for custom tab and switcher content. Previews are decorative; provide an understandable visible screen label. Override `labels` for translations and `classNames` for individual parts. `unstyled` omits the default part classes. The stylesheet exposes `--ws-*` tokens; see [composition and styling](../README.md#styling-and-composition).

The built-in shortcuts are `Alt+Q` for the switcher and `Alt+1` through `Alt+9` for tab slots. They skip editable targets, composition and modal contexts. Override or disable them with `shortcuts`. Arrow keys move focus between tabs; Enter activates a focused tab.

## SSR and hydration

The package exports a server build for Node, Worker and workerd conditions and a client build for browsers. By default the server renders no opened screen; `defaultScreen` opens after client mount. To render an opened screen on the server, create and pre-open a request-local controller and provide matching initial state for hydration. Register (and show) screens on it before rendering, or during render before the tab parts render, and replay the same registrations in the same order on the client so slots match. Never share a mutable controller between requests or users.

Workspace does not supply router loaders or authorization. The optional history adapter is described in [URL integration](../README.md); integrate asynchronous router transitions in your app. `RetainedPanels` is a lower-level option for app-owned dynamic screen lists, with stable item identity required to retain component owners.

## Verification and other adapters

The project's checks cover Solid browser behavior, SSR, hydration and installed-package imports. See [verification](verification.md) for the scope, [React / Vue](react-vue.md) and [Svelte](../src/svelte/README.md) for the other adapters.


## Retained screen previews (0.4.0)

React, Vue and Solid expose the same opt-in `previews` presentation option on
`Workspace` / `WorkspaceProvider`: `<Workspace previews ... />` (Vue:
`<Workspace :previews="true" ... />`). Import `@devslab/workspace/style.css` for
the default thumbnail frame, or style the `preview` part through `classNames`.
Existing `slots.preview(screen)` content takes precedence.

The switcher snapshots already mounted screen DOM when opened. It does not mount
screen components again or run their requests. Input, select, checked and scroll
state are copied; closing the switcher disposes snapshots and resize observers.
Previews are inert, hidden from assistive technology, and never replace the live
page. SSR creates no DOM snapshots. Passwords and subtrees marked
`data-workspace-preview-private` are masked. Mark other sensitive content explicitly.
Canvas/WebGL, iframes, video and external portals are not captured; use the custom
preview slot when a screen needs a different representation. This is a DOM
snapshot, not a continuously updating screenshot.

The default switcher trigger uses the DDS `layout-grid` icon with an accessible
label. Custom trigger children/default slots still override it. Core/history
remain independent of DDS; only presentation adapters use `@devslab/dds-icons`.
