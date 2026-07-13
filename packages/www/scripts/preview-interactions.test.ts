import { describe, expect, it } from 'vitest';
import { AUDITED_INTERACTIVE, INTERACTIONS, assertInteractionCoverage, cleanupSweepResources, drawerIsUseful, interactionCoverage, isSweepFailure, phoneFit } from './preview-interactions.mjs';

describe('preview touch interaction manifest', () => {
  const names = [...AUDITED_INTERACTIVE, 'badge', 'card'];

  it('accepts exact bidirectional hydration coverage', () => {
    expect(interactionCoverage(names)).toEqual({ missing: [], notHydrated: [], invalid: [], orphanedAliases: [] });
    expect(() => assertInteractionCoverage(names)).not.toThrow();
  });

  it('mutation: rejects a hydrated family whose touch assertion was deleted', () => {
    const { accordion: _removed, ...mutated } = INTERACTIONS;
    expect(() => assertInteractionCoverage(names, mutated)).toThrow(/missing=\[accordion\]/);
  });

  it('mutation: rejects a custom manifest family outside the registry corpus', () => {
    expect(() => assertInteractionCoverage(names.filter((name) => name !== 'accordion'))).toThrow(/not-hydrated=\[accordion\]/);
  });

  it('mutation: rejects a native manifest family outside the registry corpus', () => {
    expect(() => assertInteractionCoverage(names.filter((name) => name !== 'select'))).toThrow(/not-hydrated=\[select\]/);
  });

  it('mutation: rejects a command alias whose combobox contract was deleted', () => {
    const { combobox: _removed, ...mutated } = INTERACTIONS;
    expect(() => assertInteractionCoverage(names, mutated)).toThrow(/orphaned-aliases=\[command\]/);
  });

  it('allows hydrated visual-only previews without invented actions', () => {
    expect(() => assertInteractionCoverage([...names, 'aspect-ratio', 'spinner'])).not.toThrow();
  });

  it('mutation: rejects missing selectors and unsupported state checks', () => {
    expect(interactionCoverage(names, { ...INTERACTIONS, accordion: { kind: 'paint', target: '' } }).invalid)
      .toEqual(['accordion']);
  });
});

describe('phone sweep non-vacuous failure dimensions', () => {
  const pass = { upgrade: 'OK', open: 'n/a', touch: 'OK(false->true)', fit: phoneFit(390, 390), hydrated: 'OK', assetFails: [] };

  it('accepts only a fully proven phone result', () => expect(isSweepFailure(pass)).toBe(false));
  it('mutation: rejects a 704/704 page that only proves relative fit', () => {
    const fit = phoneFit(704, 704);
    expect(fit).toBe('FAIL(704/704;expected=390)');
    expect(isSweepFailure({ ...pass, fit })).toBe(true);
  });
  it.each([
    ['trigger-only touch', { touch: 'FAIL(overlay 0->0)' }],
    ['paint-only inert tree', { upgrade: 'INERT ui-accordion' }],
    ['horizontal overflow', { fit: 'FAIL(412/390)' }],
    ['missing hydration', { hydrated: 'MISSING' }],
    ['broken asset', { assetFails: ['HTTP404 /chunk.js'] }],
    ['runtime error', { err: 'ReferenceError: broken' }],
  ])('mutation: rejects %s', (_name, mutation) => {
    expect(isSweepFailure({ ...pass, ...mutation })).toBe(true);
  });
});

describe('preview sweep cleanup precedence', () => {
  function resources(failures = {}) {
    const calls = [];
    const phone = { close: () => { calls.push('phone'); if (failures.phone) throw failures.phone; } };
    const browser = { close: async () => { calls.push('browser'); if (failures.browser) throw failures.browser; } };
    const server = { close: (callback) => { calls.push('server'); callback(failures.server); } };
    return { phone, browser, server, calls };
  }

  it('mandatory cleanup closes every resource with zero survivors', async () => {
    const state = resources();
    const settled = await cleanupSweepResources(state);
    expect(state.calls).toEqual(['phone', 'browser', 'server']);
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
  });

  it('injected primary+cleanup failures preserve the primary error', async () => {
    const primaryFailure = new Error('primary');
    const state = resources({ phone: new Error('sync cleanup'), browser: new Error('async cleanup'), server: new Error('server cleanup') });
    await expect(cleanupSweepResources({ ...state, primaryFailure })).resolves.toHaveLength(3);
    expect(state.calls).toEqual(['phone', 'browser', 'server']);
  });

  it('injected cleanup-only failure rejects after every close was attempted', async () => {
    const state = resources({ phone: new Error('cleanup only') });
    await expect(cleanupSweepResources(state)).rejects.toThrow('cleanup only');
    expect(state.calls).toEqual(['phone', 'browser', 'server']);
  });

  it('waits for the child context to settle before closing its owning browser', async () => {
    const calls = [];
    let phoneSettled = false;
    const phone = { close: async () => {
      calls.push('phone:start');
      await Promise.resolve();
      phoneSettled = true;
      calls.push('phone:end');
    } };
    const browser = { close: async () => {
      calls.push('browser');
      if (!phoneSettled) throw new Error('browser raced child context');
    } };
    const server = { close: (callback) => { calls.push('server'); callback(); } };
    await expect(cleanupSweepResources({ phone, browser, server })).resolves.toHaveLength(3);
    expect(calls).toEqual(['phone:start', 'phone:end', 'browser', 'server']);
  });
});

describe('mobile docs drawer usefulness', () => {
  const useful = { sheet: true, mobile: true, navItems: 8, links: 8, validLinks: 8, overflow: 0 };
  it('requires an open mobile drawer with real navigation', () => expect(drawerIsUseful(useful)).toBe(true));
  it.each([
    ['painted empty shell', { navItems: 0, links: 0, validLinks: 0 }],
    ['invalid links', { validLinks: 0 }],
    ['phone overflow', { overflow: 22 }],
  ])('mutation: rejects %s', (_name, mutation) => {
    expect(drawerIsUseful({ ...useful, ...mutation })).toBe(false);
  });
});
