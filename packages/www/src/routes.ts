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

export interface SiteRoute {
  path: string;
  meta: ShellMeta;
  body: () => TemplateResult;
}

export const routes: readonly SiteRoute[] = [
  {
    path: '/',
    meta: {
      title: 'nisli — the reactive web-component framework',
      description:
        'nisli is a reactive web-component framework — signals, tagged-template components, no build step, no virtual DOM, DI. @nisli/ui is its batteries-included component library, copied into your project as source you own.',
    },
    body: () => layout(homePage(), { current: '/' }),
  },
];
