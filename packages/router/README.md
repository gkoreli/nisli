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
opt-out navigation behavior. Same-origin URLs outside the connected matcher
also remain native so server-owned documents and resources are not swallowed
by the SPA outlet.

## Scroll, focus, and history

Navigation effects run after the new route has rendered:

| Navigation | Scroll | Focus |
| --- | --- | --- |
| `router.navigate(href)` / intercepted link | Scrolls to the top by default; `{ scroll: 'preserve' }` keeps the current position. | Moves focus to the route outlet with `preventScroll` (unless the URL has a hash). |
| `router.replace(href)` | Preserves by default; `{ scroll: 'top' }` opts into scrolling to the top. | Preserves focus. |
| Back/forward (`popstate`) | Restores the remembered scroll position of the target history entry (the router sets `history.scrollRestoration = 'manual'`). | Preserves focus. |
| Any routed URL with a hash | After rendering, finds the decoded fragment ID and calls `scrollIntoView()`. | Preserves focus. |
| Same-document fragment (including a skip link) | The browser's own jump; the router only advances `url`. | The browser's — a `tabindex="-1"` target is focused natively, which is what makes a skip link work. |

The fourth row is the cross-page hash contract: a client-side navigation such
as `/docs#install` must wait for `/docs` to render, so the router emulates the
fragment jump with `scrollIntoView()`.

The fifth is not a transition at all. A fragment link whose pathname and query
already match is never intercepted — the browser performs its native jump and
creates its own history entry — but the router still tracks the URL that
results, so `url`, `isActive` and `aria-current` stay correct. That sync is
everything it does: no re-render, no metadata reapplication, no focus move, no
view transition. It covers adding, changing and removing a fragment, and
traversals across such an entry: back lands on the pre-fragment position,
forward re-scrolls the anchor. Both engines behave identically here.

Initial direct loads render in place. If the initial URL has a hash, the same
post-render fragment lookup is used; otherwise the router does not alter scroll
or focus. Under the History engine `navigate()` writes with
`history.pushState()`, `replace()` writes with `history.replaceState()`, and
`popstate` renders without creating another history entry. Under the Navigation
API engine the **browser** performs every scroll row above — restoring the
traversed-to offset, scrolling to the top, jumping to the fragment — and the
router applies none of them by hand. Focus is the router's under both engines:
it moves focus to the outlet host on a push without a hash, and on every other
navigation it makes sure the host is *not* left holding focus, so the main
landmark is never announced as if that reset had run.

`NavigateOptions.state` round-trips through the history entry; read it back with
`router.state()`:

```ts
await router.navigate('/users/42', { state: { source: 'user-menu' } });
router.state(); // { source: 'user-menu' }
```

Reading `history.state.state` directly is deprecated. The History engine wraps
`history.state` to carry its per-entry scroll key and the Navigation API engine
keeps state on the history entry instead; both are details of the browser
mechanics rather than part of the contract, and `router.state()` is the accessor
that stays correct under either.

## Navigation engine

The browser mechanics sit behind one internal seam with two implementations,
selected when the outlet connects:

```ts
const AppRouter = defineRouter(catalog, { engine: 'auto' }); // the default
```

| `engine` | Behavior |
| --- | --- |
| `'auto'` (default) | The Navigation API where the browser has it, the History API everywhere else. |
| `'history'` | Forces the History API engine (`popstate`, delegated clicks, `pushState`/`replaceState`) — the kill switch. |
| `'navigation'` | Forces the Navigation API engine, still falling back to History where the API is missing rather than leaving the app unrouted. |

The routing contract is identical either way: same matching, redirects, metadata,
`url`/`current`/`pending`/`error` signals, and outlet focus on push. What differs
is who performs the mechanics. With the Navigation API, `navigation.intercept()`
turns every same-origin navigation the matcher owns into a same-document
transition — including `location.href = '/somewhere'` from application or
third-party code, which is a full page load under the History engine — and the
browser owns scroll restoration, fragment jumps, and traversal semantics.

The same navigations stay native under both engines: cross-origin links,
downloads, modifier and middle clicks, `target` other than `_self`,
`data-router-ignore`, same-document fragment links, and same-origin URLs the
matcher does not own. A fragment link is the one of those the router still
observes: the navigation stays the browser's, and only `url` follows it.

## View Transitions

Animate navigations with the platform's View Transition API. Off by default —
opt in per application, and the router wraps **only the commit**:

```ts
const AppRouter = defineRouter(catalog, {
  viewTransitions: { enabled: true },
});
```

`enabled` may be a predicate instead, so a section can transition while the rest
of the application does not, and `types` chooses the transition types that
`:active-view-transition-type()` CSS keys off:

```ts
const AppRouter = defineRouter(catalog, {
  viewTransitions: {
    enabled: (nav) => nav.to.pathname.startsWith('/blog'),
    types: (nav) => [nav.direction, nav.kind],
  },
});
```

Both callbacks receive the navigation:

