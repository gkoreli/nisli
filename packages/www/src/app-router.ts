/**
 * app-router.ts — the site's typed application router (ADR 0026).
 * ONE definition, interpreted identically by the browser (dev outlet), the
 * Vite dev server (nisliRoutes), and the static build (buildStaticSite). Routes
 * are typed and correct-by-construction: /ui/:name and /docs/:topic expand from
 * the same registry + docs sources the pages render from. Replaces the old
 * hand-rolled src/routes.ts table + per-environment matching.
 *
 * Renders use lazy dynamic import (ADR 0026 §8) so importing this module — e.g.
 * into vite.config.ts for nisliRoutes — does NOT eagerly evaluate the page and
 * @nisli/ui component modules (which call component()/HTMLElement at load and
 * would crash in a non-DOM Node context). Only the matcher + DOM-free route
 * data (registry, docs metadata) load eagerly.
 */
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
      const { layout } = await import('./layout.js');
      const { homePage } = await import('./pages/home.js');
      return layout(homePage(), { current: '/' });
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
      const { layout } = await import('./layout.js');
      const { uiIndexPage } = await import('./pages/ui-index.js');
      return layout(uiIndexPage(), { current: '/ui' });
    },
  }),

  uiItem: route('/ui/:name', {
    entries: () => allItems.map((item) => ({ name: item.name })),
    metadata: ({ params }) => itemMetadata(params.name),
    render: async ({ params }) => {
      const { layout } = await import('./layout.js');
      const { notFoundPage } = await import('./pages/not-found.js');
      const item = getItem(params.name);
      if (!item) return layout(notFoundPage(), {});
      const { uiComponentPage } = await import('./pages/ui-component.js');
      return layout(uiComponentPage(item), { current: itemPath(item.name) });
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
      const { layout } = await import('./layout.js');
      const { themesPage } = await import('./pages/themes.js');
      return layout(themesPage(), { current: '/themes' });
    },
  }),

  docs: route('/docs', {
    metadata: {
      title: `${introDoc.title} — nisli docs`,
      meta: { description: introDoc.description },
    },
    render: async () => {
      const { layout } = await import('./layout.js');
      const { docsLayout } = await import('./pages/docs.js');
      return layout(docsLayout(introDoc), { current: '/docs' });
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
      const { layout } = await import('./layout.js');
      const { notFoundPage } = await import('./pages/not-found.js');
      const page = topicDocs.find((p) => p.slug === params.topic);
      if (!page) return layout(notFoundPage(), {});
      const { docsLayout } = await import('./pages/docs.js');
      return layout(docsLayout(page), { current: docPath(page.slug) });
    },
  }),

  notFound: notFound({
    metadata: { title: 'Not found — nisli', meta: { description: 'Page not found.' } },
    render: async () => {
      const { layout } = await import('./layout.js');
      const { notFoundPage } = await import('./pages/not-found.js');
      return layout(notFoundPage(), {});
    },
  }),
});
