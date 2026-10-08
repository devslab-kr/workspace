import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], environment: 'node', pool: process.platform === 'win32' ? 'threads' : 'forks', maxWorkers: 2 } });
