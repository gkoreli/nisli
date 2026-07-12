# @nisli/router

Typed application routing for Nisli. Define routes once and use the same route
catalog, URL matcher, query codecs, and page renderers in the browser, the Vite
development server, and static production builds.

## Install

```sh
npm install @nisli/core @nisli/router
```

## Define routes in 30 seconds

```ts
import { component, html } from '@nisli/core';
import { defineRouter, enumParam, route } from '@nisli/router';

export const AppRouter = defineRouter({
  home: route('/', { render: async () => HomePage({}) }),
  user: route('/users/:userId', {
    query: { tab: enumParam(['profile', 'activity']).default('profile') },
    render: async ({ params, query }) => UserPage({
      userId: params.userId,
      tab: query.tab,
    }),
  }),
});

const App = component('my-app', () => html`${AppRouter({})}`);
html`${App({})}`.mount(document.body);

const href = AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'activity' },
});

// Native anchors remain the default navigation API.
html`<a href="${href}">Activity</a>`;
```

`AppRouter({})` connects the generic injectable `Router` browser service and
renders the current route. Route matching itself is pure and
environment-neutral, leaving stable seams for `@nisli/router/vite` and Nisli's
SSG integration to consume the exact same application definition.

The package progressively enhances eligible same-origin anchors while
preserving native external, modifier-key, target, download, hash-only, and
opt-out navigation behavior.

See [ADR 0026: Typed Application Router](https://github.com/gkoreli/nisli/blob/main/docs/adr/0026-typed-application-router.md)
for the architecture, shared browser/Vite/SSG contract, and scope.
