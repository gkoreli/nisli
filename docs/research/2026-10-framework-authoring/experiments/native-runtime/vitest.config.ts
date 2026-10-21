import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { snapshotRoot } from './prepare.mjs';
export default defineConfig({
  resolve: { alias: {
    '@nisli/core': resolve(snapshotRoot, 'packages/core/src/index.js'),
    '@fixture/progress': resolve(snapshotRoot, 'packages/ui/registry/default/ui/progress.js'),
    '@fixture/input': resolve(snapshotRoot, 'packages/ui/registry/default/ui/input.js'),
    '@fixture/slider': resolve(snapshotRoot, 'packages/ui/registry/default/ui/slider.js'),
    '@fixture/utils': resolve(snapshotRoot, 'packages/ui/registry/default/lib/utils.js'),
  } },
  test: { environment: 'happy-dom', include: ['docs/research/2026-10-framework-authoring/experiments/native-runtime/*.test.ts'] },
});
