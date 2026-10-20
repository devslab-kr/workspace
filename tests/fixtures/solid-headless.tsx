import { For, createSignal, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { createWorkspace, Workspace, WorkspaceProvider, WorkspaceTabList, WorkspaceTab, WorkspaceCloseButton, WorkspacePanels, WorkspaceSwitcher, WorkspaceSwitcherTrigger, WorkspaceStatus, useWorkspacePage, useWorkspaceState, type AdapterScreen } from '../../src/solid';
if (new URLSearchParams(location.search).has('dynamic')) {
  // A router-driven workspace: screens arrive through the guard, nothing is passed in the screens prop.
  const events = { mounted: 0, cleaned: 0 };
  const drafts: Record<string, string> = { '/orders 1 한국': 'Orders draft', '/customers': 'Customers draft', '/reports': 'Reports draft' };
  function Page() {
    const page = useWorkspacePage<{ made: number }>();
    onMount(() => { events.mounted++; }); onCleanup(() => { events.cleaned++; });
    return <><label>{drafts[page.id]}<input aria-label={drafts[page.id]} /></label><p data-made>{page.data.made}</p></>;
  }
  const routes: Record<string, AdapterScreen> = {
    '/orders 1 한국': { id: '/orders 1 한국', title: 'Orders', component: Page },
    '/customers': { id: '/customers', title: 'Customers', component: Page },
    '/reports': { id: '/reports', title: 'Reports', component: Page },
  };
  const w = window as any; w.made = 0; w.events = events; w.hold = false;
  const route = (id: string) => { if (!routes[id]) return false; if (api.getScreen(id)) api.show(id); else api.register(routes[id], { show: true }); return true; };
  const api = createWorkspace<AdapterScreen, { made: number }>({
    createTabData: () => ({ made: ++w.made }), home: '/customers', showRetainedFirst: true,
    beforeActivate: id => w.hold ? new Promise<boolean>(resolve => { w.release = () => resolve(route(id)); }) : route(id),
  });
  await api.open('/customers');
  w.workspace = api;
  render(() => <><h1>Dynamic Solid</h1><Workspace controller={api} screens={[]} slots={{ pendingTab: id => <>Opening {id}</> }} /></>, document.getElementById('app')!);
} else {
const harness = { deny: false, pending: false, protect: false, resolve: undefined as undefined | ((value: boolean) => void), refs: {} as Record<string, HTMLButtonElement>, keys: 0, clicks: 0 };
function Alpha() { return <label>Alpha draft<input aria-label="Alpha draft" /></label>; }
function Beta() { return <h2>Beta page</h2>; }
const screens = [{ id: 'a', title: 'Alpha', component: Alpha }, { id: 'b', title: 'Beta', component: Beta }];
const api = createWorkspace({ screens, beforeActivate: id => id === 'b' ? harness.pending ? new Promise<boolean>(resolve => { harness.resolve = resolve; }) : !harness.deny : true });
await api.open('a'); await api.open('b'); await api.select('a');
Object.assign(window, { harness, workspace: api });
function Parts() {
  const state = useWorkspaceState();
  return <><h1>Headless Solid</h1><WorkspaceTabList><For each={state().tabs}>{tab => <WorkspaceTab id={tab.id} class="custom-tab" ref={element => { harness.refs[tab.id] = element; }}
    onKeyDown={event => { harness.keys++; if (harness.protect && event.key === 'Delete') event.preventDefault(); }}
    asChild={attrs => <button {...attrs} data-custom-tab={tab.id}>{tab.id === 'a' ? 'Alpha' : 'Beta'}</button>} />}</For></WorkspaceTabList>
    <For each={state().tabs}>{tab => <WorkspaceCloseButton id={tab.id} ref={element => { harness.refs[`close-${tab.id}`] = element; }} onClick={event => { harness.clicks++; if (harness.protect) event.preventDefault(); }}
      asChild={attrs => <button {...attrs} data-custom-close={tab.id}>Close {tab.id === 'a' ? 'Alpha' : 'Beta'}</button>} />}</For>
    <WorkspaceSwitcherTrigger ref={element => { harness.refs.switcher = element; }} onClick={() => { harness.clicks++; }} asChild={attrs => <button {...attrs}>Switch screens</button>} />
    <WorkspaceStatus /><WorkspacePanels /><WorkspaceSwitcher />
  </>;
}
render(() => <WorkspaceProvider controller={api} screens={screens} unstyled><Parts /></WorkspaceProvider>, document.getElementById('app')!);
}
