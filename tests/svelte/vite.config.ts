import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
export default defineConfig({ root: fileURLToPath(new URL('./demo', import.meta.url)), plugins: [svelte()], server: { host: '127.0.0.1', port: 5199, strictPort: true, fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] } } });
