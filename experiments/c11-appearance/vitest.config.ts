import { defineConfig } from 'vitest/config';

// `verify`, not `test`: root `pnpm test` is `pnpm -r test`, and pnpm skips
// packages that do not define the script. Naming this script `test` would drag
// an experiment into the repo's gates, which experiments/README.md forbids.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
