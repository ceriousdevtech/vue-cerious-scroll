/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [vue(), dts({ include: ['src'], insertTypesEntry: true })],
  build: {
    lib: {
      entry: fileURLToPath(new URL('src/index.ts', import.meta.url)),
      name: 'VueCeriousScroll',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['vue', '@ceriousdevtech/cerious-scroll'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    server: {
      // The engine ships ESM with extensionless relative imports, which Node's
      // native ESM resolver can't load. Inlining it routes the package through
      // Vite's resolver (which adds the extensions) instead of externalizing it.
      deps: { inline: ['@ceriousdevtech/cerious-scroll'] },
    },
  },
});
