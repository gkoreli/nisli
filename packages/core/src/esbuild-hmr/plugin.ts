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
 *     `connect({ path })`) via esbuild's `inject` option pointed at a VIRTUAL
 *     shim module, so the runtime is RESOLVED + BUNDLED into the output (no
 *     author HTML/JS change needed). We deliberately do NOT use `banner`: a
 *     banner is raw passthrough text that esbuild neither resolves nor bundles,
 *     so a bare `import … from "@nisli/core/esbuild-hmr/runtime"` would leak
 *     verbatim into the output and the browser would throw
 *     `Failed to resolve module specifier` (no import map). `inject` runs the
 *     shim through onResolve/onLoad so the runtime is inlined at build time, and
 *     esbuild applies `inject` ONLY to JS modules — never to file/copy-loaded
 *     entries (e.g. the viewer's `logo.svg`). Verified empirically against
 *     esbuild 0.28.1.
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
  /** Directory used to resolve imports from a virtual module (the client shim). */
  resolveDir?: string;
}
/** A subset of esbuild's `OnResolveArgs`. */
interface OnResolveArgs {
  path: string;
}
/** A subset of esbuild's `OnResolveResult`. */
interface OnResolveResult {
  path: string;
  namespace?: string;
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
    /** Files esbuild injects into every JS module (never file/copy entries). */
    inject?: string[];
    /** esbuild's working directory; anchors virtual-module resolution. */
    absWorkingDir?: string;
    [key: string]: unknown;
  };
  onResolve(
    options: { filter: RegExp; namespace?: string },
    callback: (args: OnResolveArgs) => OnResolveResult | undefined,
  ): void;
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
   * The specifier of the browser dev runtime, inlined into the bundle via the
   * injected client shim. Defaults to `@nisli/core/esbuild-hmr/runtime`.
   */
  runtimeSpecifier?: string;
  /**
   * The SSE endpoint the browser dev client connects to. Baked into the injected
   * shim as `connect({ path: clientUrl })`. Defaults to `/esbuild` (esbuild's
   * client convention, same-origin).
   *
   * Set this to an ABSOLUTE URL when the SSE hub (server.ts) runs on a different
   * origin than the page server — e.g. `http://localhost:3031/esbuild` when the
   * hub listens on :3031 and the page is served by Hono on :3040. The hub already
   * sends `Access-Control-Allow-Origin: '*'`, so cross-origin SSE works.
   */
  clientUrl?: string;
  /** Files to transform. Defaults to TS/JS sources (excludes node_modules). */
  filter?: RegExp;
}

// ── Source transform (Ruling 2) ─────────────────────────────────────

const DEFAULT_FILTER = /\.[mc]?[jt]sx?$/;

/**
 * Virtual path + namespace for the injected client shim. The path is a bare
 * sentinel (not a real file); onResolve claims it into a private namespace and
 * onLoad supplies its generated source, so esbuild bundles the runtime inline.
 */
const CLIENT_SHIM_PATH = 'nisli-hmr-client-shim';
const CLIENT_SHIM_NAMESPACE = 'nisli-hmr-shim';
const CLIENT_SHIM_FILTER = /^nisli-hmr-client-shim$/;

/**
 * `transformSource` (wrap `component()` call sites) now lives in the shared
 * `../hmr/transform.js` and is re-exported here so this module's surface — and
 * the tests that import it from './plugin.js' — are unchanged (ADR 0110).
 */
import { transformSource } from '../hmr/transform.js';
export { transformSource };

/**
 * Source of the virtual client shim that esbuild's `inject` pulls into every JS
 * module. Because it is `inject`ed (not a `banner`), esbuild RESOLVES the
 * `runtimeSpecifier` import and BUNDLES `connect` inline — no bare specifier
 * survives in the output (the 0.49.0 bug). `clientUrl` is baked in so the
 * client targets the right SSE origin. Pure function — exported for testing.
 */
export function clientShimSource(runtimeSpecifier: string, clientUrl: string): string {
  return (
    `import { connect as __nisliConnect } from '${runtimeSpecifier}';\n` +
    `__nisliConnect({ path: ${JSON.stringify(clientUrl)} });\n`
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
  const clientUrl = options.clientUrl ?? '/esbuild';
  const filter = options.filter ?? DEFAULT_FILTER;
  const { broadcaster } = options;

  let prevHashes: Map<string, string> | null = null;

  return {
    name: 'nisli-hmr',
    setup(build) {
      // Inject the browser dev client via esbuild's `inject` (NOT `banner`).
      // A banner is raw passthrough text — its bare `import` would leak into the
      // output and the browser could not resolve it. `inject` points at a
      // virtual shim that esbuild resolves + bundles, inlining the runtime so no
      // bare specifier survives. esbuild applies `inject` only to JS modules, so
      // the viewer's file/copy-loaded `logo.svg` entry is never touched.
      build.initialOptions.inject = [
        ...(build.initialOptions.inject ?? []),
        CLIENT_SHIM_PATH,
      ];
      build.onResolve({ filter: CLIENT_SHIM_FILTER }, (args) => {
        if (args.path !== CLIENT_SHIM_PATH) return undefined;
        return { path: CLIENT_SHIM_PATH, namespace: CLIENT_SHIM_NAMESPACE };
      });
      build.onLoad({ filter: /.*/, namespace: CLIENT_SHIM_NAMESPACE }, () => ({
        contents: clientShimSource(runtimeSpecifier, clientUrl),
        loader: 'js',
        // A virtual module has no on-disk location, so esbuild won't know where
        // to resolve the runtime import from. Anchor it to the build's working
        // directory (where the consumer's `@nisli/core` resolves).
        resolveDir: build.initialOptions.absWorkingDir ?? process.cwd(),
      }));

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
