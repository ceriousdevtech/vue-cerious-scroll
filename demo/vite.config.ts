import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const demoDir = fileURLToPath(new URL('.', import.meta.url));
const libEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

// The demo imports the wrapper by its package name, aliased to the library
// source so changes are picked up live without a separate build step.
export default defineConfig({
  root: demoDir,
  plugins: [vue()],
  resolve: {
    alias: {
      '@ceriousdevtech/vue-cerious-scroll': libEntry,
    },
  },
  server: {
    fs: {
      // Allow importing files from the parent (the library `src`).
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
});
