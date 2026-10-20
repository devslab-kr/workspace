import { mount } from 'svelte';
import Demo from './Demo.svelte';
import Composition from './Composition.svelte';
import Dynamic from './Dynamic.svelte';
import DynamicPage from './DynamicPage.svelte';
import { createWorkspace } from '../../../src/core';
import type { AdapterScreen } from '../../../src/svelte/context.svelte';
import '../../../src/style.css';
const target = document.getElementById('app')!;
if (location.search.includes('dynamic')) {
  // A router-driven workspace: screens arrive through the guard, nothing is passed in the screens prop.
  const routes: Record<string, AdapterScreen> = Object.fromEntries([['/orders 1 한국', 'Orders'], ['/customers', 'Customers'], ['/reports', 'Reports']].map(([id, title]) => [id, { id, title, component: DynamicPage }]));
  const w = window as any; w.made = 0; w.events = { mounted: 0, cleaned: 0 }; w.hold = false;
  const route = (id: string) => { if (!routes[id]) return false; if (api.getScreen(id)) api.show(id); else api.register(routes[id], { show: true }); return true; };
  const api = createWorkspace<AdapterScreen, { made: number }>({
    createTabData: () => ({ made: ++w.made }), home: '/customers', showRetainedFirst: true,
    beforeActivate: id => w.hold ? new Promise<boolean>(resolve => { w.release = () => resolve(route(id)); }) : route(id),
  });
  await api.open('/customers');
  w.workspace = api;
  mount(Dynamic, { target, props: { controller: api } });
} else mount(location.search.includes('composition') ? Composition : Demo, { target });
