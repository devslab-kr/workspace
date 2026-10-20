import { expect, it } from 'vitest';
import { renderToString } from 'solid-js/web';
import { createComponent } from 'solid-js';
import { RetainedPanels } from '../src/RetainedPanels';
import { createWorkspace, useWorkspace, Workspace, WorkspacePanels, WorkspaceProvider, WorkspaceTabList, type AdapterScreen } from '../src/solid';
it('renders externally registered SSR items synchronously with inactive native hiding', () => {
  const html = renderToString(() => RetainedPanels({ items: [{ id: 'a' }, { id: 'b' }], active: item => item.id === 'a', as: 'section', panelProps: item => ({ id: item.id }), children: item => item.id }));
  expect(html).toContain('id="a"'); expect(html).toContain('id="b"'); expect(html).toMatch(/id="b"[^>]*hidden[^>]*inert/);
  expect(html.match(/<section[^>]*id="a"[^>]*>/)?.[0]).not.toContain('style=');
  expect(html).not.toContain('style=""');
});
it.each(['object', 'string'])('hides inactive SSR panels with %s display overrides', format => {
  const style = format === 'string' ? 'display:flex!important;color:red' : { display: 'grid', color: 'red' };
  const html = renderToString(() => RetainedPanels({ items: ['a'], active: () => false, panelProps: () => ({ style }), children: item => item }));
  expect(html).toContain('display:none'); expect(html).toContain('hidden'); expect(html).toContain('inert');
});
it('renders a screen registered on a request-local controller before render', () => {
  const Page = () => 'Alpha page';
  const api = createWorkspace<AdapterScreen>();
  expect(api.register({ id: '/a b', title: 'Alpha', component: Page }, { show: true })).toBe('ok');
  const html = renderToString(() => createComponent(Workspace, { controller: api }));
  expect(html).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>Alpha<|<button[^>]*aria-selected="true"[^>]*role="tab"[^>]*>Alpha</);
  expect(html).toContain('Alpha page');
});
it('renders a screen a child registers during render, before the tab parts', () => {
  const Page = () => 'Orders page';
  const Registrar = () => { useWorkspace().register({ id: '/orders 1', title: 'Orders', component: Page }, { show: true }); return ''; };
  const api = createWorkspace<AdapterScreen>();
  const html = renderToString(() => createComponent(WorkspaceProvider, { controller: api, get children() { return [createComponent(Registrar, {}), createComponent(WorkspaceTabList, {}), createComponent(WorkspacePanels, {})]; } }));
  expect(html).toMatch(/role="tab"[^>]*>Orders</);
  expect(html).toContain('Orders page');
});
it('keeps 0.2.0 controllers whose components live in the screens prop', async () => {
  const api = createWorkspace({ screens: [{ id: 'a', title: 'Alpha' }] }); await api.open('a');
  const html = renderToString(() => createComponent(Workspace, { controller: api, screens: [{ id: 'a', title: 'Alpha', component: () => 'Legacy page' }] }));
  expect(html).toMatch(/role="tab"[^>]*>Alpha</); expect(html).toContain('Legacy page');
});
