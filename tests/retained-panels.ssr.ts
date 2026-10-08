import { expect, it } from 'vitest';
import { renderToString } from 'solid-js/web';
import { RetainedPanels } from '../src/RetainedPanels';
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
