import { defineConfig } from 'vite';

// No alias needed: `@nisli/core` is a workspace dependency and its development
// export map points straight at TypeScript source, so vite transpiles core from
// packages/core/src with no build step.
export default defineConfig({
  server: { port: 5199, strictPort: true, host: '127.0.0.1' },
});
