import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
export default defineConfig({ plugins: [solid({ ssr: true })], build: {
  ssr: 'src/solid.ts', outDir: 'dist', emptyOutDir: false,
  rollupOptions: { external: [/^@devslab\/dds-icons$/, /^solid-js(?:\/|$)/, /^@ark-ui\//], output: { entryFileNames: 'solid-server.js' } },
} });
