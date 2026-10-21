import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'happy-dom', include: ['docs/research/2026-10-agent-app/experiments/import-lifetime/probe.test.ts'] },
});
