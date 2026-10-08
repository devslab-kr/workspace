import { createServer } from 'vite';
import assert from 'node:assert/strict';
const server = await createServer({ configFile: 'tests/svelte/vite.config.ts', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { renderFixture } = await server.ssrLoadModule('/SSRRun.ts');
  const { empty, opened } = await renderFixture(); assert.match(empty, /Choose a screen/); assert.doesNotMatch(empty, /orders page/); assert.match(opened, /orders page/); assert.doesNotMatch(opened, /customers page/);
  console.log('Svelte SSR empty default and preopened controller rendering passed');
} finally { await server.close(); }
