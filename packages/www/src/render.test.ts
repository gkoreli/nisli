/**
 * render.test.ts — renders the site into dist/ and asserts the page.
 * Doubles as the render step of `pnpm --filter @nisli/site build`.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSite } from './build.js';

describe('showcase site', () => {
  it('renders the landing page end-to-end', async () => {
    const outFile = await buildSite();
    const page = readFileSync(outFile, 'utf8');

    expect(page).toContain('<!doctype html>');
    expect(page).toContain('./assets/site.css');
    expect(page).toContain('Own your components.');
    expect(page).toContain('<ui-button'); // real @nisli/ui custom elements
    expect(page).toContain('id="gallery"');
    expect(page).toContain('id="install"');
    expect(page).toContain('id="framework"');
    expect(page).toContain('theme-toggle');
  });
});
