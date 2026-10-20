import { render } from 'svelte/server';
import Fixture from './SSRFixture.svelte';
import Page from './Page.svelte';
import { createWorkspace } from '../../../src/core';
import type { AdapterScreen } from '../../../src/svelte/context.svelte';
export async function renderFixture() {
  const empty = render(Fixture);
  const controller = createWorkspace({ screens: [{ id: 'orders', title: 'Orders' }, { id: 'customers', title: 'Customers' }] });
  await controller.open('orders');
  // A router-driven controller: no starting screens, the screen arrives through register before render.
  const live = createWorkspace<AdapterScreen>(); let listeners = 0;
  const subscribe = live.subscribe;
  live.subscribe = listener => { listeners++; const stop = subscribe(listener); return () => { listeners--; stop(); }; };
  const registeredResult = live.register({ id: '/orders x', title: 'Orders', component: Page }, { show: true });
  // Two renders on one shared controller: server rendering must leave no listener behind.
  const registered = [render(Fixture, { props: { controller: live, screens: [] } }).body, render(Fixture, { props: { controller: live, screens: [] } }).body];
  return { empty: empty.body, opened: render(Fixture, { props: { controller } }).body, registered, registeredResult, listeners };
}
