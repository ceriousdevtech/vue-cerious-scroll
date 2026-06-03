import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const demoDir = fileURLToPath(new URL('.', import.meta.url));
const libEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const engineEntry = fileURLToPath(
  new URL('../../cerious-scroll/src/index.ts', import.meta.url),
);
const engineRoot = fileURLToPath(new URL('../../cerious-scroll', import.meta.url));
// Only wire the sibling-engine alias when its source tree is actually present
// on disk (i.e. the monorepo-style local checkout). In CI / consumer installs
// the alias would point at a non-existent path and break the build, so we let
// Vite resolve `@ceriousdevtech/cerious-scroll` from node_modules instead.
const hasSiblingEngine = existsSync(engineEntry);

// The demo imports the wrapper by its package name, aliased to the library
// source so changes are picked up live without a separate build step. The
// core engine is also aliased so changes there flow into the demo live.
export default defineConfig({
  root: demoDir,
  plugins: [vue()],
  resolve: {
    alias: {
      '@ceriousdevtech/vue-cerious-scroll': libEntry,
      ...(hasSiblingEngine ? { '@ceriousdevtech/cerious-scroll': engineEntry } : {}),
    },
  },
  server: {
    host: true, // bind 0.0.0.0 so phones on the LAN can reach the demo
    port: 5174,
    strictPort: true,
    fs: {
      // Allow importing files from the parent (the library `src`) and the
      // sibling core engine.
      allow: [fileURLToPath(new URL('..', import.meta.url)), engineRoot],
    },
  },
});
