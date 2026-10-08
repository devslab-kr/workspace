import { For, createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { createWorkspace, WorkspaceProvider, WorkspaceTabList, WorkspaceTab, WorkspaceCloseButton, WorkspacePanels, WorkspaceSwitcher, WorkspaceSwitcherTrigger, WorkspaceStatus, useWorkspaceState } from '../../src/solid';
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
