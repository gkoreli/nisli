/**
 * vite-hmr/plugin.ts — Dev-only Vite plugin for Nisli HMR (ADR 0110).
 *
 * Mirrors the esbuild plugin's component-wrapping (shared `transformSource`),
 * but drives re-mount through Vite's native `import.meta.hot` instead of an SSE
 * hub + whole-bundle re-import. For each source module that imports `component`
 * from `@nisli/core`, it:
 *   1. wraps `component(tag, setup)` → `component(tag, __register(tag, setup))`
 *      so a re-evaluated module swaps its setup in the shared registry, and
 *   2. appends `import.meta.hot.accept(() => __drain())` so Vite replaces JUST
 *      this module (granular HMR) and the queued re-mounts are applied.
 *
 * Because Vite re-evaluates only the changed module against a STABLE framework
 * module, there is exactly one `@nisli/core` instance — the dual-instance
 * "split-brain" of whole-bundle re-import cannot occur.
 *
 * `apply: 'serve'` makes this dev-only: the production `vite build` never runs
 * the transform, so no wrapper, no registry import, and no `import.meta.hot`
 * reach the prod bundle (zero prod HMR bytes).
 */
import { transformSource } from '../hmr/transform.js';

/**
 * Minimal structural subset of Vite's `Plugin` we implement. Declared
 * structurally (not imported from `vite`) so `@nisli/core` keeps its
 * zero-dependency footprint — `vite` is the consumer's dependency, not ours.
 */
export interface NisliVitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  apply?: 'serve' | 'build';
  transform(code: string, id: string): { code: string; map: null } | undefined;
}

export interface NisliViteHmrOptions {
  /** The specifier modules import `component` from. Default `@nisli/core`. */
  coreSpecifier?: string;
  /** The runtime subpath providing `__register`/`__drain`. Default `@nisli/core/vite-hmr/runtime`. */
  runtimeSpecifier?: string;
  /** Which module ids to transform. Default: TS/JS sources. */
  filter?: RegExp;
}

const DEFAULT_FILTER = /\.[mc]?[jt]sx?$/;

/**
 * Create the dev-only Nisli Vite HMR plugin. Add it to `plugins` in
 * `vite.config.ts`; `apply: 'serve'` keeps it off the production build path.
 */
export function nisliHmr(options: NisliViteHmrOptions = {}): NisliVitePlugin {
  const coreSpecifier = options.coreSpecifier ?? '@nisli/core';
  const runtimeSpecifier = options.runtimeSpecifier ?? '@nisli/core/vite-hmr/runtime';
  const filter = options.filter ?? DEFAULT_FILTER;

  return {
    name: 'nisli-vite-hmr',
    // Run on the raw TS source before Vite's own transforms rewrite imports.
    enforce: 'pre',
    // Dev server only — never transform the production build.
    apply: 'serve',
    transform(code: string, id: string) {
      const clean = id.split('?')[0] ?? id;
      if (clean.includes('node_modules')) return undefined;
      if (!filter.test(clean)) return undefined;

      const wrapped = transformSource(code, coreSpecifier, runtimeSpecifier);
      // Identity ⇒ the module does not import `component` — not HMR-relevant.
      // Leaving it un-accepted lets Vite propagate to a full reload (correct for
      // services/utils edits).
      if (wrapped === code) return undefined;

      const out =
        `import { __drain as __nisliViteDrain } from ${JSON.stringify(runtimeSpecifier)};\n` +
        wrapped +
        `\nif (import.meta.hot) {\n` +
        `  import.meta.hot.accept(() => { __nisliViteDrain(); });\n` +
        `}\n`;

      // map: null — the injection is an additive prepend/append on a handful of
      // component modules in DEV only; a precise map would require a sourcemap
      // dependency (magic-string), which `@nisli/core` deliberately avoids to
      // stay zero-dependency. Original statements keep their column offsets.
      return { code: out, map: null };
    },
  };
}
