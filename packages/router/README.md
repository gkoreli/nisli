# @nisli/router

Typed application routing for Nisli. Define routes once and use the same route
catalog, URL matcher, query codecs, and page renderers in the browser, the Vite
development server, and static production builds.

## Install

Publication of `@nisli/router@0.1.0` is pending npm Trusted Publisher setup.
Until `npm view @nisli/router version` succeeds, consume it only from this
workspace; do not rely on the registry install path.

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

## Scroll, focus, and history

Navigation effects run after the new route has rendered:

| Navigation | Scroll | Focus |
| --- | --- | --- |
| `router.navigate(href)` / intercepted link | Scrolls to the top by default; `{ scroll: 'preserve' }` keeps the current position. | Moves focus to the route outlet with `preventScroll` (unless the URL has a hash). |
| `router.replace(href)` | Preserves by default; `{ scroll: 'top' }` opts into scrolling to the top. | Preserves focus. |
| Back/forward (`popstate`) | Leaves restoration to the browser. | Preserves focus. |
| Any routed URL with a hash | After rendering, finds the decoded fragment ID and calls `scrollIntoView()`. | Preserves focus. |

That last row is the cross-page hash contract: a client-side navigation such
as `/docs#install` must wait for `/docs` to render, so the router emulates the
fragment jump with `scrollIntoView()`. A same-document hash link is not
intercepted at all when its pathname and query already match; the browser keeps
its native fragment navigation and history behavior.

Initial direct loads render in place. If the initial URL has a hash, the same
post-render fragment lookup is used; otherwise the router does not alter scroll
or focus. `navigate()` writes with `history.pushState()`, `replace()` writes
with `history.replaceState()`, and `popstate` renders without creating another
history entry.

See [ADR 0026: Typed Application Router](https://github.com/gkoreli/nisli/blob/main/docs/adr/0026-typed-application-router.md)
for the architecture, shared browser/Vite/SSG contract, and scope.
