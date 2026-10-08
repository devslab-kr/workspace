import { createSignal, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, expect, it } from 'vitest';
import { RetainedPanels } from '../src/RetainedPanels';
const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); });

it('retains native instances while inactive, forwards native attributes, and disposes removed identities', () => {
  const a = { id: 'a' }, b = { id: 'b' }; const [items, setItems] = createSignal([a]); const [active, setActive] = createSignal('a');
  let created = 0, disposed = 0;
  function Page() { created++; onCleanup(() => disposed++); return <input aria-label="draft" />; }
  const root = document.createElement('main'); document.body.append(root);
  disposers.push(render(() => <RetainedPanels items={items()} active={item => item.id === active()} as="section" panelProps={item => ({ id: item.id, role: 'tabpanel', 'data-owner': item.id })}>{() => <Page />}</RetainedPanels>, root));
  const input = root.querySelector('input')!; input.value = 'retained'; setItems([a, b]); setActive('b');
  expect(created).toBe(2); expect(root.querySelector('#a')).toHaveProperty('hidden', true); expect(root.querySelector('#a')).toHaveProperty('inert', true);
  setActive('a'); expect(root.querySelector('#a input')).toBe(input); expect(input.value).toBe('retained'); expect(root.querySelector('#a')?.tagName).toBe('SECTION');
  setItems([a]); expect(disposed).toBe(1);
  setItems([{ id: 'a' }]); expect(disposed).toBe(2); expect(created).toBe(3); expect(root.querySelector('#a input')).not.toBe(input);
});
it.each(['object', 'string'])('owns inactive display while restoring consumer %s styles on activation', format => {
  const [active, setActive] = createSignal(false); const item = { id: 'styled' };
  // Chromium separately verifies duplicate !important declarations; jsdom's CSS parser keeps the first one.
  const style = format === 'string' ? 'display:flex;color:red;' : { display: 'grid', color: 'red' };
  const root = document.createElement('main'); document.body.append(root);
  disposers.push(render(() => <RetainedPanels items={[item]} active={() => active()} panelProps={() => ({ style })}>{() => 'retained content'}</RetainedPanels>, root));
  const panel = root.firstElementChild as HTMLElement;
  expect(getComputedStyle(panel).display).toBe('none'); expect(panel.hidden).toBe(true); expect(panel).toHaveProperty('inert', true);
  setActive(true); expect(panel.hidden).toBe(false); expect(getComputedStyle(panel).display).toBe(format === 'string' ? 'flex' : 'grid'); expect(panel.style.color).toBe('red');
  setActive(false); expect(getComputedStyle(panel).display).toBe('none');
});
