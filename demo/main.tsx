import { createSignal, createEffect, For } from 'solid-js';
import { render } from 'solid-js/web';
import { Workspace, useActiveEffect, useWorkspacePage } from '../src/solid';
import '../src/style.css';
import './demo.css';

function Orders() {
  const [query, setQuery] = createSignal('');
  const [selected, setSelected] = createSignal<string[]>([]);
  const rows = [ ['WS-1042', 'Northline Studio', 'Website refresh', 'In progress'], ['WS-1041', 'Forma Architecture', 'Brand guidelines', 'Review'], ['WS-1040', 'Common Ground', 'Product catalogue', 'Completed'], ['WS-1039', 'Fieldwork Co.', 'Workspace setup', 'In progress'] ];
  const filtered = () => rows.filter(row => row.join(' ').toLowerCase().includes(query().toLowerCase()));
  return <><div class="page-heading"><div><h1>Orders</h1><p>Search or select a row, then switch screens. Your view stays intact.</p></div><span>Sample data</span></div>
    <div class="list-tools"><label>Find an order<input type="search" placeholder="Customer, order or project" value={query()} onInput={event => setQuery(event.currentTarget.value)} /></label><span aria-live="polite">{selected().length} selected · {filtered().length} orders</span></div>
    <div class="table-scroll"><table><thead><tr><th>Select</th><th>Order</th><th>Customer / project</th><th>Status</th></tr></thead><tbody><For each={filtered()}>{row => <tr data-selected={selected().includes(row[0])}><td><input type="checkbox" aria-label={`Select ${row[0]}`} checked={selected().includes(row[0])} onChange={event => setSelected(ids => event.currentTarget.checked ? [...ids, row[0]] : ids.filter(id => id !== row[0]))} /></td><td>{row[0]}</td><td><strong>{row[1]}</strong><small>{row[2]}</small></td><td><span class="badge" data-state={row[3]}>{row[3]}</span></td></tr>}</For></tbody></table>{filtered().length === 0 && <p>No matching orders. Try another customer or order number.</p>}</div>
    <p class="footnote">This table belongs to the demo app. Workspace retains the screen and its state.</p></>;
}

const [dirty, setDirty] = createSignal(false);
function Notes() {
  const [text, setText] = createSignal('');
  const page = useWorkspacePage();
  return <><div class="page-heading"><div><h1>Notes</h1><p>A working draft that follows you between tabs.</p></div><span class="badge">{dirty() ? 'Unsaved changes' : 'Ready to write'}</span></div>
    <label class="draft-label">Draft <textarea placeholder="Write a few lines. Open Orders, then return to Notes…" value={text()} onInput={event => { setText(event.currentTarget.value); setDirty(true); }} /></label>
    <div class="note-actions"><p>Activity: {page.active() ? 'active' : 'inactive'} · Session only</p><button type="button" disabled={!dirty()} onClick={() => setDirty(false)}>Save draft</button></div><p class="footnote">Switching preserves the draft. Closing a modified tab asks before discarding it. Reloading resets this demo.</p></>;
}
function Counter() {
  const [count, setCount] = createSignal(0);
  const [ticks, setTicks] = createSignal(0);
  useActiveEffect(() => {
    const timer = setInterval(() => setTicks(n => n + 1), 1000);
    return () => clearInterval(timer);
  });
  return <><div class="page-heading"><div><h1>Activity</h1><p>Keep the screen. Pause the work that should run only while it is visible.</p></div></div><div class="activity-line"><strong>Visible-page timer</strong><output>{ticks()} seconds</output></div><p>Open another tab and come back. This timer pauses in the background and resumes from the same value.</p><button onClick={() => setCount(n => n + 1)}>Count {count()}</button><pre tabindex="0" aria-label="Active effect code example"><code>{`useActiveEffect(() => {\n  const timer = setInterval(refresh, 1000);\n  return () => clearInterval(timer);\n});`}</code></pre></>;
}
// App-owned confirmation: native confirm keeps this example small and accessible.
function Demo() {
  const [dark, setDark] = createSignal(window.matchMedia('(prefers-color-scheme: dark)').matches);
  createEffect(() => { document.documentElement.dataset.demoTheme = dark() ? 'dark' : 'light'; });
  return <div class="demo-shell" data-theme={dark() ? 'dark' : 'light'}>
    <header class="demo-header"><a class="demo-brand" href="../"><img src={`../docs/assets/brand/${dark() ? 'glyph-dark' : 'glyph-color'}.svg`} alt="" />Workspace</a><nav aria-label="Demo navigation"><a href="../docs/solid.html">SolidJS guide</a><a href="https://github.com/devslab-kr/workspace">GitHub</a><button type="button" onClick={() => setDark(value => !value)}>{dark() ? 'Light theme' : 'Dark theme'}</button></nav></header>
    <main class="demo-main"><div class="demo-intro"><div><h2>Your work stays open.</h2><p>Three business screens. One workspace. Switch tabs without losing your place.</p></div><a href="https://github.com/devslab-kr/workspace/blob/main/demo/main.tsx">View the SolidJS source</a></div><div class="workspace-frame">
    <Workspace screens={[{ id: 'orders', title: 'Orders', component: Orders }, { id: 'notes', title: 'Notes', component: Notes }, { id: 'counter', title: 'Activity', component: Counter }]}
      defaultScreen="orders" maxTabs={3} labels={{ switcher: 'Open screens', tabs: 'Choose a screen to continue' }}
      beforeClose={id => {
        if (id !== 'notes' || !dirty()) return true;
        const accepted = window.confirm('Discard unsaved notes?');
        if (accepted) setDirty(false);
        return accepted;
      }} slots={{ preview: screen => <div class="screen-preview"><div class="preview-tabs"><i /><i /><i /></div><div class="preview-lines"><i /><i /><i /></div><span>{screen.title === 'Orders' ? 'Search & selection' : screen.title === 'Notes' ? 'Retained draft' : 'Active-page lifecycle'}</span></div> }} />
    </div><div class="demo-help"><p><strong>Try it:</strong> write a note, select an order, then use Open screens to move between them.</p><p><kbd>Alt</kbd> + <kbd>Q</kbd> opens the switcher · <kbd>Alt</kbd> + <kbd>1–3</kbd> selects a tab</p></div></main><footer class="demo-footer">Open source by <a href="https://devslab.kr/">DevsLab</a><span>SolidJS demo · Sample data stays in this session</span></footer>
  </div>;
}
render(() => <Demo />, document.getElementById('app')!);
