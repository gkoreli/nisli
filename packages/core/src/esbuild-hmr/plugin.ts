/**
 * esbuild-hmr/plugin.ts — Dev-only esbuild plugin for Nisli component HMR.
 *
 * DEV-ONLY, build-time (Node). Reachable only via `@nisli/core/esbuild-hmr`,
 * never from the runtime `.` entry (ADR 0021, Ruling 1). It is added to the
 * esbuild plugin list ONLY on the `--watch` path; `pnpm build` (no watch) never
 * sees it, so prod is byte-identical by construction (Ruling 5).
 *
 * `esbuild` is an OPTIONAL peerDependency. To keep `@nisli/core` dependency-free
 * we do NOT `import` esbuild here — we type the plugin against a minimal local
 * structural surface. The host build script supplies the real esbuild.
 *
 * What it does:
 *  1. onLoad (Ruling 2): for author modules that import `component` from
 *     `@nisli/core`, rewrite the import so `component(tag, setup, opts)` routes
 *     `setup` through the runtime tag-keyed registry's STABLE indirection thunk.
 *     The real `FrameworkComponent` thus captures a thunk that always reads the
 *     current setup — no class swap, no tag re-definition.
 *  2. onEnd (Ruling 4 transport): diff the metafile outputs against the previous
 *     build and broadcast a `change` payload ({added, removed, updated}) over
 *     SSE so the browser client can escalate (css/js/reload).
 *  3. Inject the browser dev client (`@nisli/core/esbuild-hmr/runtime` +
 *     `connect()`) via an esbuild `banner`, so no author HTML/JS change is needed.
 */

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import type { ChangeBroadcaster } from './server.js';

// ── Minimal structural esbuild surface (no esbuild import) ──────────

/** A subset of esbuild's `OnLoadArgs` we rely on. */
interface OnLoadArgs {
  path: string;
}
/** A subset of esbuild's `OnLoadResult`. */
interface OnLoadResult {
  contents: string;
  loader?: 'ts' | 'tsx' | 'js' | 'jsx';
}
/** A subset of esbuild's metafile. */
interface Metafile {
  outputs: Record<string, { bytes: number; hash?: string }>;
}
/** A subset of esbuild's `BuildResult`. */
interface BuildResult {
  metafile?: Metafile;
}
/** The hooks surface of esbuild's `PluginBuild` we use. */
interface PluginBuild {
  initialOptions: {
    banner?: { js?: string } & Record<string, string | undefined>;
    [key: string]: unknown;
  };
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: OnLoadArgs) => OnLoadResult | undefined,
  ): void;
  onEnd(callback: (result: BuildResult) => void): void;
}
/** esbuild's `Plugin` shape (structural). */
export interface EsbuildPlugin {
  name: string;
  setup(build: PluginBuild): void;
}

// ── Options ─────────────────────────────────────────────────────────

export interface NisliHmrPluginOptions {
  /**
   * Broadcaster used to push `change` events to connected clients. Supply the
   * one returned by `createHmrServer()` (server.ts), or any object with a
   * `broadcast(payload)` method (e.g. an esbuild `serve` adapter).
   */
  broadcaster: ChangeBroadcaster;
  /**
   * The module specifier author code imports `component` from.
   * Defaults to `@nisli/core`.
   */
  coreSpecifier?: string;
  /**
   * The specifier of the browser dev runtime, injected into the bundle banner.
   * Defaults to `@nisli/core/esbuild-hmr/runtime`.
   */
  runtimeSpecifier?: string;
  /** Files to transform. Defaults to TS/JS sources (excludes node_modules). */
  filter?: RegExp;
}

// ── Source transform (Ruling 2) ─────────────────────────────────────

const DEFAULT_FILTER = /\.[mc]?[jt]sx?$/;

/**
 * Rewrite a module's source so the `component` it imports from `@nisli/core` is
 * wrapped by the registry indirection. Pure function — exported for testing.
 *
 * Strategy: alias the real import, then shadow `component` with a wrapper that
 * registers the setup and passes a STABLE thunk to the real `component`. The
 * wrapper is a no-op-shaped passthrough at runtime cost of one Map write +
 * one thunk allocation per `component()` call.
 *
 * Returns the original source unchanged if it does not import `component` from
 * the core specifier (nothing to wrap).
 */
