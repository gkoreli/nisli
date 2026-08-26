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
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { nisliRoutes } from '@nisli/router/vite';
import { buildStaticSite } from '@nisli/ssg';
import { AppRouter } from './app-router.js';
import { navHrefs } from './layout/nav-model.js';
import { TOP_LINKS } from './layout/site-shell.js';
import { createTempCleanup } from './temp-cleanup.js';

const BASE = 'http://nisli.local/';
// Every path the persistent chrome must anchor: the top-bar links, DERIVED from
// the component that renders them, plus `/` (the brand logo, not a nav link).
const TOP_BAR = ['/', ...TOP_LINKS.map((link) => link.href)];

// Pages that RENDER the docs sidebar but are not leaves inside it. Exactly one,
// and it is a real design decision rather than an oversight: `/ui` is the
// gallery INDEX, reached from the top bar, while its leaves are the registry
// items below it. Note who is NOT here — `/docs` is both a top-bar link and a
// sidebar leaf (it is the intro doc, a genuine entry in the docs catalog), and
// `/intent` needs no exception because it renders in SiteShell alone and so
// never appears in `docsShaped` at all. The previous path-prefix predicate got
// `/ui` right by accident, via a trailing slash in `startsWith('/ui/')`.
const SIDEBAR_INDEX_EXCEPTIONS = ['/ui'];

/**
 * Is this page docs-shaped — i.e. does it actually render the sidebar?
 *
 * DERIVED FROM THE EMITTED HTML, not from a path prefix list. The old version
 * was `path === '/docs' || path.startsWith('/docs/') || path.startsWith('/ui/')`,
 * which is a third hand-written copy of a shape the router decides in its render
 * closures. A new docs-shaped route family (`/intent/playground`,
 * `/intent/comparison`) is invisible to a list like that, so the bijection below
 * would have gone on comparing two sets that both silently excluded it — the
 * failure mode this suite exists to catch, one level up.
 *
 * `data-hydrate="mobile-nav"` is DocsLayout's own marker (layout/docs-layout.ts):
 * the mobile drawer frame, emitted by that layout and by nothing else. So a page
 * is docs-shaped iff the sidebar chrome is really in its output, which is exactly
 * the claim "this page is reachable from, and belongs in, the sidebar" needs.
 */
const DOCS_LAYOUT_CHROME = 'data-hydrate="mobile-nav"';

// ONE real static build shared across the suite. buildStaticSite enumerates the
// router's actual emission (~80 pages) — ~2s locally, >5s on a slow CI runner,
// so running it inside the test tripped vitest's 5s DEFAULT per-test timeout
// (run 29206586898: this file + router-equivalence timed out while product
// content and the settled guard passed). Hoisted to beforeAll with a sized hook
// timeout (bounded setup, not per-test masking) — same fix as render.test.
// The temp dir is tracked BEFORE the build; on a build failure we capture the
// primary error and rethrow, and afterAll runs the injectable cleanup helper
// (attempt-every-root, primary precedence, first-cleanup-failure surfacing).
/** The paths whose EMITTED page carries the docs sidebar chrome. */
let docsShaped: Set<string>;
/** Every emitted page's HTML, for the reachability assertion. */
let htmlByPath: Map<string, string>;
const cleanup = createTempCleanup();
beforeAll(async () => {
  const outDir = cleanup.track(mkdtempSync(join(tmpdir(), 'nav-coverage-')));
  try {
    const result = await buildStaticSite({ outDir, router: AppRouter, shell: (page) => page.content });
    // Read the markers off the WRITTEN files, not off `page.content` — that is a
    // `Renderable` (a nisli template) inside the shell callback, and the whole
    // point of these predicates is to ask the emitted HTML.
    htmlByPath = new Map(result.pages.map((page) => [page.path, readFileSync(page.filePath, 'utf8')]));
    docsShaped = new Set(
      [...htmlByPath].filter(([, html]) => html.includes(DOCS_LAYOUT_CHROME)).map(([path]) => path),
    );
  } catch (error) {
    cleanup.capturePrimary(error);
    throw error;
  }
}, 60_000);
afterAll(() => cleanup.finalize());

