/**
 * vite-hmr/plugin.test.ts — Transform behavior for the Nisli Vite HMR plugin
 * (ADR 0110).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { nisliHmr } from './plugin.js';

const RT = '@nisli/core/vite-hmr/runtime';

function run(code: string, id = '/proj/components/foo.ts') {
  return nisliHmr().transform(code, id);
}

describe('nisli vite-hmr plugin', () => {
  it('is dev-only (apply: serve) and runs pre', () => {
    const p = nisliHmr();
    expect(p.name).toBe('nisli-vite-hmr');
    expect(p.apply).toBe('serve');
    expect(p.enforce).toBe('pre');
  });

  it('wraps component() and marks the module self-accepting', () => {
    const src = `import { component, html } from '@nisli/core';\ncomponent('x-tag', () => html\`<p></p>\`);\n`;
    const out = run(src);
    expect(out).toBeDefined();
    // registry wrapper from the shared transform
    expect(out?.code).toContain(`import { __register as __nisliRegister } from '${RT}'`);
    expect(out?.code).toContain('component as __nisliRealComponent');
    // Vite self-accept boundary
    expect(out?.code).toContain(`import { __drain as __nisliViteDrain } from "${RT}"`);
    expect(out?.code).toContain('import.meta.hot.accept');
    expect(out?.code).toContain('__nisliViteDrain()');
  });

  it('leaves modules that do not import component untouched (Vite full-reloads them)', () => {
    const src = `import { signal } from '@nisli/core';\nexport const s = signal(0);\n`;
    expect(run(src)).toBeUndefined();
  });

  it('skips node_modules', () => {
    const src = `import { component } from '@nisli/core';\ncomponent('x', () => null);\n`;
    expect(run(src, '/proj/node_modules/@nisli/core/dist/index.js')).toBeUndefined();
  });

  it('skips non-source files', () => {
    expect(run('.x{color:red}', '/proj/styles.css')).toBeUndefined();
  });

  it('respects a custom runtimeSpecifier', () => {
    const src = `import { component } from '@nisli/core';\ncomponent('x', () => null);\n`;
    const out = nisliHmr({ runtimeSpecifier: '/custom/rt.js' }).transform(src, '/proj/a.ts');
    expect(out?.code).toContain(`from "/custom/rt.js"`);
    expect(out?.code).toContain(`from '/custom/rt.js'`);
  });
});
