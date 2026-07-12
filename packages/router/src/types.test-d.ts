import { defineRouter, enumParam, optional, route, stringParam } from './index.js';
import { html } from '@nisli/core';

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
