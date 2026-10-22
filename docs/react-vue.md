# React and Vue adapters

Both adapters use native framework components and Ark UI Tabs/Dialog. The optional stylesheet supplies presentation; hidden/inert panels, manual keyboard activation and dialog focus management work without it.

```tsx
import { Workspace } from '@devslab/workspace/react';
import '@devslab/workspace/style.css';
const screens = [
  { id: 'orders', title: 'Orders', component: OrdersPage },
  { id: 'customers', title: 'Customers', component: CustomersPage },
];
function App() { return <Workspace screens={screens} defaultScreen="orders" />; }
```

```vue
<script setup lang="ts">
import { Workspace } from '@devslab/workspace/vue';
import '@devslab/workspace/style.css';
import OrdersPage from './OrdersPage.vue';
import CustomersPage from './CustomersPage.vue';
const screens = [
  { id: 'orders', title: 'Orders', component: OrdersPage },
  { id: 'customers', title: 'Customers', component: CustomersPage },
];
</script>
<template><Workspace :screens="screens" default-screen="orders" /></template>
```

Wrap pages to connect their own props or contexts. Screen components need no Workspace hook. Controller options and the `screens` prop are read once: remount the Provider when the app identity changes. Change screens at run time through the controller (`register`, `show`, `unregister`, `retainOnly`); see [Registering screens at run time](../README.md#registering-screens-at-run-time). `show()` and `register(…, { show: true })` run no guard and are meant for the app's router. `defaultScreen` opens after client mount; SSR starts with the empty state unless an external controller has already opened a screen. These basic SSR tests do not establish complete Next.js or Nuxt integration.

For an existing external menu, create a controller from the core entry and pass `controller`, with component `screens` for controller definitions that carry no component (the controller's list wins), with `menu={false}` / `:menu="false"`. Call `controller.open('orders')` from the existing menu. Controller mode cannot also configure `defaultScreen`, `maxTabs`, `beforeActivate`, `beforeClose` or `onChange`. Inside Provider, `useWorkspace()` returns that same controller. `useWorkspaceState()` returns a React snapshot or a readonly computed Vue ref.

`Provider`, `TabList`, `Tab`, `CloseButton`, `Panels`, `Switcher` and `SwitcherTrigger` are exported aliases for their `Workspace`-prefixed names. Provider renders the Ark Tabs root; put parts in any desired layout beneath it. `Tab` and `CloseButton` take a screen `id`. An empty `TabList` renders all open tabs by default; its children/default slot replace that layout. `Tab` forwards Ark trigger props such as `asChild`; Vue forwards attributes/listeners. `CloseButton` and `SwitcherTrigger` merge ordinary button events and respect `preventDefault()`. Default tab close controls are siblings of the tablist. A structural CSS grid interleaves triggers and close controls visually, while the ARIA tablist contains only tabs; custom TabList content must preserve that requirement. `Switcher` accepts custom dialog content, while its accessible title, description and dismissal control remain built in.

React uses `children`, `className` and render functions in `slots`. Vue uses native default slots, `class`, and the same optional render-function `slots` object for menu, tab label, switcher item, preview and empty content. Slots replace content; the default tab/menu/choice buttons retain their keyboard and ARIA behavior. `unstyled`, `classNames`, `labels`, `shortcuts`, `onResult` and `onError` customize both adapters. Shortcut handling is local to the focused Workspace and skips inputs, composing text, repeating keys and modal dialogs. A custom switcher preview is inert; `previews` enables the built-in retained DOM snapshot.

Opened pages remain mounted while inactive and receive `hidden` and `inert`. Closing or reset unmounts them. `useWorkspacePage()` exposes `{ id, active, data, screen }`: `active` and `screen` are plain values in React and readonly refs in Vue, and `data` is the tab's `createTabData` value (`undefined` without a factory). `screen` is the live definition, so a re-registered title updates without remounting. React `useActiveEffect(effect, dependencies)` runs like an effect while active; include referenced changing values in its dependency list. Vue `useActiveEffect(effect)` tracks reactive reads. Both run the returned cleanup on deactivation or unmount. Use this activity signal to gate page-owned portal dialogs as well: a portal outside a hidden panel is outside its inert subtree. Existing effects, requests and timers continue unless the app explicitly gates or cancels them.

With an external controller during SSR, register and show screens on a request-local controller before rendering, one controller per request, and replay the same registrations in the same order on the client. Vue also accepts registration in a child's setup before the tab parts render; that tab is then rendered with `aria-selected="false"` until hydration, without a mismatch. React supports registration before render only. `slots.pendingTab(id)` renders a `pending` part while a check runs for an id that has no tab yet; without that slot nothing is rendered.


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
