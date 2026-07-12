import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Client build for the WWW-10 preview hydration runtime. Runs after the SSG
 * render (see the `build` script), emitting the entry + per-example code-split
 * chunks into dist/ui-preview/ alongside the static HTML. The SSG shell injects
 * <script type="module" src="/ui-preview/hydrate.js"> on pages that hydrate.
 */
export default defineConfig({
  configFile: false,
  // Assets live under /ui-preview/; without this base the entry emits bare
  // `chunks/*.js` import specifiers that resolve to /chunks/* (404) instead of
  // /ui-preview/chunks/*, so every code-split example fails to hydrate (WS1).
  base: '/ui-preview/',
  build: {
    outDir: 'dist/ui-preview',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/client/hydrate.ts'),
      output: {
        entryFileNames: 'hydrate.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
