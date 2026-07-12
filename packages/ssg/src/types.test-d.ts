import { html } from '@nisli/core';
import { defineRouter, notFound, route } from '@nisli/router';
import { buildStaticSite, type StaticApplicationRouter } from './index.js';

const AppRouter = defineRouter({
  home: route('/', {
    render: () => html`home`,
    metadata: { title: 'Home' },
  }),
  component: route('/ui/:name', {
    entries: () => [{ name: 'button' }, { name: 'dialog' }],
    render: ({ params }) => {
      const name: string = params.name;
      return html`${name}`;
    },
    metadata: ({ params }) => ({ title: params.name }),
  }),
  notFound: notFound({
    render: ({ url }) => html`${url.pathname}`,
    metadata: ({ url }) => ({ title: `Missing ${url.pathname}` }),
  }),
});

const structuralRouter: StaticApplicationRouter = AppRouter;
void structuralRouter;
void buildStaticSite({ outDir: 'dist', router: AppRouter });

// @ts-expect-error precise route params remain required through the catalog
AppRouter.routes.component.href({ params: {} });
