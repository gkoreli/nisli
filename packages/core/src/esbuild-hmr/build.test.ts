/**
 * build.test.ts — End-to-end build regression for ADR 0021 (0.49.1 bug fix).
 *
 * This is the exact 0.49.0 bug: the client was injected via esbuild's `banner`,
 * which is RAW PASSTHROUGH TEXT — esbuild never resolves or bundles it — so the
 * bare `import … from "@nisli/core/esbuild-hmr/runtime"` leaked verbatim into the
 * output and the browser threw `Failed to resolve module specifier`.
 *
 * We run a REAL esbuild build with the plugin and assert on the BUILT output:
 *   1. No bare `import … from "@nisli/core/…"` survives — the runtime is INLINED.
 *   2. The configured `clientUrl` is what the injected client passes to connect().
 *   3. esbuild applies the inject to the JS entry only — a file/copy-loaded
 *      `logo.svg` entry never receives the client (matches the viewer setup).
 *
 * esbuild is an OPTIONAL peerDependency; its JS API resolves the platform binary
 * from the `@esbuild/<platform>` optional dep (installed via the lockfile), so
 * this runs in CI even though the postinstall build script is blocked.
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nisliHmrPlugin } from './plugin.js';
import type { ChangeBroadcaster, ChangePayload } from './server.js';

// The core package dir: from packages/core/src/esbuild-hmr → ../.. is
// packages/core, where `@nisli/core` self-resolves via the package `exports`
// map (the `.` and `./esbuild-hmr/runtime` subpaths). The temp app must live
// INSIDE this package so its `import … from '@nisli/core'` resolves via the
// self-reference (esbuild resolves an import relative to the importing file's
// directory, not `absWorkingDir`) — mirroring how a consumer resolves the
// package from its own node_modules.
const here = dirname(fileURLToPath(import.meta.url));
const coreDir = resolve(here, '../..');

function fakeBroadcaster(): ChangeBroadcaster & { events: ChangePayload[] } {
  const events: ChangePayload[] = [];
  return { events, clientCount: 0, broadcast: (p) => void events.push(p) };
}

// esbuild's types aren't available (optional peer dep). Load via dynamic import
// and type the surface we use locally.
type EsbuildModule = {
  build: (opts: Record<string, unknown>) => Promise<{
    outputFiles?: { path: string; text: string }[];
  }>;
};

let esbuild: EsbuildModule;
const tmpDirs: string[] = [];

beforeAll(async () => {
  esbuild = (await import('esbuild')) as unknown as EsbuildModule;
});

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

/** Run a real esbuild build of a tiny app that imports `component` from core. */
async function buildApp(clientUrl?: string): Promise<{ main: string; logo?: string }> {
  // Temp app dir INSIDE the core package so `@nisli/core` self-resolves.
  const tmp = mkdtempSync(join(coreDir, '.hmr-build-test-'));
  tmpDirs.push(tmp);
  // A real author module: imports `component` from @nisli/core and defines one.
  writeFileSync(
    join(tmp, 'app.ts'),
    `import { component, html } from '@nisli/core';\n` +
      `component('x-demo', () => html\`<span>hi</span>\`);\n`,
  );
  // A non-JS entry loaded via the file loader (mirrors the viewer's logo.svg).
  writeFileSync(join(tmp, 'logo.svg'), '<svg></svg>');

  const broadcaster = fakeBroadcaster();
  const result = await esbuild.build({
    entryPoints: { main: join(tmp, 'app.ts'), logo: join(tmp, 'logo.svg') },
    bundle: true,
    format: 'esm',
    write: false,
    outdir: join(tmp, 'out'),
    loader: { '.svg': 'file' },
    // Resolve `@nisli/core` against the core package (self-reference exports).
    absWorkingDir: coreDir,
    plugins: [nisliHmrPlugin(clientUrl ? { broadcaster, clientUrl } : { broadcaster })],
  });

  const files = result.outputFiles ?? [];
  const main = files.find((f) => f.path.endsWith('main.js'));
  const logo = files.find((f) => f.path.endsWith('logo.js'));
  if (!main) throw new Error('no main.js output');
  return { main: main.text, logo: logo?.text };
}

describe('built output: no leaked bare import (the 0.49.0 bug)', () => {
  it('inlines the runtime — NO bare `import … from "@nisli/core/…"` survives', async () => {
    const { main } = await buildApp();
    // The exact failure: a bare specifier import leaking into the bundle.
    expect(main).not.toMatch(/import\s*\{[^}]*\}\s*from\s*["']@nisli\/core/);
    expect(main).not.toMatch(/from\s*["']@nisli\/core\/esbuild-hmr\/runtime["']/);
    // The runtime must actually be present (inlined), not absent.
    expect(main).toContain('EventSource');
    // And the client must be booted.
    expect(main).toContain('connect');
  });

  it('bakes the default clientUrl (/esbuild) into the injected client', async () => {
    const { main } = await buildApp();
    expect(main).toContain('"/esbuild"');
  });

  it('bakes a configured absolute clientUrl into the injected client', async () => {
    const url = 'http://localhost:3031/esbuild';
    const { main } = await buildApp(url);
    expect(main).toContain(JSON.stringify(url));
  });

  it('injects the client only into the JS entry, never the svg/file entry', async () => {
    const { logo } = await buildApp();
    // The file-loader entry emits a JS shim exporting the asset path; it must
    // NOT contain the HMR client (esbuild applies `inject` to JS modules only).
    expect(logo).toBeDefined();
    expect(logo).not.toContain('EventSource');
    expect(logo).not.toContain('/esbuild');
  });
});
