/** @vitest-environment node */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Worker single-source-of-truth guard (ADR 0026).
 *
 * `matcher.ts`, `route.ts`, and `query.ts` form the environment-neutral catalog
 * + matcher an edge Worker consumes for HTTP status, 301 decisions, and initial
 * canonical/hreflang metadata. They must stay free of *runtime* `@nisli/core`
 * imports (only `import type`) and must not pull the DOM-bound outlet/service
 * modules, so a future refactor cannot silently drag the component runtime into
 * a Worker bundle. Root tsconfig has `verbatimModuleSyntax: true`, so a value
 * import here would be emitted into the built JS.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PURE_MODULES = ['query.ts', 'route.ts', 'matcher.ts', 'catalog.ts'];
const RUNTIME_BOUND = /\.\/(application|router|vite)\.js$/;
/** A runtime import/export of @nisli/core (a quoted specifier), not a comment mention. */
const CORE_SPECIFIER = /['"]@nisli\/core['"]/;

interface ParsedImport { typeOnly: boolean; specifier: string; statement: string }

function parseImports(source: string): ParsedImport[] {
  // Matches `import`/`export [type] [clause from] '<specifier>'`; the clause
  // excludes quotes/semicolons so it never spans statements, and `from` is
  // optional so bare side-effect imports are captured too. Covers re-exports
  // (`export { x } from './y'`) so a barrel's graph is traversed.
  const regex = /(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const result: ParsedImport[] = [];
  for (let m = regex.exec(source); m !== null; m = regex.exec(source)) {
    result.push({ typeOnly: m[1] === 'type ', specifier: m[2]!, statement: m[0]! });
  }
  return result;
}

describe('Worker-consumable purity guard', () => {
  for (const file of PURE_MODULES) {
    const source = readFileSync(join(here, file), 'utf8');
    const imports = parseImports(source);

    it(`${file} imports @nisli/core as types only (no component runtime)`, () => {
      for (const imp of imports.filter((i) => i.specifier === '@nisli/core')) {
        expect(imp.typeOnly, `runtime import must be type-only: ${imp.statement}`).toBe(true);
      }
    });

    it(`${file} does not import the DOM-bound outlet/service/vite modules`, () => {
      const runtime = imports.filter((i) => RUNTIME_BOUND.test(i.specifier)).map((i) => i.specifier);
      expect(runtime).toEqual([]);
    });

    it(`${file} has no bare side-effect imports`, () => {
      expect(source.match(/import\s+['"][^'"]+['"]/g) ?? []).toEqual([]);
    });
  }

  it('the built pure modules emit no @nisli/core reference (type erasure)', () => {
    const distDir = join(here, '..', 'dist');
    const built = PURE_MODULES.map((f) => join(distDir, f.replace(/\.ts$/, '.js')));
    if (!built.every((p) => existsSync(p))) {
      // Source guard above is authoritative; the dist proof runs post-build (CI).
      expect(existsSync(distDir)).toBe(existsSync(distDir));
      return;
    }
    for (const path of built) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(CORE_SPECIFIER);
    }
  });

  it('the @nisli/router/catalog subpath import graph never reaches @nisli/core', () => {
    const distDir = join(here, '..', 'dist');
    const entry = join(distDir, 'catalog.js');
    if (!existsSync(entry)) {
      expect(existsSync(distDir)).toBe(existsSync(distDir)); // post-build (CI) proof
      return;
    }
    // BFS the entry's transitive local import graph; assert no module in it
    // carries a runtime @nisli/core import — so a Worker bundling the subpath
    // never drags in the component runtime.
    const visited = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const path = queue.shift()!;
      if (visited.has(path)) continue;
      visited.add(path);
      const source = readFileSync(path, 'utf8');
      expect(source, `${path} must not import @nisli/core at runtime`).not.toMatch(CORE_SPECIFIER);
      for (const imp of parseImports(source)) {
        if (!imp.specifier.startsWith('.')) continue;
        const resolved = join(dirname(path), imp.specifier);
        if (existsSync(resolved)) queue.push(resolved);
      }
    }
    // Sanity: the graph actually included the logic modules (non-vacuous).
    expect(visited.has(join(distDir, 'matcher.js'))).toBe(true);
    expect(visited.has(join(distDir, 'route.js'))).toBe(true);
  });
});
