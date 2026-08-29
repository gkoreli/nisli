import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'node:path';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { nisliRoutes } from '@nisli/router/vite';
import { AppRouter } from './src/router.js';

export default defineConfig({
  root: resolve(import.meta.dirname, 'dev'),
  plugins: [nisliRoutes(AppRouter), nisliHmr()],
  server: {
    port: 5200,
    fs: { allow: [searchForWorkspaceRoot(import.meta.dirname)] },
    // The bank server holds Plaid secrets; the browser only ever sees /api.
    proxy: { '/api': 'http://127.0.0.1:5201' },
  },
});
