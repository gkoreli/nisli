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
});
