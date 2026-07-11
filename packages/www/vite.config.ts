import tailwindcss from '@tailwindcss/vite';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(import.meta.dirname, 'dev'),
  plugins: [nisliHmr(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    fs: {
      allow: [searchForWorkspaceRoot(import.meta.dirname)],
    },
  },
});
