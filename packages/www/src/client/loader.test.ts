/**
 * client/loader.test.ts — WWW-15 derived-hydration seam.
 *
 * Drives the REAL resolveLoader fallback (not the pure pieces in isolation):
 * an uncurated name must import/register its component module AND mount the
 * AutoHydrate PRIMARY tag. Deleting the fallback register-or-mount turns these
 * red — the non-vacuity bar rev held the nav-coverage test to.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { flush, html, type TemplateResult } from '@nisli/core';
import { resolveLoader } from './loader.js';

function mount(t: TemplateResult): HTMLElement {
  const c = document.createElement('div');
  document.body.appendChild(c);
  html`${t}`.mount(c);
  flush();
  return c;
}

describe('WWW-15 resolveLoader (derived hydration seam)', () => {
  it('curated example wins — an override, never registers the auto-default', async () => {
    let registered = false;
    const curated = () => html`<p data-slot="curated">curated</p>`;
    const loader = resolveLoader('anything', {
      loadExamples: async () => ({ getExample: () => curated }),
      registerComponent: () => {
        registered = true;
        return Promise.resolve();
      },
    });
    const mod = await loader();
    expect(registered, 'curated path must NOT fall through to register/auto-default').toBe(false);
    const c = mount(mod.default());
    expect(c.querySelector('[data-slot="curated"]')).not.toBeNull();
  });

  it('uncurated name drives the real fallback: registers the module + mounts the PRIMARY tag', async () => {
    const registered: string[] = [];
    // `toast` has a TAG_OVERRIDE (primaryTag('toast') === 'ui-toaster'), so the
    // mount assertion also proves the primary-tag derivation, not a naive ui-<name>.
    const loader = resolveLoader('toast', {
      loadExamples: async () => ({ getExample: () => undefined }),
      registerComponent: async (n) => {
        registered.push(n);
      },
      // autoDefault defaults to the real AutoHydrate + primaryTag — exercised, not doubled.
    });
    const mod = await loader();

    // The fallback imported/registered the component module by name.
    // (Delete the `await deps.registerComponent(name)` line → this goes red.)
    expect(registered, 'fallback must register the component module by name').toEqual(['toast']);

    // AutoHydrate live-mounted the PRIMARY tag.
    // (Drop the AutoHydrate mount, or hardcode ui-<name>, → this goes red.)
    const c = mount(mod.default());
    expect(c.querySelector('ui-toaster'), 'auto-default mounts the primary tag').not.toBeNull();
    expect(c.querySelector('ui-toast'), 'must NOT mount the naive ui-<name>').toBeNull();
  });
});
