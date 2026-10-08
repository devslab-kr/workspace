import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { RetainedPanels } from '../../src/RetainedPanels';
function Fixture() {
  const [active, setActive] = createSignal(false);
  const items = [{ id: 'object', style: { display: 'grid', color: 'red' } }, { id: 'string', style: 'display:flex!important;color:red;' }];
  return <><h1>Retained panels</h1><button onClick={() => setActive(value => !value)}>Toggle activity</button>
    <RetainedPanels items={items} active={() => active()} as="section" panelProps={item => ({ id: item.id, style: item.style })}>{item => <input aria-label={`${item.id} draft`} />}</RetainedPanels>
  </>;
}
render(() => <Fixture />, document.getElementById('app')!);
