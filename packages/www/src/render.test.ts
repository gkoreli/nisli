/**
 * render.test.ts — renders the whole site into dist/ and asserts each page.
 * Doubles as the render step of `pnpm --filter @nisli/www build`.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSite } from './build.js';
import { components, primitives } from './registry.js';
import { primaryTag } from './preview.js';
import { getExample } from './examples.js';

describe('nisli website', () => {
  // ONE full-site build shared across the suite. buildSite() renders all ~80
  // routes (live @nisli/ui previews) + writes dist/ — ~2s locally, ~5-6s on a
  // slow CI runner. It used to run once PER build-carrying test (8×; the 9th
  // test was already synchronous), which made each of those tests trip vitest's
  // 5s DEFAULT per-test timeout on Ubuntu runners (run 29205544349: 8/9 tests
  // timed out, file 41.685s). Profiled: the cost is inherent to rendering 80
  // pages — NOT a WWW-15 regression (curated vs auto-default render measured
  // within noise, ~2.0s either way) — so the honest fix is hoisting the one
  // build, not inflating per-test timeouts. The single build gets a sized hook
  // timeout (bounded setup, not per-test masking).
  let built: Awaited<ReturnType<typeof buildSite>>;
  beforeAll(async () => {
    built = await buildSite();
  }, 60_000);

  it('renders every route through the shell + chrome', () => {
    const paths = new Set(built.map((p) => p.path));

    // the AppRouter's static routes + the notFound page are all emitted
    for (const path of ['/', '/ui', '/themes', '/docs', '/404.html']) {
      expect(paths.has(path), `missing built page ${path}`).toBe(true);
    }

    for (const page of built) {
      const html = readFileSync(page.filePath, 'utf8');
      // full document wrapper
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('/assets/site.css'); // absolute, resolves from nested routes
      // persistent chrome (nav + footer as nisli components)
      expect(html).toContain('href="/docs"');
      expect(html).toContain('href="/ui"');
      expect(html).toContain('id="theme-toggle"');
      expect(html).toContain('github.com/gkoreli/nisli'); // footer
    }
  });

  it('renders the home page with live @nisli/ui components', () => {
    const home = built.find((p) => p.path === '/');
    expect(home).toBeDefined();
    const page = readFileSync(home!.filePath, 'utf8');

    expect(page).toContain('<title>nisli — the reactive web-component framework</title>');
    expect(page).toContain('<ui-button'); // real @nisli/ui custom elements, SSG-rendered
    expect(page).toContain('id="gallery"');
    expect(page).toContain('id="install"');
    expect(page).toContain('id="framework"');
  });

  it('is registry-driven: one /ui/<name> route per registry item', () => {
    const paths = new Set(built.map((p) => p.path));

    // every component + primitive in the registry has its own page
    for (const item of [...components, ...primitives]) {
      expect(paths.has(`/ui/${item.name}`)).toBe(true);
    }
    expect(paths.has('/ui')).toBe(true);
  });

  it('renders a component page from registry metadata (exact add command)', () => {
    const button = built.find((p) => p.path === '/ui/button');
    expect(button).toBeDefined();
    const page = readFileSync(button!.filePath, 'utf8');

    expect(page).toContain('npx @nisli/ui add button'); // exact command from item name
    expect(page).toContain('ui/button.ts'); // files you own
    expect(page).toContain('<ui-button'); // curated live preview

    // /ui index links to component pages
    const index = built.find((p) => p.path === '/ui');
    const indexHtml = readFileSync(index!.filePath, 'utf8');
    expect(indexHtml).toContain('href="/ui/button"');
    expect(indexHtml).toContain('href="/ui/dialog"');
  });

  it('renders framework-first docs with a hello-world quick-start', () => {
    // docs landing + concept pages exist
    for (const path of ['/docs', '/docs/quick-start', '/docs/signals', '/docs/cli']) {
      expect(built.some((p) => p.path === path)).toBe(true);
    }

    const quick = built.find((p) => p.path === '/docs/quick-start');
    const page = readFileSync(quick!.filePath, 'utf8');
    // framework hello-world, not an @nisli/ui add walkthrough
    expect(page).toContain("component('x-counter'");
    expect(page).toContain("from '@nisli/core'");
    expect(page).toContain('href="/docs/signals"'); // sidebar nav
  });

  // WWW-6 permanent guard: every ui-type registry item must open with a live,
  // upgraded component preview on its /ui/<name> page. This absorbs the demo
  // package's dogfood role — www is now the sole end-to-end regression.
  it('renders a live preview for every ui component (WWW-6 guard)', () => {
    for (const item of components) {
      const page = built.find((p) => p.path === `/ui/${item.name}`);
      expect(page, `missing page for ${item.name}`).toBeDefined();
      const htmlText = readFileSync(page!.filePath, 'utf8');

      // How to fix a failure here — this guard replaces packages/ui/demo, so
      // the message must teach the remedy, not just name the item.
      const remedy =
        `\nFIX "${item.name}":\n` +
        `  1. Copy the component in:  pnpm --filter @nisli/www sync\n` +
        `  2. Regenerate the import barrel src/preview-elements.ts so it imports the new module.\n` +
        `  3. Expected primary tag is "${primaryTag(item.name)}". If the component's real\n` +
        `     custom-element tag differs, add a TAG_OVERRIDES entry in src/preview.ts\n` +
        `     (or add a curated example in src/examples.ts).`;

      // isolate the preview frame (up to the Installation heading that follows)
      const start = htmlText.indexOf(`data-preview="${item.name}"`);
      expect(start, `no preview frame for "${item.name}" — page did not render.${remedy}`).toBeGreaterThan(-1);
      const frame = htmlText.slice(start, htmlText.indexOf('Installation', start));

      // a real @nisli/ui custom element that actually upgraded (not a bare tag)
      expect(/<ui-[a-z-]+/.test(frame), `"${item.name}": no <ui-*> element in preview.${remedy}`).toBe(true);
      expect(
        /display: contents|data-slot=|role=|aria-/.test(frame),
        `"${item.name}": preview <ui-*> did not upgrade (empty/unregistered tag).${remedy}`,
      ).toBe(true);
    }

    // primitives (lib) are behavioral — they intentionally have no preview
    expect(primitives.every((p) => p.type === 'lib')).toBe(true);
  });

  it('renders the themes token showcase', () => {
    const themes = built.find((p) => p.path === '/themes');
    expect(themes).toBeDefined();
    const page = readFileSync(themes!.filePath, 'utf8');
    expect(page).toContain('Color tokens');
    expect(page).toContain('--primary'); // token names shown
    expect(page).toContain('bg-chart-1'); // chart palette
  });

  // WWW-13/15: the client runtime is referenced by EXACTLY the pages that carry
  // something for it to mount, and intent's stylesheet by EXACTLY the pages that
  // declare intent's vocabulary. Both are read out of dist/ — the SUBJECT is the
  // emitted HTML, not a predicate.
  //
  // WHAT THIS REPLACED, because the shape mattered more than the coverage. This
  // test used to hold its own copy of build.ts's `/ui`/`/docs` prefix list and
  // assert `has(path) === isDocsLayout(path)`. Two hand-written lists compared
  // to each other: satisfied whenever BOTH said "no", so it agreed most loudly
  // exactly where a page was missing from the feature. Adding the /intent routes
  // made both sides answer "no" and this file stayed green while the pages
  // shipped with no client half at all — and for intent that is not a dead
  // drawer, it is a measured tier that never measures, which renders as *almost
  // right*. Nobody files a bug against almost right.
  //
  // So the assertion is now the invariant a reader actually cares about, in both
  // directions: a frame with no runtime is a dead island, and a runtime with no
  // frame is bytes a static page paid for. The positive block underneath is what
  // keeps it non-vacuous — an invariant over an empty set is free.
  it('references the client runtime and intent stylesheet on exactly the pages that need them', () => {
    const RUNTIME = '/ui-preview/hydrate.js';
    const INTENT_CSS = '/assets/intent.css';
    // The two selectors client/hydrate.ts actually mounts, and intent's axis
    // attributes minus the two @nisli/ui also writes (data-align, data-role) —
    // the same reasoning build.ts's predicates carry, expressed from the outside.
    const FRAME = /\bdata-(?:hydrate=|preview\b)/;
    const VOCABULARY =
      /\bdata-(?:appearance|layout|text|priority|collapse|grow|clip|density|input|fit|truncate|flush|table|component|theme)[=>\s]/;

    const pages = built.map((page) => ({ path: page.path, html: readFileSync(page.filePath, 'utf8') }));

    for (const { path, html } of pages) {
      expect(html.includes(RUNTIME), `${path}: runtime reference must match its hydration frames`)
        .toBe(FRAME.test(html));
      expect(html.includes(INTENT_CSS), `${path}: intent stylesheet must match its declared vocabulary`)
        .toBe(VOCABULARY.test(html));
    }

    // NON-VACUITY: both sides of both invariants must be a non-empty set, or the
    // loop above is satisfied by a site that ships neither feature.
    const withRuntime = pages.filter((p) => p.html.includes(RUNTIME)).map((p) => p.path);
    const withIntent = pages.filter((p) => p.html.includes(INTENT_CSS)).map((p) => p.path);
    for (const path of ['/ui', '/docs', '/docs/signals', '/ui/button']) {
      expect(withRuntime, `${path} carries the sidebar drawer and must reference the runtime`).toContain(path);
    }
    for (const path of ['/', '/themes', '/404.html']) {
      expect(withRuntime, `${path} has nothing to hydrate and must stay runtime-free`).not.toContain(path);
      expect(withIntent, `${path} declares no intent vocabulary and must not link intent.css`).not.toContain(path);
    }
    // Every intent surface uses the vocabulary (that is what they are for) and
    // every one of them hosts a measured-tier island, so they are on both lists.
    for (const path of ['/intent', '/intent/playground', '/intent/comparison']) {
      expect(withIntent, `${path} must link intent.css`).toContain(path);
      expect(withRuntime, `${path} hosts a measured-tier island and must reference the runtime`).toContain(path);
    }
  });

  // WWW-15: every SHIPPED ui component IS curated, so no live preview frame ever
  // falls to the auto-default and paints empty (cdx2's guard correctly refuses a
  // boxless auto-default — compositional families like attachment must curate).
  // The auto-default is the derivation FLOOR, exercised non-vacuously through the
  // real loader in client/loader.test.ts — not asserted on pure pieces here.
  it('every ui component is curated (no live frame falls to an empty auto-default)', () => {
    for (const c of components) {
      expect(getExample(c.name), `${c.name} must have a curated example (no empty auto-default)`).toBeDefined();
    }
  });
});
