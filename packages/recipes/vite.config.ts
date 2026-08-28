import { defineConfig } from 'vite';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { nisliRoutes } from '@nisli/router/vite';
import { AppRouter } from './src/router.js';

// No aliases: every @nisli/* workspace dependency's development export map
// points at TypeScript source, so vite transpiles them with no build step.
export default defineConfig({
  plugins: [nisliHmr(), nisliRoutes(AppRouter)],
  server: { port: 5177, strictPort: true, host: '127.0.0.1' },
});
