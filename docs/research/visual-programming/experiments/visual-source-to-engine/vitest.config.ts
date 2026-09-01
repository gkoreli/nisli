import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@nisli/engine/test', replacement: `${root}packages/engine/src/test/prove.ts` },
      { find: '@nisli/engine', replacement: `${root}packages/engine/src/index.ts` },
      { find: '@nisli/core', replacement: `${root}packages/core/src/index.ts` },
    ],
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['docs/research/visual-programming/experiments/visual-source-to-engine/*.test.ts'],
  },
});
