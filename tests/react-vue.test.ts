import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString as renderVue } from '@vue/server-renderer';
import { Workspace as ReactWorkspace } from '../src/react';
import { Workspace as VueWorkspace, WorkspaceProvider as VueProvider, WorkspaceTabList as VueTabList, WorkspacePanels as VuePanels, useWorkspace as useVueWorkspace, type AdapterScreen as VueAdapterScreen } from '../src/vue';
import { createWorkspace } from '../src/core';

describe('native adapter SSR', () => {
  it('React does not mount unvisited/default pages on the server', () => {
    const component = () => createElement('p', null, 'PAGE INSTANCE');
    const output = renderToString(createElement(ReactWorkspace, { screens: [{ id: 'a', title: 'Alpha', component }], defaultScreen: 'a' }));
    expect(output).toContain('Choose a screen'); expect(output).not.toContain('PAGE INSTANCE');
  });
  it('Vue does not mount unvisited/default pages on the server', async () => {
    const component = { render: () => h('p', 'PAGE INSTANCE') };
    const output = await renderVue(createSSRApp({ render: () => h(VueWorkspace, { screens: [{ id: 'a', title: 'Alpha', component }], defaultScreen: 'a' }) }));
    expect(output).toContain('Choose a screen'); expect(output).not.toContain('PAGE INSTANCE');
  });
  it("uses the controller's registry and falls back to prop components", async () => {
    const controller = createWorkspace({ screens: [{ id: 'a', title: 'Live' }] }); await controller.open('a');
    const react = renderToString(createElement(ReactWorkspace, { controller, screens: [{ id: 'a', title: 'Old', component: () => createElement('p', null, 'React page') }] }));
    expect(react).toMatch(/role="tab"[^>]*>Live</); expect(react).not.toContain('Old'); expect(react).toContain('React page');
    const vue = await renderVue(createSSRApp({ render: () => h(VueWorkspace, { controller, screens: [{ id: 'a', title: 'Old', component: { render: () => h('p', 'Vue page') } }] }) }));
    expect(vue).toMatch(/role="tab"[^>]*>(<!--\[-->)?Live</); expect(vue).not.toContain('Old'); expect(vue).toContain('Vue page');
  });
  it('renders the pending placeholder only when a pendingTab slot is given', async () => {
    const controller = createWorkspace({ beforeActivate: () => new Promise<boolean>(() => {}) }); void controller.open('/reports');
    const slots = { pendingTab: (id: string) => `Opening ${id}` };
    expect(renderToString(createElement(ReactWorkspace, { controller }))).not.toContain('data-workspace-part="pending"');
    expect(renderToString(createElement(ReactWorkspace, { controller, slots }))).toMatch(/data-workspace-part="pending"[^>]*>Opening \/reports</);
    expect(await renderVue(createSSRApp({ render: () => h(VueWorkspace, { controller }) }))).not.toContain('data-workspace-part="pending"');
    expect(await renderVue(createSSRApp({ render: () => h(VueWorkspace, { controller, slots }) }))).toMatch(/data-workspace-part="pending"[^>]*>(<!--\[-->)?Opening \/reports</);
  });
  it("Vue sees a screen registered during a child's setup", async () => {
    const Page = { render: () => h('p', 'Orders page') };
    const Registrar = defineComponent({ setup() { useVueWorkspace().register({ id: '/orders 1', title: 'Orders', component: Page }, { show: true }); return () => null; } });
    const controller = createWorkspace<VueAdapterScreen>();
    const output = await renderVue(createSSRApp({ render: () => h(VueProvider, { controller }, { default: () => [h(Registrar), h(VueTabList), h(VuePanels)] }) }));
    expect(output).toMatch(/role="tab"[^>]*>(<!--\[-->)?Orders</); expect(output).toContain('Orders page');
  });
});
