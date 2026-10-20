# Svelte 5 adapter

```svelte
<script lang="ts">
  import { Workspace } from '@devslab/workspace/svelte';
  import '@devslab/workspace/style.css';
  import Orders from './Orders.svelte';
  import Customers from './Customers.svelte';
  const screens = [
    { id: 'orders', title: 'Orders', component: Orders },
    { id: 'customers', title: 'Customers', component: Customers },
  ];
</script>
<Workspace {screens} defaultScreen="orders" />
```

Svelte 5.29 or newer is required. Screen components take no required props; wrap a page in a Svelte component to connect application props and context. Controller options and the `screens` prop are read once: remount the workspace for a different application identity. Screens change at run time through the controller (`register`, `show`, `unregister`, `retainOnly`); see [Registering screens at run time](https://github.com/devslab-kr/workspace#registering-screens-at-run-time). `show()` and `register(…, { show: true })` run no guard and are meant for the app's router.

Use `menu={false}` to attach an existing menu. Create a controller from the core entry and pass `controller`; presentation `screens` supply components, by id, for controller definitions that carry none. Controller and standalone options (`defaultScreen`, guards, `maxTabs`, `onChange`) are mutually exclusive. A standalone default screen opens after mounting; server output starts empty. A preopened request-local controller renders its current tabs during SSR. Registering on it during initialization, before the tab parts render, also works; replay the same registrations in the same order on the client. `slots.pendingTab` is a snippet taking the pending id.

Provider, TabList, Tab, CloseButton, Panels, Switcher and SwitcherTrigger are exported with a `Workspace` prefix. Provider children are a Svelte snippet. Tab, CloseButton and SwitcherTrigger accept Ark's `asChild` snippet for a custom element with merged primitive props and a bindable `ref`. Button parts accept standard button attributes and merge user event handlers (preventDefault cancels the workspace action). Label customization uses `slots` snippets and retains the default accessible buttons. Transition feedback is announced inside an open switcher; the external status is hidden until the dialog closes.

`useWorkspace()` returns the controller. `useWorkspaceState()` returns a getter, read inside a template or Svelte `$derived`/`$effect`. Inside a screen, `useWorkspacePage()` returns `{ id, active(), data, screen() }`, where `data` is the tab's `createTabData` value and `screen()` the live definition; `useActiveEffect(callback)` activates an effect only while that screen is selected, with cleanup on deactivation and destruction. Call these helpers during component initialization. Application portals should use `active()` to suppress inactive page dialogs.

Opened screens are keyed by ID and retained behind `hidden`/`inert`; close removes their instance. Ark Tabs provides manual keyboard activation. Ark Dialog supplies modal focus trapping and restoration. Shortcuts are scoped to keyboard events originating inside each workspace, skip editable fields, composition/repeat events and active dialogs, and can be disabled or configured through `shortcuts`.

This adapter ships Svelte source for consumers' Svelte compilation. Compile/type and browser validation are separate from proof of SvelteKit integration; no SvelteKit compatibility claim is made here.
