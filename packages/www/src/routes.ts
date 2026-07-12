/**
 * routes.ts — the site's route table.
 * One entry per page: its path, document metadata, and a `body()` that returns
 * the page wrapped in the site chrome (nav + main + footer). build.ts renders
 * each body fragment through @nisli/ssg and wraps it in the HTML shell.
 * Add pages here — the pipeline maps over this list, no per-route wiring.
 */
import { type TemplateResult } from '@nisli/core';
import type { ShellMeta } from './shell.js';
import { layout } from './layout.js';
import { homePage } from './pages/home.js';
import { uiIndexPage } from './pages/ui-index.js';
import { uiComponentPage } from './pages/ui-component.js';
import { components, primitives, itemPath, type RegistryItem } from './registry.js';
import { docPages, docPath, docsLayout, type DocPage } from './pages/docs.js';
import { themesPage } from './pages/themes.js';

export interface SiteRoute {
  path: string;
  meta: ShellMeta;
  body: () => TemplateResult;
}

const staticRoutes: readonly SiteRoute[] = [
  {
    path: '/',
    meta: {
      title: 'nisli — the reactive web-component framework',
      description:
        'nisli is a reactive web-component framework — signals, tagged-template components, no build step, no virtual DOM, DI. @nisli/ui is its batteries-included component library, copied into your project as source you own.',
    },
    body: () => layout(homePage(), { current: '/' }),
  },
  {
    path: '/ui',
    meta: {
      title: 'Components — nisli',
      description:
        'The @nisli/ui component gallery — shadcn-style components you copy into your project and own, installed with npx @nisli/ui add <name>.',
    },
    body: () => layout(uiIndexPage(), { current: '/ui' }),
  },
  {
    path: '/themes',
    meta: {
      title: 'Themes — nisli',
      description:
        'The @nisli/ui token layer — semantic color tokens, chart colors, radius, and typography, in light and dark. Theming is editing CSS variables you own.',
    },
    body: () => layout(themesPage(), { current: '/themes' }),
  },
];

/** One /ui/<name> route per registry item — enumerated, never hand-listed. */
function itemRoute(item: RegistryItem): SiteRoute {
  const kind = item.type === 'lib' ? 'primitive' : 'component';
  return {
    path: itemPath(item.name),
    meta: {
      title: `${item.name} — nisli/ui`,
      description: item.description ?? `The ${item.name} ${kind} from @nisli/ui.`,
    },
    body: () => layout(uiComponentPage(item), { current: itemPath(item.name) }),
  };
}

/** One route per docs page, wrapped in the docs sidebar layout. */
function docRoute(page: DocPage): SiteRoute {
  const path = docPath(page.slug);
  return {
    path,
    meta: { title: `${page.title} — nisli docs`, description: page.description },
    body: () => layout(docsLayout(page), { current: path }),
  };
}

export const routes: readonly SiteRoute[] = [
  ...staticRoutes,
  ...docPages.map(docRoute),
  ...components.map(itemRoute),
  ...primitives.map(itemRoute),
];
