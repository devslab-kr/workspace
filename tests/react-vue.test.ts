import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, h } from 'vue';
import { renderToString as renderVue } from '@vue/server-renderer';
import { Workspace as ReactWorkspace } from '../src/react';
import { Workspace as VueWorkspace } from '../src/vue';
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
  it('rejects a mismatched controller registry in both frameworks', async () => {
    const controller = createWorkspace({ screens: [{ id: 'b', title: 'Beta' }] });
    expect(() => renderToString(createElement(ReactWorkspace, { controller, screens: [{ id: 'a', title: 'Alpha', component: () => null }] }))).toThrow('registries must match');
    await expect(renderVue(createSSRApp({ render: () => h(VueWorkspace, { controller, screens: [{ id: 'a', title: 'Alpha', component: { render: () => null } }] }) }))).rejects.toThrow('registries must match');
  });
});
