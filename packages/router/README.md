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

const HomePage = component('home-page', () => html`<h1>Home</h1>`);
const UserPage = component<{ userId: string; tab: 'profile' | 'activity' }>(
  'user-page',
  (props) => html`
    <h1>User ${props.userId.value}</h1>
    <p>${props.tab.value}</p>
  `,
);

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

`AppRouter({})` connects the injectable `Router` browser service and renders
the current route. Defining `AppRouter` is lazy and DOM-free; the outlet
registers on the first `AppRouter({})` call, so Vite and SSG can consume the
same route catalog without an extra `provideRouter` step. Route matching itself
is pure and environment-neutral, and the literal path drives `href()` inference
without extra generics.

## Vite direct routes

The dev-only route fallback matches HTML requests with the application router
before returning Vite's transformed shell. It composes with core HMR and does
not add a second transform or hot-update protocol.

```ts
import { defineConfig } from 'vite';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { nisliRoutes } from '@nisli/router/vite';
import { AppRouter } from './src/app-router.js';

export default defineConfig({
  plugins: [nisliHmr(), nisliRoutes(AppRouter)],
});
```

Static builds pass the same `AppRouter` to `buildStaticSite({ router })` from
`@nisli/ssg`; dynamic routes expand their typed `entries()` through the same
`href()` and matcher used by browser and Vite navigation.

The package progressively enhances eligible same-origin anchors while
preserving native external, modifier-key, target, download, hash-only, and
opt-out navigation behavior.

See [ADR 0026: Typed Application Router](https://github.com/gkoreli/nisli/blob/main/docs/adr/0026-typed-application-router.md)
for the architecture, shared browser/Vite/SSG contract, and scope.
