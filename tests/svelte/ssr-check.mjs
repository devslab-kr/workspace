import { createServer } from 'vite';
import assert from 'node:assert/strict';
const server = await createServer({ configFile: 'tests/svelte/vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { renderFixture } = await server.ssrLoadModule('/SSRRun.ts');
  const { empty, opened, registered, registeredResult, listeners } = await renderFixture(); assert.match(empty, /Choose a screen/); assert.doesNotMatch(empty, /orders page/); assert.match(opened, /orders page/); assert.doesNotMatch(opened, /customers page/);
  assert.equal(registeredResult, 'ok');
  for (const body of registered) { assert.match(body, /\/orders x page/); assert.match(body, /aria-selected="true"[^>]*>(<!--[^>]*-->)*Orders|>Orders</); assert.match(body, /aria-selected="true"/); }
  assert.equal(listeners, 0);
  console.log('Svelte SSR empty default, preopened controller, registered screen and listener-free shared controller rendering passed');
} finally { await server.close(); }
