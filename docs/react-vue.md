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

Wrap pages to connect their own props or contexts. Screen components need no Workspace hook. Screens and controller options are construction-time: remount the Provider when the registry or app identity changes. `defaultScreen` opens after client mount; SSR starts with the empty state unless an external controller has already opened a screen. These basic SSR tests do not establish complete Next.js or Nuxt integration.

For an existing external menu, create a controller from the core entry and pass `controller` plus the matching component `screens`, with `menu={false}` / `:menu="false"`. Call `controller.open('orders')` from the existing menu. Controller mode cannot also configure `defaultScreen`, `maxTabs`, `beforeActivate`, `beforeClose` or `onChange`. Inside Provider, `useWorkspace()` returns that same controller. `useWorkspaceState()` returns a React snapshot or a readonly computed Vue ref.

`Provider`, `TabList`, `Tab`, `CloseButton`, `Panels`, `Switcher` and `SwitcherTrigger` are exported aliases for their `Workspace`-prefixed names. Provider renders the Ark Tabs root; put parts in any desired layout beneath it. `Tab` and `CloseButton` take a screen `id`. An empty `TabList` renders all open tabs by default; its children/default slot replace that layout. `Tab` forwards Ark trigger props such as `asChild`; Vue forwards attributes/listeners. `CloseButton` and `SwitcherTrigger` merge ordinary button events and respect `preventDefault()`. Default tab close controls are siblings of the tablist. A structural CSS grid interleaves triggers and close controls visually, while the ARIA tablist contains only tabs; custom TabList content must preserve that requirement. `Switcher` accepts custom dialog content, while its accessible title, description and dismissal control remain built in.

React uses `children`, `className` and render functions in `slots`. Vue uses native default slots, `class`, and the same optional render-function `slots` object for menu, tab label, switcher item, preview and empty content. Slots replace content; the default tab/menu/choice buttons retain their keyboard and ARIA behavior. `unstyled`, `classNames`, `labels`, `shortcuts`, `onResult` and `onError` customize both adapters. Shortcut handling is local to the focused Workspace and skips inputs, composing text, repeating keys and modal dialogs. A switcher preview is explicitly supplied static content and is inert.

Opened pages remain mounted while inactive and receive `hidden` and `inert`. Closing or reset unmounts them. `useWorkspacePage()` exposes `{ id, active }`, where `active` is a boolean in React and a readonly computed ref in Vue. React `useActiveEffect(effect, dependencies)` runs like an effect while active; include referenced changing values in its dependency list. Vue `useActiveEffect(effect)` tracks reactive reads. Both run the returned cleanup on deactivation or unmount. Use this activity signal to gate page-owned portal dialogs as well: a portal outside a hidden panel is outside its inert subtree. Existing effects, requests and timers continue unless the app explicitly gates or cancels them.

