/**
 * render.test.ts — renders the whole site into dist/ and asserts each page.
 * Doubles as the render step of `pnpm --filter @nisli/www build`.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSite } from './build.js';
import { components, primitives } from './registry.js';
import { primaryTag } from './preview.js';

describe('nisli website', () => {
  it('renders every route through the shell + chrome', async () => {
    const built = await buildSite();
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
      expect(html).toContain('github.com/gogakoreli/nisli'); // footer
    }
  });

  it('renders the home page with live @nisli/ui components', async () => {
    const built = await buildSite();
    const home = built.find((p) => p.path === '/');
    expect(home).toBeDefined();
    const page = readFileSync(home!.filePath, 'utf8');

    expect(page).toContain('<title>nisli — the reactive web-component framework</title>');
    expect(page).toContain('<ui-button'); // real @nisli/ui custom elements, SSG-rendered
    expect(page).toContain('id="gallery"');
    expect(page).toContain('id="install"');
    expect(page).toContain('id="framework"');
  });

  it('is registry-driven: one /ui/<name> route per registry item', async () => {
    const built = await buildSite();
    const paths = new Set(built.map((p) => p.path));

    // every component + primitive in the registry has its own page
    for (const item of [...components, ...primitives]) {
      expect(paths.has(`/ui/${item.name}`)).toBe(true);
    }
    expect(paths.has('/ui')).toBe(true);
  });

  it('renders a component page from registry metadata (exact add command)', async () => {
    const built = await buildSite();
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

  it('renders framework-first docs with a hello-world quick-start', async () => {
    const built = await buildSite();

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
  it('renders a live preview for every ui component (WWW-6 guard)', async () => {
    const built = await buildSite();

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

  it('renders the themes token showcase', async () => {
    const built = await buildSite();
    const themes = built.find((p) => p.path === '/themes');
    expect(themes).toBeDefined();
    const page = readFileSync(themes!.filePath, 'utf8');
    expect(page).toContain('Color tokens');
    expect(page).toContain('--primary'); // token names shown
    expect(page).toContain('bg-chart-1'); // chart palette
  });

  // WWW-10: the hydration runtime is injected only on /ui pages whose component
  // has an interactive example — nowhere else (strict progressive enhancement).
  it('injects the hydration runtime only on hydrating /ui pages', async () => {
    const built = await buildSite();
    const read = (path: string) => readFileSync(built.find((p) => p.path === path)!.filePath, 'utf8');
    const SCRIPT = '/ui-preview/hydrate.js';

    expect(read('/ui/dropdown-menu')).toContain(SCRIPT); // has a hydrate example
    expect(read('/ui/tooltip')).toContain(SCRIPT);
    expect(read('/ui/button')).not.toContain(SCRIPT); // static curated example
    expect(read('/')).not.toContain(SCRIPT); // no preview frames
    expect(read('/docs')).not.toContain(SCRIPT);
  });
});
