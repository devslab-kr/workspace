import { defineConfig } from 'vitest/config';
import solid from 'vite-plugin-solid';
export default defineConfig({ plugins: [solid({ ssr: true, hot: false })], test: { environment: 'node', include: ['tests/retained-panels.ssr.ts'] } });
