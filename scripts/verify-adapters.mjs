import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

if (process.argv.includes('--svelte-server')) {
  const { createServer } = await import('vite');
  const server = await createServer({ configFile: fileURLToPath(new URL('../tests/svelte/vite.config.ts', import.meta.url)), server: { host: '127.0.0.1', port: 0, strictPort: true } });
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await server.close();
    if (process.connected) process.disconnect();
    process.exit(0);
  }
  process.on('message', message => { if (message === 'shutdown') void close(); });
  process.once('disconnect', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });
  process.once('SIGINT', () => { void close(); });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP port');
  process.send?.({ type: 'ready', url: `http://127.0.0.1:${address.port}` });
} else {
  const children = new Set();
  let server;
  function child(args, env = {}, ipc = false) {
    const processChild = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ipc ? ['ignore', 'inherit', 'inherit', 'ipc'] : ['ignore', 'inherit', 'inherit'] });
    children.add(processChild);
    processChild.once('close', () => children.delete(processChild));
    return processChild;
  }
  function run(args, env) {
    console.log(`\nAdapter verification: ${args.join(' ')}`);
    return new Promise((resolve, reject) => {
      const processChild = child(args, env);
      processChild.once('error', reject);
      processChild.once('close', (code, signal) => code === 0 ? resolve() : reject(new Error(`Adapter check failed (${signal ?? code}): ${args.join(' ')}`)));
    });
  }
  async function stopServer() {
    const ownedServer = server;
    server = undefined;
    if (!ownedServer || ownedServer.exitCode !== null || ownedServer.signalCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { ownedServer.kill(); }, 10_000);
      ownedServer.once('close', () => { clearTimeout(timer); resolve(); });
      if (ownedServer.connected) ownedServer.send('shutdown'); else ownedServer.kill();
    });
  }
  async function startServer() {
    server = child([fileURLToPath(import.meta.url), '--svelte-server'], {}, true);
    const ownedServer = server;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Svelte verification server startup timed out')), 60_000);
      function finish(error, url) {
        clearTimeout(timer); ownedServer.off('message', message); ownedServer.off('error', failed); ownedServer.off('close', closed);
        error ? reject(error) : resolve(url);
      }
      function message(value) { if (value?.type === 'ready') finish(undefined, value.url); }
      function failed(error) { finish(error); }
      function closed(code) { finish(new Error(`Svelte verification server exited during startup (${code})`)); }
      ownedServer.on('message', message); ownedServer.once('error', failed); ownedServer.once('close', closed);
    });
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    for (const running of children) if (running !== server) running.kill();
    void stopServer().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
  process.once('exit', () => { for (const running of children) running.kill(); });
  try {
    await run(['node_modules/vitest/vitest.mjs', 'run', '--config', 'tests/retained-panels.browser.config.ts']);
    await run(['node_modules/vitest/vitest.mjs', 'run', '--config', 'tests/retained-panels.ssr.config.ts']);
    await run(['node_modules/svelte-check/bin/svelte-check', '--tsconfig', 'src/svelte/tsconfig.json']);
    await run(['node_modules/svelte-check/bin/svelte-check', '--tsconfig', 'tests/svelte/tsconfig.json']);
    await run(['tests/svelte/ssr-check.mjs']);
    const url = await startServer();
    console.log(`Owned Svelte verification server: ${url}`);
    await run(['tests/svelte/browser-check.mjs'], { WORKSPACE_SVELTE_URL: url });
    console.log('\nAdapter verification passed.');
  } finally {
    await stopServer();
  }
}
