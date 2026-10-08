import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
export default defineConfig(({ mode }) => ({
  plugins: [solid({ ssr: true })],
  build: mode === 'demo' ? { outDir: 'demo-dist' } : {
    lib: { entry: { index: 'src/index.ts', core: 'src/core.ts', solid: 'src/solid.ts', react: 'src/react.tsx', vue: 'src/vue.ts' }, formats: ['es'] },
    rollupOptions: { external: [/^solid-js(?:\/|$)/, /^@ark-ui\//, /^react(?:-dom)?(?:\/|$)/, /^vue(?:\/|$)/] }
  }
}));
