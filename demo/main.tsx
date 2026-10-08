import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { Workspace, useActiveEffect, useWorkspacePage } from '../src/solid';
import '../src/style.css';

const [dirty, setDirty] = createSignal(false);
function Notes() {
  const [text, setText] = createSignal('');
  const page = useWorkspacePage();
  return <><h1>Notes</h1><p>Text stays here when you switch screens. Closing disposes it.</p>
    <label>Draft <textarea value={text()} onInput={event => { setText(event.currentTarget.value); setDirty(true); }} /></label>
    <p>Activity: {page.active() ? 'active' : 'inactive'}</p></>;
}
function Counter() {
  const [count, setCount] = createSignal(0);
  const [ticks, setTicks] = createSignal(0);
  useActiveEffect(() => {
    const timer = setInterval(() => setTicks(n => n + 1), 1000);
    return () => clearInterval(timer);
  });
  return <><h1>Counter</h1><button onClick={() => setCount(n => n + 1)}>Count {count()}</button><p>Active seconds: {ticks()}</p></>;
}
function Help() { return <><h1>Help</h1><p>Use Alt+Q inside the workspace, Alt+1–9, or the switch button. Tab arrows move focus; Enter selects.</p></>; }
// App-owned confirmation: native confirm keeps this example small and accessible.
function Demo() {
  return <main>
    <header style={{ padding: '1rem', 'font-family': 'system-ui' }}><strong>DevsLab · Workspace</strong><p>Independent Solid demo · maximum three open screens</p></header>
    <Workspace screens={[{ id: 'notes', title: 'Notes', component: Notes }, { id: 'counter', title: 'Counter', component: Counter }, { id: 'help', title: 'Help', component: Help }]}
      defaultScreen="notes" maxTabs={3}
      beforeClose={id => {
        if (id !== 'notes' || !dirty()) return true;
        const accepted = window.confirm('Discard unsaved notes?');
        if (accepted) setDirty(false);
        return accepted;
      }} slots={{ preview: screen => <span style={{ display: 'block', 'font-size': '2rem', padding: '.5rem' }}>{screen.title.slice(0, 1)}</span> }} />
  </main>;
}
render(() => <Demo />, document.getElementById('app')!);
