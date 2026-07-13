import { defineRouter, enumParam, numberParam, optional, redirect, route, stringParam } from './index.js';
import { html } from '@nisli/core';

// Path-parameter codecs refine params to their codec type and re-serialize them.
const localized = route('/:locale/posts/:id', {
  params: { locale: enumParam(['en', 'ka'] as const), id: numberParam() },
  render: ({ params }) => {
    const locale: 'en' | 'ka' = params.locale;
    const id: number = params.id;
    void locale;
    void id;
    return html``;
  },
});
localized.href({ params: { locale: 'en', id: 42 } });
// @ts-expect-error path codec rejects an out-of-enum locale
localized.href({ params: { locale: 'fr', id: 42 } });
// @ts-expect-error numberParam path segment expects a number, not a string
localized.href({ params: { locale: 'en', id: '42' } });

// Lossless URL state: arbitrary search (URLSearchParams | record | string) + hash
// compose with typed params/query.
localized.href({ params: { locale: 'ka', id: 1 }, search: new URLSearchParams('utm=x'), hash: '#a' });
localized.href({ params: { locale: 'ka', id: 1 }, search: { utm: 'x' }, hash: 'a' });
localized.href({ params: { locale: 'ka', id: 1 }, search: 'utm=x' });

const user = route('/users/:userId', {
  query: {
    tab: enumParam(['profile', 'activity'] as const),
    filter: optional(stringParam()),
  },
  render: () => html``,
});

user.href({ params: { userId: '42' }, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error missing path parameter
user.href({ params: {}, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error wrong path parameter name
user.href({ params: { id: '42' }, query: { tab: 'profile', filter: undefined } });
// @ts-expect-error invalid enum query value
user.href({ params: { userId: '42' }, query: { tab: 'settings', filter: undefined } });
// @ts-expect-error missing required query properties
user.href({ params: { userId: '42' }, query: { tab: 'profile' } });

const AppRouter = defineRouter({
  home: route('/', { render: () => html`` }),
  user: route('/users/:userId', { render: () => html`` }),
  files: route('/files/*path', { render: () => html`` }),
  settings: route('/settings', {
    query: { tab: enumParam(['profile', 'security'] as const) },
    render: () => html``,
  }),
});

AppRouter.routes.home.href();
AppRouter.routes.user.href({ params: { userId: '42' } });
AppRouter.routes.files.href({ params: { path: 'docs/start' } });
AppRouter.routes.settings.href({ query: { tab: 'security' } });

// @ts-expect-error catalog route requires params.userId
AppRouter.routes.user.href();
// @ts-expect-error catalog route rejects the wrong param name
AppRouter.routes.user.href({ params: { id: '42' } });
// @ts-expect-error catalog catch-all requires params.path
AppRouter.routes.files.href({ params: {} });
// @ts-expect-error catalog query values retain their literal union
AppRouter.routes.settings.href({ query: { tab: 'billing' } });

// @ts-expect-error router catalogs accept route definitions, not arbitrary values
defineRouter({ invalid: 'not-a-route' });

// Redirects are valid router entries but are not exposed as href-able routes.
const WithRedirect = defineRouter({
  home: route('/', { render: () => html`` }),
  user: route('/users/:userId', { render: () => html`` }),
  legacyUser: redirect('/u/:userId', ({ params }) => `/users/${params.userId}`),
  legacyHome: redirect('/start', '/'),
});
WithRedirect.routes.user.href({ params: { userId: '42' } });
// @ts-expect-error redirects are not part of the typed href catalog
WithRedirect.routes.legacyUser;
