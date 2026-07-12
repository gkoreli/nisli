/**
 * app-router.ts — the site's typed application router (ADR 0026).
 * ONE definition, interpreted identically by the browser (dev outlet), the
 * Vite dev server (nisliRoutes), and the static build (buildStaticSite). Routes
 * are typed and correct-by-construction: /ui/:name and /docs/:topic expand from
 * the same registry + docs sources the pages render from. Replaces the old
 * hand-rolled src/routes.ts table + per-environment matching.
 *
 * Chrome (WWW-12): every route renders inside `SiteShell` (top bar + main +
 * footer); the docs-shaped routes (/ui, /ui/<name>, /docs, /docs/<slug>) render
 * their content inside `DocsLayout` (registry-dogfooded sidebar + content),
 * while home and /themes render inside SiteShell alone. Navigation is derived
 * from one source (layout/nav-model.ts) — no page-local chrome.
 *
 * Renders use lazy dynamic import (ADR 0026 §8) so importing this module — e.g.
 * into vite.config.ts for nisliRoutes — does NOT eagerly evaluate the page and
 * @nisli/ui component modules (which call component()/HTMLElement at load and
 * would crash in a non-DOM Node context). Only the matcher + DOM-free route
 * data (registry, docs metadata) load eagerly.
 */
import { html, type TemplateResult } from '@nisli/core';
import { defineRouter, route, notFound } from '@nisli/router';
import { docPages, docPath } from './pages/docs.js';
import { components, primitives, getItem, itemPath } from './registry.js';

const allItems = [...components, ...primitives];
const introDoc = docPages.find((p) => p.slug === '')!;
const topicDocs = docPages.filter((p) => p.slug);

function itemMetadata(name: string) {
  const item = getItem(name);
  const kind = item?.type === 'lib' ? 'primitive' : 'component';
  return {
    title: `${name} — nisli/ui`,
    meta: { description: item?.description ?? `The ${name} ${kind} from @nisli/ui.` },
  };
}

/** SiteShell + DocsLayout, lazily (both pull in DOM-touching component modules). */
async function chrome() {
  const { SiteShell } = await import('./layout/site-shell.js');
  const { DocsLayout } = await import('./layout/docs-layout.js');
  return { SiteShell, DocsLayout };
}

/**
 * Docs prose reads better capped at a ~70ch measure. DocsLayout's content
 * region stays fluid (per arch: /ui wants full width), so the reading-column
 * constraint lives here, at the article the docs body renders into — the
 * successor to the old page-local docsLayout's `article max-w-2xl`. /ui pages
 * pass their content unwrapped and keep the full width.
 */
function docArticle(content: TemplateResult): TemplateResult {
  return html`<article class="mx-auto w-full max-w-3xl">${content}</article>`;
}

export const AppRouter = defineRouter({
  home: route('/', {
    metadata: {
      title: 'nisli — the reactive web-component framework',
      meta: {
        description:
          'nisli is a reactive web-component framework — signals, tagged-template components, no build step, no virtual DOM, DI. @nisli/ui is its batteries-included component library, copied into your project as source you own.',
      },
    },
    render: async () => {
      const { SiteShell } = await chrome();
      const { homePage } = await import('./pages/home.js');
      return SiteShell(homePage(), { current: '/' });
    },
  }),

  ui: route('/ui', {
    metadata: {
      title: 'Components — nisli',
      meta: {
        description:
          'The @nisli/ui component gallery — shadcn-style components you copy into your project and own, installed with npx @nisli/ui add <name>.',
      },
    },
    render: async () => {
      const { SiteShell, DocsLayout } = await chrome();
      const { uiIndexPage } = await import('./pages/ui-index.js');
      return SiteShell(DocsLayout(uiIndexPage(), { current: '/ui' }), { current: '/ui' });
    },
  }),

  uiItem: route('/ui/:name', {
    entries: () => allItems.map((item) => ({ name: item.name })),
    metadata: ({ params }) => itemMetadata(params.name),
    render: async ({ params }) => {
      const { SiteShell, DocsLayout } = await chrome();
      const item = getItem(params.name);
      if (!item) {
        const { notFoundPage } = await import('./pages/not-found.js');
        return SiteShell(notFoundPage(), {});
      }
      const { uiComponentPage } = await import('./pages/ui-component.js');
      const current = itemPath(item.name);
      return SiteShell(DocsLayout(uiComponentPage(item), { current }), { current });
    },
  }),

  themes: route('/themes', {
    metadata: {
      title: 'Themes — nisli',
      meta: {
        description:
          'The @nisli/ui token layer — semantic color tokens, chart colors, radius, and typography, in light and dark. Theming is editing CSS variables you own.',
      },
    },
    render: async () => {
      const { SiteShell } = await chrome();
      const { themesPage } = await import('./pages/themes.js');
      return SiteShell(themesPage(), { current: '/themes' });
    },
  }),

  docs: route('/docs', {
    metadata: {
      title: `${introDoc.title} — nisli docs`,
      meta: { description: introDoc.description },
    },
    render: async () => {
      const { SiteShell, DocsLayout } = await chrome();
      return SiteShell(DocsLayout(docArticle(introDoc.render()), { current: '/docs' }), { current: '/docs' });
    },
  }),

  docTopic: route('/docs/:topic', {
    entries: () => topicDocs.map((page) => ({ topic: page.slug })),
    metadata: ({ params }) => {
      const page = topicDocs.find((p) => p.slug === params.topic);
      return {
        title: page ? `${page.title} — nisli docs` : 'Not found — nisli docs',
        meta: { description: page?.description ?? '' },
      };
    },
    render: async ({ params }) => {
      const { SiteShell, DocsLayout } = await chrome();
      const page = topicDocs.find((p) => p.slug === params.topic);
      if (!page) {
        const { notFoundPage } = await import('./pages/not-found.js');
        return SiteShell(notFoundPage(), {});
      }
      const current = docPath(page.slug);
      return SiteShell(DocsLayout(docArticle(page.render()), { current }), { current });
    },
  }),

  notFound: notFound({
    metadata: { title: 'Not found — nisli', meta: { description: 'Page not found.' } },
    render: async () => {
      const { SiteShell } = await chrome();
      const { notFoundPage } = await import('./pages/not-found.js');
      return SiteShell(notFoundPage(), {});
    },
  }),
});
