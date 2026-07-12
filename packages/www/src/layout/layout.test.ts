/**
 * layout/layout.test.ts — WWW-12 layout components (structure smoke test).
 *
 * Asserts the derived nav model + the dogfooded layout structure; visual fit
 * (fixed-frame offset, spacing) is verified post-deploy via the /ui sweep.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest';
import { flush, html, type TemplateResult } from '@nisli/core';
import { DocsLayout } from './docs-layout.js';
import { SiteShell } from './site-shell.js';
import { buildNav, navHrefs } from './nav-model.js';

function render(t: TemplateResult): HTMLElement {
  const c = document.createElement('div');
  document.body.appendChild(c);
  // Wrap so a bare factory-call result (not a root template) is mountable.
  html`${t}`.mount(c);
  flush();
  return c;
}

describe('WWW-12 nav-model', () => {
  it('derives groups zero-hand-list with single active resolution', () => {
    const model = buildNav('/ui/button');
    const titles = model.groups.map((g) => g.title);
    expect(titles).toContain('Components');
    expect(titles).toContain('Primitives');

    const active = model.groups.flatMap((g) => g.items).filter((i) => i.active);
    expect(active).toHaveLength(1);
    expect(active[0]!.href).toBe('/ui/button');

    // Coverage surface includes registry + docs hrefs.
    expect(navHrefs).toContain('/ui/button');
    expect(navHrefs).toContain('/docs');
  });
});

describe('WWW-12 DocsLayout', () => {
  it('dogfoods the registry sidebar: provider + grouped nav as real anchors', () => {
    const c = render(DocsLayout(html`<p id="body">Body</p>`, { current: '/docs' }));

    expect(c.querySelector('ui-sidebar-provider')).not.toBeNull();
    expect(c.querySelector('[data-slot="sidebar"]')).not.toBeNull();
    expect(c.querySelector('#body')).not.toBeNull();

    const labels = [...c.querySelectorAll('[data-slot="sidebar-group-label"]')].map(
      (e) => e.textContent,
    );
    expect(labels).toContain('Components');

    // Every nav link is a real anchor (zero-JS navigation).
    const links = [...c.querySelectorAll<HTMLElement>('[data-slot="sidebar-menu-button"]')];
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.tagName === 'A')).toBe(true);

    // The current route's item is marked active.
    const active = c.querySelector('[data-slot="sidebar-menu-button"][aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/docs');

    // Mobile drawer is the www-local MobileNav chrome unit (WWW-15 option B) —
    // a replace-hydrated [data-hydrate="mobile-nav"] region (a registry Sheet),
    // NOT the registry Sidebar's own mobile trigger (that double-rendered).
    expect(c.querySelector('[data-hydrate="mobile-nav"]')).not.toBeNull();
    expect(c.querySelector('[data-hydrate="mobile-nav"] [data-slot="sheet-trigger"]')).not.toBeNull();
  });

  it('exposes the docs sidebar as a labeled navigation landmark', () => {
    // The registry Sidebar frame is div-based, so the primary docs nav needs its
    // own labeled <nav> landmark (distinct from SiteShell's aria-label="Main"),
    // and it must actually wrap the grouped nav links.
    const c = render(DocsLayout(html`<p>Body</p>`, { current: '/docs' }));
    const nav = c.querySelector('nav[aria-label="Documentation"]');
    expect(nav, 'docs sidebar must be a labeled nav landmark').not.toBeNull();
    expect(
      nav!.querySelector('[data-slot="sidebar-menu-button"]'),
      'the landmark must contain the grouped nav links',
    ).not.toBeNull();
  });
});

describe('WWW-12 SiteShell', () => {
  it('wraps content in a main landmark with a skip link and active top nav', () => {
    const c = render(SiteShell(html`<p id="x">hi</p>`, { current: '/docs' }));
    expect(c.querySelector('a[href="#main-content"]')).not.toBeNull();
    expect(c.querySelector('main#main-content')).not.toBeNull();
    expect(c.querySelector('#x')).not.toBeNull();
    const active = c.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/docs');
  });
});
