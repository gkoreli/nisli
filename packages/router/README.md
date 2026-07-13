# @nisli/router

Typed application routing for Nisli. Define routes once and use the same route
catalog, URL matcher, query codecs, and page renderers in the browser, the Vite
development server, and static production builds.

## Install

```sh
npm add @nisli/router
```

Requires `@nisli/core@>=0.51.0` as a peer dependency. Releases publish through
the repository's trusted-publishing CI (`auto-tag.yml`).

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
| Back/forward (`popstate`) | Restores the remembered scroll position of the target history entry (the router sets `history.scrollRestoration = 'manual'`). | Preserves focus. |
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

## SEO metadata

Route `metadata` is a declarative, typed contract applied by the SSG shell at
build and by the browser service on navigation. `title` and `meta` are joined
by `property` (OpenGraph `<meta property>`), `canonical` (`<link
rel="canonical">`), and `alternates` (`<link rel="alternate" hreflang>`):

```ts
route('/:locale/posts/:slug', {
  params: { locale: enumParam(['en', 'ka']) },
  metadata: ({ params }) => ({
    title: `Post — ${params.locale}`,
    meta: { description: 'A localized post.' },
    property: { 'og:title': 'Post', 'og:type': 'article' },
    canonical: `https://example.com/${params.locale}/posts/${params.slug}`,
    alternates: [
      { hreflang: 'en', href: `https://example.com/en/posts/${params.slug}` },
      { hreflang: 'ka', href: `https://example.com/ka/posts/${params.slug}` },
    ],
  }),
});
```

The browser router *owns* the SEO tag types it manages — `title`,
`<meta name>`, `<meta property>`, `<link rel="canonical">`, `<link
rel="alternate">`, `<html lang>`/`<html dir>`, and keyed JSON-LD blocks. It
marks each element `data-nisli-managed` (adopting a matching server-rendered
tag rather than duplicating it), and on every navigation creates/updates the
desired set and **removes** the ones a later route omits, so a canonical or
`og:*` tag never lingers after a client navigation. `title`, `lang`, and `dir`
reconcile the same way, falling back to the value present when the router
connected. Head elements outside those types (charset, viewport, stylesheets,
unmanaged scripts) are never touched.

```ts
route('/:locale/business', {
  params: { locale: enumParam(['en', 'ka']) },
  metadata: ({ params }) => ({
    lang: params.locale,                 // <html lang="ka">
    canonical: `https://example.com/${params.locale}/business`,
    // Keyed JSON-LD: set/update/removed by key across navigations.
    jsonLd: {
      business: { '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Example' },
    },
  }),
});
```

Managed JSON-LD adopts a server-rendered `application/ld+json` block (whether
or not it is pre-tagged) rather than duplicating it, then keeps it in sync and
removes it when a later route drops the key. If a route render throws, the
router atomically resets all managed head state so the previous route's tags
cannot survive the error.

## Typed path segments

Path parameters may declare per-segment codecs (the same codecs used for
queries). An invalid segment is a matcher **no-match** — the URL falls through
to the next route or `notFound`, not a render-time error:

```ts
route('/:locale', {
  params: { locale: enumParam(['en', 'ka']) },
  render: ({ params }) => Page({ locale: params.locale }), // 'en' | 'ka'
});
// "/en" and "/ka" match; "/fr" does not — it falls to notFound.
```

`href()` re-serializes typed segments through the codec, so a `numberParam`
segment is constructed from a `number` and produces a string.

## Client-side redirects

`redirect()` declares a route that resolves to another href with replace
semantics — no history entry for the redirect source. The target is a fixed
string or a function of the matched params:

```ts
export const AppRouter = defineRouter({
  user: route('/users/:id', { render: async ({ params }) => UserPage(params) }),
  legacyUser: redirect('/u/:id', ({ params }) => `/users/${params.id}`),
  legacyHome: redirect('/start', '/'),
});
```

This is the client half only. Server 301s and canonical HTML belong in your
Worker/host; the router replaces the client history entry so back/forward does
not return to the redirecting URL.

## Active links (`aria-current`)

`Router.isActive(href, { exact? })` reads the reactive `url` signal, so it
re-evaluates in templates on each navigation:

```ts
const router = inject(Router);
html`<a href="/docs" aria-current="${router.isActive('/docs') ? 'page' : nothing}">Docs</a>`;
```

Pathname-prefix match by default; `{ exact: true }` and the root path `/`
require an exact match.

## Lossless URL state (counterpart-locale links, attribution)

`href()` accepts open-ended `search` and `hash` alongside the typed
`params`/`query`. Arbitrary query parameters — including ones not in the route's
query schema — are merged **under** the declared query (declared wins), and the
fragment is preserved. This is one builder for campaign-attribution passthrough
and for a language switcher that rebuilds the same page in the other locale
without dropping inquiry selection, attribution params, or the anchor:

```ts
const url = inject(Router).url.value; // current location

