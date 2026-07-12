import tailwindcss from '@tailwindcss/vite';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { nisliRoutes } from '@nisli/router/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'node:path';
import { AppRouter } from './src/app-router.js';

export default defineConfig({
  root: resolve(import.meta.dirname, 'dev'),
  // nisliRoutes serves the dev shell for any URL the AppRouter matches (so
  // /docs, /ui/button, etc. work on direct load / refresh instead of 404ing),
  // delegating matching to the same AppRouter the browser and SSG use.
  plugins: [nisliRoutes(AppRouter), nisliHmr(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [searchForWorkspaceRoot(import.meta.dirname)],
    },
  },
});