describe('WWW-12 nav coverage (against the real AppRouter)', () => {
  it('every nav href resolves through the AppRouter matcher to a docs-shaped route', () => {
    const vite = nisliRoutes(AppRouter);
    for (const href of navHrefs) {
      const match = vite.match(href, BASE);
      expect(match, `nav href ${href} matched no route`).not.toBeNull();
      expect(match!.notFound, `nav href ${href} matched notFound — dangling nav`).toBe(false);
      expect(
        docsShaped.has(href),
        `nav href ${href} matched route "${match!.name}", whose emitted page has no sidebar chrome`,
      ).toBe(true);
    }
  });

  it('the sidebar covers EXACTLY the sidebar-rendering pages, minus the index', () => {
    // Bijection against the router's actual emission (built once in beforeAll):
    // no dangling nav entry, and no page that paints the sidebar chrome without
    // appearing in it. Both sides are derived — nav from the catalogs, shape from
    // the emitted HTML — so this fails on a real miswiring in either.
    const sidebarLeaves = new Set(
      [...docsShaped].filter((path) => !SIDEBAR_INDEX_EXCEPTIONS.includes(path)),
    );
    expect(new Set(navHrefs)).toEqual(sidebarLeaves);
    expect(navHrefs.length).toBe(new Set(navHrefs).size); // no duplicate leaves
  });

  it('keeps the chrome routes real, and the sidebar index out of its own sidebar', () => {
    const vite = nisliRoutes(AppRouter);
    for (const path of TOP_BAR) {
      const match = vite.match(path, BASE);
      expect(match?.notFound, `${path} should be a real route`).toBe(false);
    }
    for (const path of SIDEBAR_INDEX_EXCEPTIONS) {
      expect(navHrefs.includes(path), `${path} is the sidebar index, not a leaf inside it`).toBe(false);
    }
  });

  // REACHABILITY. Every assertion above is satisfied by a page that exists,
  // renders, is correctly absent from the sidebar — and that no anchor anywhere
  // points at. `/intent` shipped in exactly that state: route registered, nav
  // group derived, this suite green, and the top bar still reading
  // Docs / Components / Themes. A page nobody can navigate to is a page nobody
  // sees, and nothing here could tell.
  //
  // THE FIRST ATTEMPT AT THIS TEST WAS VACUOUS, and worth recording because it
  // failed the same way as the bug. It asserted every `TOP_LINKS` href appears in
  // every page's HTML — but `TOP_LINKS` IS the list the chrome renders from, so
  // deleting the `/intent` entry removed it from the expectation and the output
  // in the same edit. Verified: with that line deleted, the suite stayed green.
  // Two views of one list cannot check each other.
  //
  // So the two sides are now independent by construction: the ROUTER says what
  // exists, the RENDERED ANCHORS say what can be reached, and neither is derived
  // from the other. `/404.html` is the one exclusion, and it is a real one — it
  // is reached by a server status code, not by a link.
  it('links every emitted route from somewhere in the site', () => {
    const anchored = new Set<string>();
    for (const html of htmlByPath.values()) {
      for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
        // The SSG emits `/docs/signals`; a static host serves `/docs/signals/`.
        // One trailing slash apart would read as an orphan, so normalise both.
        anchored.add(href.length > 1 ? href.replace(/\/$/, '') : href);
      }
    }
    const orphans = [...htmlByPath.keys()].filter(
      (path) => path !== '/404.html' && !anchored.has(path.length > 1 ? path.replace(/\/$/, '') : path),
    );
    expect(orphans, `unreachable pages — emitted but linked from nowhere: ${orphans.join(', ')}`).toEqual([]);
  });
});