export function transformSource(code: string, coreSpecifier: string, runtimeSpecifier: string): string {
  const spec = escapeRegExp(coreSpecifier);
  // Match a named import of `component` (alone or among others) from core.
  const importRe = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${spec}['"]`,
    'g',
  );

  let importsComponent = false;
  const rewritten = code.replace(importRe, (_full: string, names: string) => {
    const parts = names.split(',').map((s) => s.trim()).filter(Boolean);
    const next = parts.map((p) => {
      // Handle `component` and `component as X` — we only wrap the bare name.
      if (p === 'component') {
        importsComponent = true;
        return 'component as __nisliRealComponent';
      }
      return p;
    });
    return `import { ${next.join(', ')} } from '${coreSpecifier}'`;
  });

  if (!importsComponent) return code;

  // Prepend the registry-import + wrapper. `__register` returns the STABLE
  // thunk the real component captures; the wrapper preserves the factory's
  // return value and signature.
  const preamble =
    `import { __register as __nisliRegister } from '${runtimeSpecifier}';\n` +
    `function component(tag, setup, opts) {\n` +
    `  return __nisliRealComponent(tag, __nisliRegister(tag, setup), opts);\n` +
    `}\n`;

  return preamble + rewritten;
}

/** Banner that boots the browser dev client once per bundle. */
export function clientBanner(runtimeSpecifier: string): string {
  return (
    `import { connect as __nisliConnect } from '${runtimeSpecifier}';\n` +
    `__nisliConnect();\n`
  );
}

// ── The plugin ──────────────────────────────────────────────────────

/**
 * Create the dev-only Nisli HMR esbuild plugin. Add it to `plugins` ONLY when
 * building with `--watch`; never on the prod build path.
 */
export function nisliHmrPlugin(options: NisliHmrPluginOptions): EsbuildPlugin {
  const coreSpecifier = options.coreSpecifier ?? '@nisli/core';
  const runtimeSpecifier = options.runtimeSpecifier ?? '@nisli/core/esbuild-hmr/runtime';
  const filter = options.filter ?? DEFAULT_FILTER;
  const { broadcaster } = options;

  let prevHashes: Map<string, string> | null = null;

  return {
    name: 'nisli-hmr',
    setup(build) {
      // Inject the browser dev client into the bundle banner (no HTML change).
      const banner = build.initialOptions.banner ?? {};
      banner.js = `${clientBanner(runtimeSpecifier)}${banner.js ?? ''}`;
      build.initialOptions.banner = banner;

      // 1. Transform: wrap component() call sites (Ruling 2).
      build.onLoad({ filter }, (args) => {
        if (args.path.includes('node_modules')) return undefined;
        const code = readFileSafe(args.path);
        if (code === null) return undefined;
        const contents = transformSource(code, coreSpecifier, runtimeSpecifier);
        if (contents === code) return undefined; // nothing to wrap; let esbuild load it
        return { contents, loader: loaderFor(args.path) };
      });

      // 2. Diff outputs and broadcast a change payload (Ruling 4 transport).
      build.onEnd((result) => {
        const outputs = result.metafile?.outputs;
        if (!outputs) {
          // No metafile -> cannot diff -> signal a reload-worthy change.
          broadcaster.broadcast({ added: [], removed: [], updated: [] });
          return;
        }
        const nextHashes = new Map<string, string>();
        for (const [path, meta] of Object.entries(outputs)) {
          nextHashes.set(path, meta.hash ?? String(meta.bytes));
        }
        const payload = diffOutputs(prevHashes, nextHashes);
        prevHashes = nextHashes;
        // First build establishes the baseline; don't broadcast on it.
        if (payload) broadcaster.broadcast(payload);
      });
    },
  };
}

/**
 * Diff two output-hash maps into an esbuild-shaped change payload.
 * Returns `null` for the very first build (no previous baseline).
 * Exported for testing.
 */
export function diffOutputs(
  prev: Map<string, string> | null,
  next: Map<string, string>,
): { added: string[]; removed: string[]; updated: string[] } | null {
  if (prev === null) return null;
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  for (const [path, hash] of next) {
    const before = prev.get(path);
    if (before === undefined) added.push(path);
    else if (before !== hash) updated.push(path);
  }
  for (const path of prev.keys()) {
    if (!next.has(path)) removed.push(path);
  }
  return { added, removed, updated };
}

// ── helpers ─────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loaderFor(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.jsx')) return 'jsx';
  if (/\.[mc]?ts$/.test(path)) return 'ts';
  return 'js';
}

/**
 * Read a file synchronously. Build-time only (Node); returns null on failure so
 * esbuild falls back to its own loader. `node:fs` is fine here — this module is
 * never reachable from the `.` runtime graph (ADR 0021, Ruling 1).
 */
function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}
