/**
 * nav-coverage.test.ts — the WWW-12 route↔nav bijection guard.
 *
 * The sidebar nav (layout/nav-model.ts) is DERIVED from the same registry +
 * docs sources the router expands its routes from, so the two must stay in
 * lockstep. To catch a MISWIRED router (not just an internally-consistent
 * derivation), this drives every nav href through the REAL AppRouter — the Vite
 * adapter's matcher and a real buildStaticSite enumeration — rather than a set
 * reconstructed from the same sources. Deleting or miswiring AppRouter.uiItem /
 * docTopic makes a nav href match `notFound` (or drop from the emission), and
 * the test fails (ADR 0024 WWW-12 amendment; the "zero hand list" invariant
 * made executable AND non-vacuous).
 *
 * @vitest-environment happy-dom
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { nisliRoutes } from '@nisli/router/vite';
import { buildStaticSite } from '@nisli/ssg';
import { AppRouter } from './app-router.js';
import { navHrefs } from './layout/nav-model.js';

const BASE = 'http://nisli.local/';
// Route names that legitimately back a sidebar leaf (docs-shaped routes).
const SIDEBAR_ROUTE_NAMES = new Set(['docs', 'docTopic', 'uiItem']);
// Top-bar / brand routes — real routes, but NOT sidebar leaves by design.
const TOP_BAR = ['/', '/ui', '/themes'];

const tempRoots: string[] = [];
afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A page is docs-shaped if it is /docs, /docs/<slug>, or /ui/<name>. */
function isDocsShaped(path: string): boolean {
  return path === '/docs' || path.startsWith('/docs/') || path.startsWith('/ui/');
}

describe('WWW-12 nav coverage (against the real AppRouter)', () => {
  it('every nav href resolves through the AppRouter matcher to a docs-shaped route', () => {
    const vite = nisliRoutes(AppRouter);
    for (const href of navHrefs) {
      const match = vite.match(href, BASE);
      expect(match, `nav href ${href} matched no route`).not.toBeNull();
      expect(match!.notFound, `nav href ${href} matched notFound — dangling nav`).toBe(false);
      expect(
        SIDEBAR_ROUTE_NAMES.has(match!.name ?? ''),
        `nav href ${href} matched route "${match!.name}", not a docs-shaped route`,
      ).toBe(true);
    }
  });

  it('the sidebar covers EXACTLY the docs-shaped routes the router actually emits', async () => {
    // Enumerate the router's REAL emission (entries() expansion of /ui/:name and
    // /docs/:topic), not a set rebuilt from the nav's own sources.
    const outDir = mkdtempSync(join(tmpdir(), 'nav-coverage-'));
    tempRoots.push(outDir);
    const emitted: string[] = [];
    await buildStaticSite({
      outDir,
      router: AppRouter,
      shell: (page) => {
        emitted.push(page.path);
        return page.content;
      },
    });
    const emittedDocsShaped = emitted.filter(isDocsShaped);

    // Bijection against the router's actual routes: no dangling nav entry and no
    // docs-shaped route missing a nav entry.
    expect(new Set(navHrefs)).toEqual(new Set(emittedDocsShaped));
    expect(navHrefs.length).toBe(new Set(navHrefs).size); // no duplicate leaves
  });

  it('keeps the top-bar/brand routes real but OUT of the sidebar (documented split)', () => {
    const vite = nisliRoutes(AppRouter);
    for (const path of TOP_BAR) {
      const match = vite.match(path, BASE);
      expect(match?.notFound, `${path} should be a real route`).toBe(false);
      expect(navHrefs.includes(path), `${path} is top-bar nav, not a sidebar leaf`).toBe(false);
    }
  });
});
