/**
 * raw-modules.d.ts — types Vite's `?raw` import (file contents as a string) so
 * doc snippets can be authored as real, compiler-checked .ts modules under
 * src/snippets/ and have their SOURCE TEXT rendered into CodeBlocks (WWW-8).
 * A snippet that doesn't typecheck fails `pnpm --filter @nisli/www typecheck`.
 */
declare module '*?raw' {
  const content: string;
  export default content;
}

/**
 * Minimal type for Vite's import.meta.glob (lazy form) — used by the WWW-10
 * hydration runtime. We declare just this rather than pulling all of
 * `vite/client`, which would redeclare `*?raw` above and clash.
 */
interface ImportMeta {
  glob<Module = Record<string, unknown>>(
    pattern: string,
  ): Record<string, () => Promise<Module>>;
}
