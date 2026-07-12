/**
 * render.test.ts — renders the whole site into dist/ and asserts each page.
 * Doubles as the render step of `pnpm --filter @nisli/www build`.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSite } from './build.js';
import { routes } from './routes.js';
import { components, primitives } from './registry.js';

describe('nisli website', () => {
  it('renders every route through the shell + chrome', async () => {
    const built = await buildSite();

    // one built page per declared route
    expect(built.map((p) => p.path).sort()).toEqual(routes.map((r) => r.path).sort());

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

  it('renders the themes token showcase', async () => {
    const built = await buildSite();
    const themes = built.find((p) => p.path === '/themes');
    expect(themes).toBeDefined();
    const page = readFileSync(themes!.filePath, 'utf8');
    expect(page).toContain('Color tokens');
    expect(page).toContain('--primary'); // token names shown
    expect(page).toContain('bg-chart-1'); // chart palette
  });
});