| `NavInfo` | Value |
| --- | --- |
| `from` / `to` | The URL being left and the destination. |
| `kind` | `'push'`, `'replace'`, or `'pop'` (back/forward). |
| `direction` | `'forward'`, `'back'`, or `'unknown'` — reported by the navigation engine (history-entry indices under the Navigation API, per-entry keys under the History API). |

`types` defaults to `[direction]`, so `:active-view-transition-type(back)` works
with no configuration; an undecidable direction contributes no type rather than
the meaningless `'unknown'`.

A single navigation can overrule the policy in either direction:

```ts
await router.navigate('/blog', { viewTransition: false });            // never
await router.navigate('/blog', { viewTransition: true });             // always
await router.navigate('/blog', { viewTransition: { types: ['zoom'] } });
```

What is wrapped is the commit — rendered output, managed head, and the
scroll/focus effects — so `document.title`, `<meta>`, and the DOM swap
atomically inside the snapshot. The awaited route render stays **outside**: a
slow loader delays the animation's start, it never freezes the page inside a
capture window. A navigation that lands while a transition is still animating
skips that transition rather than queueing behind it.

Three navigations never transition, whatever the policy says: the initial
render (there is no previous frame), a hash-only move (the browser is already
performing that jump), and a hidden document.

### Companion CSS (author-side, the router ships no stylesheet)

The root crossfade is the browser default and needs no CSS. Tune its duration,
and answer reduced motion, with:

```css
::view-transition-old(root),
::view-transition-new(root) { animation-duration: 200ms; }

/* Direction-scoped and purely additive: a browser without
   :active-view-transition-type() keeps the plain crossfade. */
@keyframes slide-from-right { from { translate: 100% 0; } }
@keyframes slide-to-left { to { translate: -100% 0; } }

html:active-view-transition-type(forward) {
  &::view-transition-old(root) { animation-name: slide-to-left; }
  &::view-transition-new(root) { animation-name: slide-from-right; }
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

Reduced motion is answered in CSS, not JS: the transition still runs, so the
swap stays atomic and type-scoped styles stay active — only the motion is
neutralised.

Where `document.startViewTransition` is missing the commit applies directly,
synchronously flushed and unanimated, and the router behaves exactly as it does
with the option off. No polyfill, no UA sniffing, nothing to remove later.

## Accessibility: the main landmark

The outlet is the application's `<main>` landmark: the host element carries
`role="main"`, `tabindex="-1"`, and `display: block`. It is one element doing
three jobs — the landmark, the focus target of a push navigation, and the
skip-link target — and it has to generate a box to do any of them, because a
box-less element can neither hold focus nor be scrolled to.

Give it a stable `id` and/or `aria-*` via `defineRouter`'s `outletAttrs` — for a
skip link or a labelled main region:

```ts
const AppRouter = defineRouter(catalog, {
  outletAttrs: { id: 'main-content', 'aria-label': 'Main content' },
});

// html`<a href="#main-content" class="skip-link">Skip to content</a>`
```

The skip link needs nothing else: the fragment jump scrolls the host into view
and focuses it (that is what `tabindex="-1"` is for), and the router treats the
jump as a fragment-only change — `url` advances, the page does not re-render.

Only `id` and `aria-*` are accepted (a type error otherwise); the managed
`role`/`tabindex`/`display` are applied last and cannot be overridden.

Because the host is a box, **it** is the flex/grid item inside your shell, not
the route content. Lay the route out inside the route, or style the host through
the `id` you gave it.

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
cannot survive the error. An explicit navigation that produces a true no-match
applies the same reset.

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

Author the identity once (render-less), then bind render targets on the client.
This keeps a strict `shared` package free of any client reference — `render` is
optional, so the catalog carries only paths, codecs, and metadata:

```ts
// routes.catalog.ts — shared, environment-neutral (no client import)
import { route, redirect, notFound, enumParam } from '@nisli/router/catalog';

export const catalog = {
  home: route('/', { metadata: { title: 'Home' } }),
  about: route('/:locale/about', {
    params: { locale: enumParam(['en', 'ka']) },
    metadata: ({ params }) => ({ lang: params.locale, canonical: `https://x.dev/${params.locale}/about` }),
  }),
  legacy: redirect('/old', '/'),
  notFound: notFound({ metadata: { title: 'Not found' } }),
};
```

```ts
// client.ts — browser: bind render targets (keyed, compile-time exhaustive)
import { defineRouter, bindRenders } from '@nisli/router';
import { catalog } from './routes.catalog.js';

export const AppRouter = defineRouter(bindRenders(catalog, {
  home:  () => import('./pages/home.js').then((m) => m.HomePage({})),
  about: ({ params }) => import('./pages/about.js').then((m) => m.AboutPage(params)),
  notFound: () => import('./pages/nf.js').then((m) => m.NotFound({})),
}));
```

`bindRenders` is exhaustive: a missing or extra route name is a type error, and
each renderer's `params`/`query` carry their codec types. Route `render` may also
be authored inline (single-package apps) — `bindRenders` is for the strict
`client`/`server`/`shared` split where render targets must stay out of `shared`.

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
