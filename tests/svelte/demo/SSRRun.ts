import { render } from 'svelte/server';
import Fixture from './SSRFixture.svelte';
import { createWorkspace } from '../../../src/core';
export async function renderFixture() {
  const empty = render(Fixture);
  const controller = createWorkspace({ screens: [{ id: 'orders', title: 'Orders' }, { id: 'customers', title: 'Customers' }] });
  await controller.open('orders');
  return { empty: empty.body, opened: render(Fixture, { props: { controller } }).body };
}
