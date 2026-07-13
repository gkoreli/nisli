import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushEffects, html, inject, resetInjector } from '@nisli/core';
import { defineRouter } from './application.js';
import { createMatcher } from './matcher.js';
import { bindRenders, notFound, redirect, route } from './route.js';
import { enumParam } from './query.js';
import { Router } from './router.js';

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Empirical two-"package" consumption probe (ADR 0026 §0.4.0):
 *   - a SHARED-like pure module authors the catalog render-less (identity,
 *     codecs, metadata) — the shape a Worker and a strict `shared` package use;
 *   - a CLIENT-like module binds render implementations with `bindRenders`;
 *   - the Worker consumes the render-less catalog via `createMatcher` directly.
 */

// ── shared-like module: identity only, no render, no client import ────────────
const sharedCatalog = {
  home: route('/', { metadata: { title: 'Home' } }),
  about: route('/:locale/about', {
    params: { locale: enumParam(['en', 'ka'] as const) },
    metadata: ({ params }) => ({ lang: params.locale, canonical: `https://x/${params.locale}/about` }),
  }),
  legacy: redirect('/old', '/'),
  notFound: notFound({ metadata: { title: 'Missing' } }),
};

describe('render-separated catalog: one identity, bound behavior', () => {
  beforeEach(() => {
    resetInjector();
    document.body.replaceChildren();
    document.head.querySelectorAll('meta, link').forEach((n) => n.remove());
    document.documentElement.removeAttribute('lang');
    history.replaceState(null, '', '/');
  });
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('Worker consumes the render-less shared catalog directly', () => {
    const match = createMatcher(sharedCatalog);
    expect(match('/')?.name).toBe('home');
    expect(match('/en/about')?.metadata).toEqual({ lang: 'en', canonical: 'https://x/en/about' });
    expect(match('/old')?.redirect).toBe('/');
    expect(match('/zz/about')?.notFound).toBe(true);
  });

  it('client binds renders and renders the same route identity', async () => {
    // ── client-like module: attaches render targets, keyed, exhaustive ──
    const bound = bindRenders(sharedCatalog, {
      home: () => html`<p>home</p>`,
      about: ({ params }) => html`<p>about ${params.locale}</p>`,
      notFound: () => html`<p>missing</p>`,
    });
    const AppRouter = defineRouter(bound);

    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    const router = inject(Router);

    await router.navigate('/en/about');
    flushEffects();
    expect(shell.textContent).toContain('about en');
    expect(document.documentElement.getAttribute('lang')).toBe('en'); // shared metadata still applies
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://x/en/about');

    // Identity retained: href on the bound catalog equals the shared definition's.
    expect(AppRouter.routes.about.href({ params: { locale: 'ka' } }))
      .toBe(sharedCatalog.about.href({ params: { locale: 'ka' } }));

    await router.navigate('/old'); // redirect still works post-binding
    await settle();
    flushEffects();
    expect(location.pathname).toBe('/');
    expect(shell.textContent).toContain('home');
  });

  it('throws a clear error if an unbound route is navigated to', async () => {
    const AppRouter = defineRouter(sharedCatalog); // NOT bound
    const shell = document.createElement('div');
    html`${AppRouter({})}`.mount!(shell);
    document.body.appendChild(shell);
    const router = inject(Router);

    await router.navigate('/');
    await settle();
    flushEffects();
    expect(router.error.value).toBeInstanceOf(Error);
    expect(String((router.error.value as Error).message)).toContain('bindRenders');
  });
});
