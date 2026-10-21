import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'happy-dom', include: ['docs/research/2026-10-framework-authoring/experiments/ownership/probe.test.ts'] } });
