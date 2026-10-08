import { createElement as r, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, defineComponent, h, onUnmounted, ref } from 'vue';
import { Workspace as ReactWorkspace, useActiveEffect as reactActiveEffect, useWorkspace as reactWorkspace } from '../../src/react';
import { Workspace as VueWorkspace, useActiveEffect as vueActiveEffect, useWorkspace as vueWorkspace } from '../../src/vue';
import '../../src/style.css';
const framework = new URLSearchParams(location.search).get('framework');
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
