/** @vitest-environment happy-dom */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { html, inject, resetInjector, tick } from '@nisli/core';
import { defineRouter, enumParam, notFound, route, Router, type RouteMatch } from '@nisli/router';
import { nisliRoutes } from '@nisli/router/vite';
import { buildStaticSite, type StaticRouterMatch } from './index.js';

const tempRoots: string[] = [];

afterEach(() => {
  document.body.replaceChildren();
  resetInjector();
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

type MatchSummary = {
  name: string | null;
  params: Record<string, string>;
  query: Record<string, unknown>;
  notFound: boolean;
};

function summarize(match: RouteMatch | StaticRouterMatch | null): MatchSummary | null {
  if (!match) return null;
  return {
    name: match.name,
    params: match.params,
    query: match.query,
    notFound: match.notFound,
  };
}

describe('shared router contract', () => {
  it('matches equivalent static, param, query, base, and not-found URLs in browser, Vite, and SSG', async () => {
    const AppRouter = defineRouter({
      home: route('/', { render: () => html`home` }),
      user: route('/users/:id', {
        query: { tab: enumParam(['profile', 'activity'] as const).default('profile') },
        entries: () => [{ id: '42' }],
        render: ({ params, query }) => html`${params.id}:${query.tab}`,
      }),
      notFound: notFound({ render: () => html`missing` }),
    }, { base: '/app' });

    const outDir = mkdtempSync(join(tmpdir(), 'nisli-router-equivalence-'));
    tempRoots.push(outDir);
    const ssgMatches = new Map<string, StaticRouterMatch>();
    await buildStaticSite({
      outDir,
      router: AppRouter,
      shell: (page) => {
        ssgMatches.set(page.notFound ? 'notFound' : page.match.name!, page.match);
        return page.content;
      },
    });

    history.replaceState(null, '', '/app/');
    const host = document.createElement('div');
    document.body.appendChild(host);
    html`${AppRouter({})}`.mount(host);
    await tick();
    const browser = inject(Router);
    const vite = nisliRoutes(AppRouter);

    const cases = [
      { key: 'home', url: '/app/', route: AppRouter.routes.home },
      // The explicit default query is semantically identical to SSG's href,
      // which omits default-valued query parameters.
      { key: 'user', url: '/app/users/42?tab=profile', route: AppRouter.routes.user },
      { key: 'notFound', url: '/app/missing', route: AppRouter.notFound! },
    ] as const;

    for (const testCase of cases) {
      await browser.navigate(testCase.url, { replace: true });
      await tick();
      const browserRaw = browser.current.value;
      const viteRaw = vite.match(testCase.url, 'http://nisli.local/');
      const ssgRaw = ssgMatches.get(testCase.key);
      expect(browserRaw?.route, `browser route identity ${testCase.url}`).toBe(testCase.route);
      expect(viteRaw?.route, `Vite route identity ${testCase.url}`).toBe(testCase.route);
      expect(ssgRaw?.route, `SSG route identity ${testCase.url}`).toBe(testCase.route);
      expect(summarize(browserRaw), `browser ${testCase.url}`).toEqual(summarize(ssgRaw ?? null));
      expect(summarize(viteRaw), `Vite ${testCase.url}`).toEqual(summarize(ssgRaw ?? null));
    }
  });
});
