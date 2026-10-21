import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'happy-dom', include: ['docs/research/2026-10-agent-app/experiments/form-as-operation/probe.test.ts'] },
});
