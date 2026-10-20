import { createElement as r, Fragment, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, onMounted, onUnmounted, ref } from 'vue';
import { Workspace as ReactWorkspace, useActiveEffect as reactActiveEffect, useWorkspace as reactWorkspace, useWorkspacePage as reactPage, type AdapterScreen as ReactScreen } from '../../src/react';
import { Workspace as VueWorkspace, useActiveEffect as vueActiveEffect, useWorkspace as vueWorkspace, useWorkspacePage as vuePage, type AdapterScreen as VueScreen } from '../../src/vue';
import { createWorkspace } from '../../src/core';
import '../../src/style.css';
const params = new URLSearchParams(location.search);
const framework = params.get('framework');
if (params.has('dynamic')) {
  // A router-driven workspace: screens arrive through the guard, nothing is passed in the screens prop.
  const events = { mounted: 0, cleaned: 0 };
  const drafts: Record<string, string> = { '/orders 1 한국': 'Orders draft', '/customers': 'Customers draft', '/reports': 'Reports draft' };
  const ReactPage = () => {
    const page = reactPage<{ made: number }>();
    useEffect(() => { events.mounted++; return () => { events.cleaned++; }; }, []);
    return r(Fragment, null, r('label', null, drafts[page.id], r('input', { 'aria-label': drafts[page.id] })), r('p', { 'data-made': '' }, page.data.made));
  };
  const VuePage = defineComponent({ setup() {
    const page = vuePage<{ made: number }>();
    onMounted(() => { events.mounted++; }); onUnmounted(() => { events.cleaned++; });
    return () => [h('label', [drafts[page.id], h('input', { 'aria-label': drafts[page.id] })]), h('p', { 'data-made': '' }, String(page.data.made))];
  } });
  const component = framework === 'react' ? ReactPage : VuePage;
  const routes: Record<string, ReactScreen & VueScreen> = Object.fromEntries([['/orders 1 한국', 'Orders'], ['/customers', 'Customers'], ['/reports', 'Reports']].map(([id, title]) => [id, { id, title, component: component as never }]));
  const w = window as any; w.made = 0; w.events = events; w.hold = false;
  const route = (id: string) => { if (!routes[id]) return false; if (api.getScreen(id)) api.show(id); else api.register(routes[id], { show: true }); return true; };
  const api = createWorkspace<ReactScreen & VueScreen, { made: number }>({
    createTabData: () => ({ made: ++w.made }), home: '/customers', showRetainedFirst: true,
    beforeActivate: id => w.hold ? new Promise<boolean>(resolve => { w.release = () => resolve(route(id)); }) : route(id),
  });
  await api.open('/customers');
  w.workspace = api;
  if (framework === 'react') createRoot(document.getElementById('app')!).render(r(ReactWorkspace, { controller: api, slots: { pendingTab: id => `Opening ${id}` } }));
  else createApp({ render: () => h(VueWorkspace, { controller: api, slots: { pendingTab: (id: string) => `Opening ${id}` } }) }).mount('#app');
} else {
const beforeActivate = (id: string) => { const guard = (window as any).adapterGuard; return guard ? guard(id) : true; };
const events = { mounted: 0, cleaned: 0, active: 0, inactive: 0 };
Object.assign(window, { adapterEvents: events });
if (framework === 'react') {
  function Page() { Object.assign(window, { adapterController: reactWorkspace() }); const [value, setValue] = useState(''); useEffect(() => { events.mounted++; return () => { events.cleaned++; }; }, []); reactActiveEffect(() => { events.active++; return () => { events.inactive++; }; }); return r('label', null, 'Work input', r('input', { value, onChange: (e: { target: { value: string } }) => setValue(e.target.value) })); }
  createRoot(document.getElementById('app')!).render(r(ReactWorkspace, { screens: [{ id: 'a', title: 'Alpha', component: Page }, { id: 'b', title: 'Beta', component: Page }], defaultScreen: 'a', beforeActivate }));
} else {
  const Page = defineComponent({ setup() { Object.assign(window, { adapterController: vueWorkspace() }); events.mounted++; const value = ref(''); onUnmounted(() => { events.cleaned++; }); vueActiveEffect(() => { events.active++; return () => { events.inactive++; }; }); return () => h('label', ['Work input', h('input', { value: value.value, onInput: (e: Event) => { value.value = (e.target as HTMLInputElement).value; } })]); } });
  createApp({ render: () => h(VueWorkspace, { screens: [{ id: 'a', title: 'Alpha', component: Page }, { id: 'b', title: 'Beta', component: Page }], defaultScreen: 'a', beforeActivate }) }).mount('#app');
}
}
