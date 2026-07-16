import { html } from '@nisli/core';
import { defineRouter, notFound, route } from '@nisli/router';
import {
  buildStaticSite,
  type StaticApplicationRouter,
  type StaticRouterMetadata,
} from './index.js';

const fullMetadata: StaticRouterMetadata = {
  title: 'Home',
  meta: { description: 'Start' },
  property: { 'og:title': 'Home OG' },
  canonical: 'https://nisli.dev/',
  alternates: [{ hreflang: 'ka', href: 'https://nisli.dev/ka/' }],
  lang: 'en',
  dir: 'ltr',
  jsonLd: { page: { '@type': 'WebPage' } },
};
const metadataFields = [
  fullMetadata.title,
  fullMetadata.meta?.description,
  fullMetadata.property?.['og:title'],
  fullMetadata.canonical,
  fullMetadata.alternates?.[0]?.hreflang,
  fullMetadata.lang,
  fullMetadata.dir,
  fullMetadata.jsonLd?.page,
];
void metadataFields;

const AppRouter = defineRouter({
  home: route('/', {
    render: () => html`home`,
    metadata: fullMetadata,
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
