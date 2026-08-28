/**
 * One typed route catalog for the browser, the Vite dev server and the static
 * build. Renders are LAZY dynamic imports (ADR 0026 §8): this module is loaded
 * by `vite.config.ts` in Node, where `component()` cannot run because there is
 * no `HTMLElement`, so nothing page-shaped may be evaluated at import time.
 */

import { html, type TemplateResult } from '@nisli/core';
import { defineRouter, route } from '@nisli/router';

export const AppRouter = defineRouter({
  recipes: route('/', {
    render: async (): Promise<TemplateResult> => {
      const { RecipesPage } = await import('./pages/recipes.js');
      return html`${RecipesPage({})}`;
    },
  }),
  recipe: route('/recipes/:id', {
    render: async ({ params }): Promise<TemplateResult> => {
      const { RecipePage } = await import('./pages/recipe.js');
      return html`${RecipePage({ id: params.id })}`;
    },
  }),
  cook: route('/recipes/:id/cook', {
    render: async ({ params }): Promise<TemplateResult> => {
      const { CookPage } = await import('./pages/cook.js');
      return html`${CookPage({ id: params.id })}`;
    },
  }),
  shopping: route('/shopping', {
    render: async (): Promise<TemplateResult> => {
      const { ShoppingPage } = await import('./pages/shopping.js');
      return html`${ShoppingPage({})}`;
    },
  }),
});

export const hrefs = {
  recipes: () => AppRouter.routes.recipes.href({}),
  recipe: (id: string) => AppRouter.routes.recipe.href({ params: { id } }),
  cook: (id: string) => AppRouter.routes.cook.href({ params: { id } }),
  shopping: () => AppRouter.routes.shopping.href({}),
};