const counterpart = AppRouter.routes.page.href({
  params: { locale: 'ka' },     // swap the locale segment
  search: url.searchParams,     // preserve ?inquiry=…&utm_source=…
  hash: url.hash,               // preserve #section
});

html`<a href="${counterpart}" hreflang="ka">ქართული</a>`;
```

A declared `query` key set to its default value clears any carried-over copy,
so declared parameters stay canonical while undeclared ones pass through.

## Worker / edge usage (one catalog, no adapter)

The matcher, route builders, and query codecs are environment-neutral (they
import `@nisli/core` for *types only*). Import them from the side-effect-free
`@nisli/router/catalog` subpath and an edge Worker consumes the **same** authored
catalog the browser does — for HTTP status, redirect targets, and the initial
canonical/hreflang metadata — without ever loading the component runtime.

Author the catalog once. Route `render` callbacks must use dynamic `import()` so
the Worker (which matches and reads metadata but never calls `render`) never
pulls page/component chunks:

```ts
// routes.catalog.ts — shared, environment-neutral
import { route, redirect, notFound, enumParam } from '@nisli/router/catalog';

export const catalog = {
  home: route('/', { render: async () => (await import('./pages/home.js')).HomePage({}) }),
  about: route('/:locale/about', {
    params: { locale: enumParam(['en', 'ka']) },
    metadata: ({ params }) => ({ lang: params.locale, canonical: `https://x.dev/${params.locale}/about` }),
    render: async ({ params }) => (await import('./pages/about.js')).AboutPage(params),
  }),
  legacy: redirect('/old', '/'),
  notFound: notFound({ render: async () => (await import('./pages/nf.js')).NotFound({}) }),
};
```

```ts
// client.ts — browser
import { defineRouter } from '@nisli/router';
import { catalog } from './routes.catalog.js';
export const AppRouter = defineRouter(catalog);
```

```ts
// worker.ts — edge (no @nisli/core runtime in the bundle)
import { createMatcher, normalizePathname } from '@nisli/router/catalog';
import { catalog } from './routes.catalog.js';

const match = createMatcher(catalog); // same flat catalog, no adapter

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Canonicalization (e.g. trailing-slash / www) is a raw-path Worker concern,
    // done before matching; the client only ever generates canonical hrefs.
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = normalizePathname(url.pathname);
      return Response.redirect(url.toString(), 308);
    }

    const m = match(url);
    if (!m) return new Response('Not found', { status: 404 });
    if (m.redirect) return Response.redirect(new URL(m.redirect, url).toString(), 308);
    if (m.notFound) return new Response(shell(m.metadata), { status: 404, headers: html });
    return new Response(shell(m.metadata), { status: 200, headers: html }); // m.metadata.canonical, .alternates, …
  },
};
```

The router is HTTP-status-agnostic: client redirects use `replaceState`, and the
Worker chooses its own status (e.g. `308` for root/legacy/trailing/www). The
`@nisli/router/catalog` import graph is guarded to never reach the `@nisli/core`
runtime, so this stays true across refactors. `@nisli/core` remains a peer
dependency for *types*; `import type` is erased, so the Worker's runtime bundle
is core-free.

See [ADR 0026: Typed Application Router](https://github.com/gkoreli/nisli/blob/main/docs/adr/0026-typed-application-router.md)
for the architecture, shared browser/Vite/SSG contract, and scope.
