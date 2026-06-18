/**
 * prod-isolation.test.ts — Constraint guard for ADR 0021 (Ruling 1 & 5).
 *
 * The HMR subpath must be UNREACHABLE from the `.` runtime entry, so production
 * is byte-identical by construction (stronger than relying on tree-shaking).
 * This test walks the *static import graph* of the built `.` entry
 * (`dist/index.js`) and asserts:
 *   1. No module in the `.` graph imports anything under `esbuild-hmr/`.
 *   2. No module in the `.` graph contains HMR runtime markers.
 *   3. The HMR subpath files exist on their own (built, but off the `.` graph).
 *
 * Reads built output, so it requires `pnpm build` first (the task + CI build
 * before test). If `dist/` is absent the test fails loudly rather than skipping,
 * because the isolation guarantee is unverified without the build.
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../../dist');
const entry = resolve(distDir, 'index.js');

/** HMR-specific tokens that must never appear in the `.` runtime graph. */
const HMR_MARKERS = ['__nisliRegister', '__nisliConnect', 'nisli-hmr', 'EventSource', 'esbuild-hmr'];

/** Collect every module statically reachable from `entry` (relative imports). */
function reachableFrom(entryPath: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entryPath];
  const importRe = /(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const bareImportRe = /import\s*['"]([^'"]+)['"]/g;

  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const re of [importRe, bareImportRe]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const spec = m[1]!;
        if (!spec.startsWith('.')) continue; // only follow relative (local) imports
        const target = resolve(dirname(file), spec);
        if (existsSync(target)) stack.push(target);
      }
    }
  }
  return seen;
}

describe('prod isolation: `.` runtime entry excludes HMR (ADR 0021)', () => {
  it('dist build exists (run `pnpm build` first)', () => {
    expect(existsSync(entry), `expected built entry at ${entry}`).toBe(true);
  });

  it('the `.` graph never reaches anything under esbuild-hmr/', () => {
    const graph = reachableFrom(entry);
    const offenders = [...graph].filter((f) => f.includes('esbuild-hmr'));
    expect(offenders, `HMR files reachable from runtime entry: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('no module in the `.` graph contains HMR runtime markers', () => {
    const graph = reachableFrom(entry);
    const hits: string[] = [];
    for (const file of graph) {
      const src = readFileSync(file, 'utf8');
      for (const marker of HMR_MARKERS) {
        if (src.includes(marker)) hits.push(`${file} contains "${marker}"`);
      }
    }
    expect(hits, hits.join('\n')).toHaveLength(0);
  });

  it('the HMR subpath is built but off the `.` graph (co-versioned, isolated)', () => {
    const graph = reachableFrom(entry);
    expect(existsSync(resolve(distDir, 'esbuild-hmr/runtime.js'))).toBe(true);
    expect(existsSync(resolve(distDir, 'esbuild-hmr/plugin.js'))).toBe(true);
    expect(graph.has(resolve(distDir, 'esbuild-hmr/runtime.js'))).toBe(false);
  });
});
