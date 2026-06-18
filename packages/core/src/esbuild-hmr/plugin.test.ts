/**
 * plugin.test.ts — esbuild plugin transform + output-diff invariants (ADR 0021).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { transformSource, diffOutputs, clientShimSource, nisliHmrPlugin } from './plugin.js';
import type { ChangeBroadcaster, ChangePayload } from './server.js';

const CORE = '@nisli/core';
const RUNTIME = '@nisli/core/esbuild-hmr/runtime';

describe('transformSource (Ruling 2 — call-site indirection)', () => {
  it('wraps component imported from core and routes setup through __register', () => {
    const src = `import { component } from '@nisli/core';\nexport const X = component('x-tag', () => null);\n`;
    const out = transformSource(src, CORE, RUNTIME);
    expect(out).toContain(`import { __register as __nisliRegister } from '${RUNTIME}'`);
    expect(out).toContain('component as __nisliRealComponent');
    expect(out).toContain('__nisliRealComponent(tag, __nisliRegister(tag, setup), opts)');
    // The author call site is unchanged — no author code edit (constraint).
    expect(out).toContain(`component('x-tag', () => null)`);
  });

  it('preserves sibling named imports', () => {
    const src = `import { component, html, signal } from '@nisli/core';\n`;
    const out = transformSource(src, CORE, RUNTIME);
    expect(out).toContain('component as __nisliRealComponent');
    expect(out).toContain('html');
    expect(out).toContain('signal');
  });

  it('is a no-op when component is not imported from core', () => {
    const src = `import { html, signal } from '@nisli/core';\nconst y = 1;\n`;
    expect(transformSource(src, CORE, RUNTIME)).toBe(src);
  });

  it('is a no-op for modules that do not import core at all', () => {
    const src = `export const util = (a) => a + 1;\n`;
    expect(transformSource(src, CORE, RUNTIME)).toBe(src);
  });
});

describe('clientShimSource', () => {
  it('boots the dev client from the runtime subpath with the configured clientUrl', () => {
    const shim = clientShimSource(RUNTIME, '/esbuild');
    expect(shim).toContain(`import { connect as __nisliConnect } from '${RUNTIME}'`);
    // The shim calls connect with the SSE path baked in (FIX 2).
    expect(shim).toContain('__nisliConnect({ path: "/esbuild" });');
  });

  it('bakes an absolute cross-origin clientUrl into the connect call', () => {
    const shim = clientShimSource(RUNTIME, 'http://localhost:3031/esbuild');
    expect(shim).toContain('__nisliConnect({ path: "http://localhost:3031/esbuild" });');
  });
});

describe('diffOutputs (Ruling 4 transport)', () => {
  it('returns null on the first build (baseline only)', () => {
    expect(diffOutputs(null, new Map([['a.js', 'h1']]))).toBeNull();
  });

  it('detects updated outputs by hash change', () => {
    const prev = new Map([['a.js', 'h1'], ['a.css', 'c1']]);
    const next = new Map([['a.js', 'h2'], ['a.css', 'c1']]);
    expect(diffOutputs(prev, next)).toEqual({ added: [], removed: [], updated: ['a.js'] });
  });

  it('detects added and removed outputs', () => {
    const prev = new Map([['a.js', 'h1']]);
    const next = new Map([['a.js', 'h1'], ['b.js', 'h9']]);
    expect(diffOutputs(prev, next)).toEqual({ added: ['b.js'], removed: [], updated: [] });

    const next2 = new Map<string, string>();
    expect(diffOutputs(prev, next2)).toEqual({ added: [], removed: ['a.js'], updated: [] });
  });
});

describe('nisliHmrPlugin wiring', () => {
  function fakeBroadcaster(): ChangeBroadcaster & { events: ChangePayload[] } {
    const events: ChangePayload[] = [];
    return { events, clientCount: 0, broadcast: (p) => void events.push(p) };
  }

  it('registers the inject shim (not a banner) plus onResolve/onLoad/onEnd hooks', () => {
    const broadcaster = fakeBroadcaster();
    const plugin = nisliHmrPlugin({ broadcaster });
    expect(plugin.name).toBe('nisli-hmr');

    let onLoadFilter: RegExp | null = null;
    let onEnd: ((r: { metafile?: { outputs: Record<string, { bytes: number; hash?: string }> } }) => void) | null = null;
    let onResolveRegistered = false;
    const initialOptions: { banner?: { js?: string }; inject?: string[] } = {};

    plugin.setup({
      initialOptions,
      onResolve: () => { onResolveRegistered = true; },
      onLoad: (opts: { filter: RegExp }) => { onLoadFilter = opts.filter; },
      onEnd: (cb: unknown) => { onEnd = cb as never; },
    } as never);

    // FIX 1: the client is wired via `inject`, never via a raw `banner`.
    expect(initialOptions.banner).toBeUndefined();
    expect(initialOptions.inject).toEqual(['nisli-hmr-client-shim']);
    expect(onResolveRegistered).toBe(true);
    expect(onLoadFilter).toBeInstanceOf(RegExp);
    expect(onEnd).toBeTypeOf('function');

    // First onEnd = baseline (no broadcast); second = a real diff broadcast.
    onEnd!({ metafile: { outputs: { 'app.js': { bytes: 10, hash: 'h1' } } } });
    expect(broadcaster.events).toHaveLength(0);
    onEnd!({ metafile: { outputs: { 'app.js': { bytes: 12, hash: 'h2' } } } });
    expect(broadcaster.events).toHaveLength(1);
    expect(broadcaster.events[0]).toEqual({ added: [], removed: [], updated: ['app.js'] });
  });
});
