import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
import { fileURLToPath } from 'node:url';
/** Adapter-only suite uses its own port so framework checks can run independently. */
export default defineConfig({ ...base, testDir: '.', testMatch: ['react-vue.spec.ts', 'retained-panels.spec.ts'], use: { ...base.use, baseURL: 'http://127.0.0.1:5291' }, webServer: { command: 'npx vite --host 127.0.0.1 --port 5291 --strictPort', cwd: fileURLToPath(new URL('..', import.meta.url)), url: 'http://127.0.0.1:5291' } });
