import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run after npm run build. Every consumer imports the packed distribution,
// never repository source. Tooling may use the repository's Playwright browser.
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'workspace-package-verification-'));
const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const version = name => {
  const value = manifest.devDependencies?.[name];
  assert.ok(value, `Missing build-tool or adapter development dependency: ${name}`);
  return `${name}@${value}`;
};
function command(executable, args, cwd) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveCommand(output) : reject(new Error(`${executable} ${args.join(' ')} failed (${code})\n${output}`)));
  });
}
const npm = (args, cwd) => command(process.execPath, [npmCli, ...args], cwd);
async function consumer(name, dependencies = []) {
  const directory = join(temporary, name);
  await mkdir(directory);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ name: `workspace-check-${name}`, private: true, type: 'module' }));
  await npm(['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', archive, ...dependencies.map(version)], directory);
  return directory;
}
async function runModule(directory, source) {
  await writeFile(join(directory, 'verify.mjs'), source);
  return command(process.execPath, ['verify.mjs'], directory);
}
async function runConsumer(directory, check, args = []) {
  const imports = `import assert from 'node:assert/strict'; import { createRequire } from 'node:module'; import { writeFile } from 'node:fs/promises'; import { join } from 'node:path'; import { pathToFileURL } from 'node:url';\n`;
  const output = await runModule(directory, imports + check.toString() + `\nawait ${check.name}(process.cwd(), ...${JSON.stringify(args)});`);
  process.stdout.write(output);
}
async function verifySolid(solid, playwrightPath) {
  let browser; let server;
  try {
  await writeFile(join(solid, 'App.tsx'), `
    import { Workspace } from '@devslab/workspace/solid';
    import { createWorkspace } from '@devslab/workspace/core';
    const Page = () => <label>Retained draft<input id="packed-draft" value="initial" /></label>;
    const screens = [{ id: 'orders', title: 'Orders', component: Page }];
    const controller = createWorkspace({ screens }); await controller.open('orders');
    export const App = () => <Workspace screens={screens} controller={controller} />;
  `);
  await writeFile(join(solid, 'server.tsx'), `
    import { renderToString, generateHydrationScript } from 'solid-js/web'; import { App } from './App';
    export const html = renderToString(() => <App />);
    export const bootstrap = generateHydrationScript();
  `);
  await writeFile(join(solid, 'client.tsx'), `
    import { hydrate } from 'solid-js/web'; import { App } from './App';
    hydrate(() => <App />, document.getElementById('app')!);
    (window as any).packageHydrated = true;
  `);
  const solidRequire = createRequire(join(solid, 'package.json'));
  const { createServer } = await import(pathToFileURL(solidRequire.resolve('vite')).href);
  const solidPlugin = (await import(pathToFileURL(solidRequire.resolve('vite-plugin-solid')).href)).default;
  server = await createServer({ root: solid, configFile: false, plugins: [solidPlugin({ ssr: true })], server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { include: ['solid-js', 'solid-js/web'] } });
  const { html, bootstrap } = await server.ssrLoadModule('/server.tsx');
  assert.match(html, /Retained draft/); assert.match(html, /data-hk=/);
  // The browser resolves the browser export; SSR above resolves node. Passing
  // --conditions=browser to Node would still select node in this manifest.
  await writeFile(join(solid, 'index.html'), `<!doctype html><html><body>${bootstrap}<div id="app">${html}</div><script>
    window.serverRoot = document.querySelector('[data-workspace-part="root"]');
    window.serverTab = document.querySelector('[role="tab"]');
    window.serverPanel = document.querySelector('[role="tabpanel"]');
    window.serverInput = document.getElementById('packed-draft');
    window.serverIds = [serverRoot.id, serverTab.id, serverPanel.id];
    serverInput.value = 'before hydration';
  </script><script type="module" src="/client.tsx"></script></body></html>`);
  await server.listen();
  const address = server.httpServer.address();
  const playwright = await import(playwrightPath);
  const { chromium } = playwright.default ?? playwright;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction(() => window.packageHydrated === true).catch(error => {
    throw new Error(`Packed Solid hydration did not finish. Browser errors: ${errors.join('; ')}`, { cause: error });
  });
  const hydration = await page.evaluate(() => ({
    root: serverRoot === document.querySelector('[data-workspace-part="root"]'),
    tab: serverTab === document.querySelector('[role="tab"]'),
    panel: serverPanel === document.querySelector('[role="tabpanel"]'),
    input: serverInput === document.getElementById('packed-draft'),
    ids: [serverRoot.id, serverTab.id, serverPanel.id], before: serverIds,
  }));
  assert.deepEqual(errors, [], 'Browser hydration errors');
  assert.ok(hydration.root && hydration.tab && hydration.panel && hydration.input, 'Hydration replaced server-rendered DOM');
  assert.deepEqual(hydration.ids, hydration.before, 'Hydration changed accessibility IDs');
  await page.getByRole('button', { name: 'Switch screens', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Close Orders', exact: true }).click();
  await page.getByRole('tab').waitFor({ state: 'detached' });
  assert.deepEqual(errors, [], 'Post-hydration interaction errors');
  await browser.close(); browser = undefined;
  await server.close(); server = undefined;
  console.log('Selected Solid packed SSR, DOM/ID-preserving browser hydration and interaction passed');
  } finally { await Promise.allSettled([browser?.close(), server?.close()]); }
}
async function verifySvelte(svelte) {
  let server;
  try {
  await writeFile(join(svelte, 'Page.svelte'), '<p>PACKED_SVELTE_PAGE</p>');
  await writeFile(join(svelte, 'Fixture.svelte'), `<script>
    import { Workspace } from '@devslab/workspace/svelte'; import Page from './Page.svelte';
    let { controller } = $props(); const screens = [{ id: 'orders', title: 'Orders', component: Page }];
  </script><Workspace {screens} {controller} />`);
  await writeFile(join(svelte, 'ssr.ts'), `
    import { render } from 'svelte/server'; import Fixture from './Fixture.svelte';
    import { createWorkspace } from '@devslab/workspace/core';
    const controller = createWorkspace({ screens: [{ id: 'orders', title: 'Orders' }] });
    await controller.open('orders'); export const html = render(Fixture, { props: { controller } }).body;
  `);
  const svelteRequire = createRequire(join(svelte, 'package.json'));
  const { svelte: sveltePlugin } = await import(pathToFileURL(svelteRequire.resolve('@sveltejs/vite-plugin-svelte')).href);
  const { createServer } = await import(pathToFileURL(svelteRequire.resolve('vite')).href);
  server = await createServer({ root: svelte, configFile: false, plugins: [sveltePlugin()], server: { middlewareMode: true }, appType: 'custom', ssr: { noExternal: ['@devslab/workspace', '@ark-ui/svelte'] } });
  const rendered = await server.ssrLoadModule('/ssr.ts');
  assert.match(rendered.html, /PACKED_SVELTE_PAGE/); assert.match(rendered.html, /aria-selected="true"/);
  await server.close(); server = undefined;
  console.log('Selected Svelte distribution compilation and packed SSR passed');
  } finally { await server?.close(); }
}
const base = `import assert from 'node:assert/strict';\nimport { createWorkspace } from '@devslab/workspace/core';\n`;
let archive;
try {
  await access(npmCli);
  const packed = await npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], root);
  const [pack] = JSON.parse(packed.slice(packed.indexOf('[')));
  archive = join(temporary, pack.filename);
  assert.ok(pack.files.some(file => file.path === 'dist/style.css'), 'Packed CSS is missing');
  for (const [entry, conditions] of Object.entries(manifest.exports)) {
    for (const target of new Set(typeof conditions === 'string' ? [conditions] : Object.values(conditions))) {
      assert.ok(pack.files.some(file => file.path === target.replace(/^\.\//, '')), `Missing packed export ${entry}: ${target}`);
    }
  }

  console.log('Checking clean core-only installation');
  const core = await consumer('core');
  for (const runtime of ['solid-js', 'react', 'react-dom', 'vue', 'svelte', '@ark-ui/solid', '@ark-ui/react', '@ark-ui/vue', '@ark-ui/svelte']) {
    await assert.rejects(access(join(core, 'node_modules', runtime)), { code: 'ENOENT' }, `${runtime} leaked into the core-only installation`);
  }
  await runModule(core, base + `
    import * as root from '@devslab/workspace';
    assert.equal(typeof root.createWorkspace, 'function');
    const api = createWorkspace({ screens: [{ id: 'orders', title: 'Orders' }] });
    assert.equal(await api.open('orders'), 'ok');
    assert.equal(api.getSnapshot().activeId, 'orders');
    assert.equal(await api.close('orders'), 'ok');
    assert.equal(api.getSnapshot().tabs.length, 0);
  `);
  console.log('Core-only installation and packed core operations passed');

  const react = await consumer('react', ['react', 'react-dom', '@ark-ui/react']);
  await runModule(react, base + `
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    import { Workspace } from '@devslab/workspace/react';
    const screens = [{ id: 'orders', title: 'Orders', component: () => createElement('p', {}, 'PACKED_REACT_PAGE') }];
    const controller = createWorkspace({ screens }); await controller.open('orders');
    const html = renderToString(createElement(Workspace, { screens, controller }));
    assert.match(html, /PACKED_REACT_PAGE/); assert.match(html, /aria-selected="true"/);
  `);
  console.log('Selected React installation and packed SSR passed');

  const vue = await consumer('vue', ['vue', '@ark-ui/vue']);
  await runModule(vue, base + `
    import { createSSRApp, h } from 'vue';
    import { renderToString } from 'vue/server-renderer';
    import { Workspace } from '@devslab/workspace/vue';
    const screens = [{ id: 'orders', title: 'Orders', component: { render: () => h('p', {}, 'PACKED_VUE_PAGE') } }];
    const controller = createWorkspace({ screens }); await controller.open('orders');
    const html = await renderToString(createSSRApp({ render: () => h(Workspace, { screens, controller }) }));
    assert.match(html, /PACKED_VUE_PAGE/); assert.match(html, /aria-selected="true"/);
  `);
  console.log('Selected Vue installation and packed SSR passed');

  console.log('Checking selected Solid installation, SSR and browser hydration');
  const solid = await consumer('solid', ['solid-js', '@ark-ui/solid', 'vite', 'vite-plugin-solid']);
  await runConsumer(solid, verifySolid, [pathToFileURL(createRequire(import.meta.url).resolve('@playwright/test')).href]);

  console.log('Checking selected Svelte installation and compiled packed SSR');
  const svelte = await consumer('svelte', ['svelte', '@ark-ui/svelte', 'vite', '@sveltejs/vite-plugin-svelte']);
  await runConsumer(svelte, verifySvelte);
  console.log('All packed consumer checks passed');
} finally {
  // Only the exact mkdtemp directory owned by this run is removed.
  assert.equal(dirname(temporary), resolve(tmpdir()));
  assert.ok(temporary.startsWith(join(tmpdir(), 'workspace-package-verification-')));
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
