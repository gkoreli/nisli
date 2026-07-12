/**
 * router-equivalence.test.ts — ADR 0026 validation step 6 for @nisli/www:
 * the site's real routes are matched identically by browser navigation, the
 * Vite dev adapter, and the STATIC BUILD. One AppRouter, one contract.
 *
 * The SSG leg is captured from an actual buildStaticSite({ router }) run — so it
 * exercises real dynamic-route expansion and the emitted 404, not just another
 * call to the shared matcher.
 *
 * @vitest-environment happy-dom
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { html, inject, resetInjector, tick } from '@nisli/core';
import { Router, type RouteMatch } from '@nisli/router';
import { nisliRoutes } from '@nisli/router/vite';
import { buildStaticSite, type StaticRouterMatch } from '@nisli/ssg';
import { AppRouter } from './app-router.js';

const tempRoots: string[] = [];

afterEach(() => {
  document.body.replaceChildren();
  resetInjector();
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

type Summary = { name: string | null; params: Record<string, string>; notFound: boolean };

function summarize(match: RouteMatch | StaticRouterMatch | null | undefined): Summary | null {
  if (!match) return null;
  return { name: match.name, params: match.params, notFound: match.notFound };
}

// One URL per route shape, with the static file the SSG build emits for it.
const CASES = [
  { url: '/', emitted: '/', name: 'home', params: {}, notFound: false },
  { url: '/ui', emitted: '/ui', name: 'ui', params: {}, notFound: false },
  { url: '/ui/button', emitted: '/ui/button', name: 'uiItem', params: { name: 'button' }, notFound: false },
  { url: '/themes', emitted: '/themes', name: 'themes', params: {}, notFound: false },
  { url: '/docs', emitted: '/docs', name: 'docs', params: {}, notFound: false },
  { url: '/docs/signals', emitted: '/docs/signals', name: 'docTopic', params: { topic: 'signals' }, notFound: false },
  { url: '/definitely-not-a-page', emitted: '/404.html', name: null, params: {}, notFound: true },
] as const;

describe('www route contract', () => {
  it('matches every representative URL equivalently in browser, Vite, and the static build', async () => {
    // SSG leg: a real static build. Capture each emitted page's match by path —
    // exercising entries() expansion (/ui/:name, /docs/:topic) + the 404.
    const outDir = mkdtempSync(join(tmpdir(), 'nisli-www-equivalence-'));
    tempRoots.push(outDir);
    const ssgByPath = new Map<string, StaticRouterMatch>();
    await buildStaticSite({
      outDir,
      router: AppRouter,
      shell: (page) => {
        ssgByPath.set(page.path, page.match);
        return page.content;
      },
    });

    // Browser leg: mount the outlet so the Router service connects the definition.
    const host = document.createElement('div');
    document.body.appendChild(host);
    html`${AppRouter({})}`.mount(host);
    await tick();
    const browser = inject(Router);

    // Vite leg: the dev adapter delegates matching to the same AppRouter.
    const vite = nisliRoutes(AppRouter);

    for (const testCase of CASES) {
      const expected: Summary = {
        name: testCase.name,
        params: testCase.params,
        notFound: testCase.notFound,
      };

      await browser.navigate(testCase.url, { replace: true });
      await tick();

      const ssg = summarize(ssgByPath.get(testCase.emitted));
      const browserMatch = summarize(browser.current.value);
      const viteMatch = summarize(vite.match(testCase.url, 'http://nisli.local/'));

      // the static build actually emitted this page…
      expect(ssg, `SSG emitted ${testCase.emitted}`).toEqual(expected);
      // …and browser + Vite agree with it, three ways.
      expect(browserMatch, `browser ${testCase.url}`).toEqual(ssg);
      expect(viteMatch, `Vite ${testCase.url}`).toEqual(ssg);
    }
  });
});
