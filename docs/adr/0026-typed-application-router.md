# 0026. Typed Application Router — Shared Browser, Vite, and SSG Routes

**Date**: 2026-07-11
**Status**: Accepted (with arch amendments below)
**Depends on**: [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0020.2-ssg-blog-adoption-and-publication-primitives](./0020.2-ssg-blog-adoption-and-publication-primitives.md), [0024-showcase-site](./0024-showcase-site.md)

## Context

Nisli has route-shaped behavior but no router.

- `@nisli/core` has no URL matcher, location signal, History API service, or
  route outlet.
- `@nisli/ssg` accepts an already-expanded array of static paths and writes
  them to `dist/<path>/index.html`. It intentionally rejects unexpanded paths
  such as `/posts/:slug`.
- Goga's blog generates one static page per slug, navigates with native
  anchors, and contains a custom clean-URL resolver in its development server.
  Individual features independently use `URLSearchParams`, `pushState`, and
  `popstate` when they need reactive URL state.
- `packages/www` declares production paths in `src/routes.ts`, but its Vite
  entry initially mounted `homePage()` for every pathname. Consequently
  `/ui` rendered correctly after a production SSG build but showed the home
  page under Vite. `/docs` returned 404 in production because no `/docs` route
  had been declared or emitted.

These are not HMR or hosting defects. They are evidence that development,
browser navigation, and static generation do not yet share one routing
contract. Without a first-party pattern, each Nisli application will invent
its own matcher, URL construction, query parsing, history listeners, dev
fallback, and SSG expansion.

Routing is important, but Nisli does not need to reproduce React Router's
framework-scale surface. The initial requirement is deliberately smaller:
typed URL construction, deterministic matching, browser history, a reactive
outlet, 404 handling, and identical route interpretation in Vite and SSG.

## Decision

### 1. Routing is an optional first-party package

Introduce `@nisli/router` rather than adding routing to `@nisli/core`.

- `@nisli/core` remains the minimal component/reactivity/browser runtime.
- `@nisli/router` owns route contracts, matching, browser history, and the
  route outlet.
- `@nisli/router/vite` adapts the same application router to the development
  server.
- `@nisli/ssg` consumes the same application router for static expansion and
  rendering.

Routing is optional for component libraries and single-page widgets, but it
is official and maintained in the Nisli monorepo rather than left to every
application.

### 2. One application definition is shared everywhere

The central invariant is:

> A route is defined once and interpreted identically by browser navigation,
> the Vite development server, and static production builds.

Path normalization, parameter decoding, query parsing, route priority, and
not-found behavior must come from one matcher. Environment adapters may choose
how to render or emit the match; they may not implement independent matching
rules.

```ts
// Browser
mount(AppRouter({}));

// Vite
nisliRoutes(AppRouter);

// Static production
buildStaticSite({ router: AppRouter });
```

Tests must assert that representative URLs produce equivalent matches in all
three environments.

### 3. `AppRouter` and the `Router` service are separate concepts

`defineRouter()` returns an application-specific, strongly typed router
component and route catalog:

```ts
export const AppRouter = defineRouter({
  home: route('/', {
    render: async () => {
      const { HomePage } = await import('./pages/home.js');
      return HomePage({});
    },
  }),

  user: route('/users/:userId', {
    query: {
      tab: enumParam(['profile', 'activity']).default('profile'),
    },
    render: async ({ params, query }) => {
      const { UserPage } = await import('./pages/user.js');
      return UserPage({
        userId: params.userId,
        tab: query.tab,
      });
    },
  }),
});
```

`AppRouter` is responsible for application-specific knowledge:

- the allowed paths;
- inferred path parameters;
- query parameter codecs;
- page rendering callbacks;
- static parameter entries;
- page metadata;
- the rendered route outlet.

`Router` is a generic injectable service:

```ts
const router = inject(Router);

router.navigate(href);
router.replace(href);
router.back();
router.forward();
```

It is responsible for browser mechanics and reactive location state:

```ts
router.url;      // ReadonlySignal<URL>
router.current;  // ReadonlySignal<RouteMatch | null>
router.pending;  // ReadonlySignal<boolean>
router.error;    // ReadonlySignal<unknown | null>
```

This separation lets reusable components depend only on generic navigation
while applications retain a strongly typed route catalog.

### 4. `AppRouter` is rendered through Nisli factory composition

The application mounts its outlet like any other Nisli component:

```ts
export const App = component('my-app', () => html`
  <header>...</header>
  ${AppRouter({})}
  <footer>...</footer>
`);
```

The generated router host is light-DOM and layout-transparent. During setup it
injects the root `Router` service, connects the `AppRouter` definition, and
renders the current match reactively. The initial version permits one root
application router/outlet. Nested and scoped routers are deferred.

The service may exist before the outlet mounts, but connecting two root
application definitions to one service is an error.

### 5. Route objects construct strongly typed `href` strings

Each route in `AppRouter.routes` is a typed object. Literal path parameters are
derived with TypeScript template-literal types:

```ts
AppRouter.routes.home.href();
// "/"

AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'activity' },
});
// "/users/42?tab=activity"
```

Invalid construction fails at compile time:

```ts
AppRouter.routes.user.href();
// error: params.userId is required

AppRouter.routes.user.href({
  params: { id: '42' },
});
// error: expected userId
```

The initial public API has one destination representation: an `href` string.
The previously considered `to()`/structured-destination API is deferred as
unnecessary duplication. Typed construction happens at `href()`; the generic
service may parse the resulting URL when navigating.

### 6. Native anchors are the default navigation API

Nisli remains platform-first:

```ts
const href = AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'profile' },
});

return html`<a href="${href}">User</a>`;
```

There is no required `RouterLink` component in v1. The browser router
progressively enhances eligible same-origin anchor clicks. It must preserve
native behavior for:

- external origins;
- modifier keys;
- non-left clicks;
- `target` and `download`;
- hashes;
- links explicitly opting out of interception.

Without JavaScript, links still perform normal multi-page navigation to SSG
output.

Programmatic navigation uses the same string:

```ts
inject(Router).navigate(
  AppRouter.routes.user.href({
    params: { userId: '42' },
    query: { tab: 'activity' },
  }),
);
```

### 7. Query parameters are typed by runtime codecs

Path parameter names can be inferred from literal strings. Query parameter
types cannot: every URL query value begins as text or absence. Routes may
therefore declare small dependency-free codecs:

```ts
query: {
  tab: enumParam(['profile', 'activity']).default('profile'),
  page: numberParam().default(1),
  filter: optional(stringParam()),
  compact: booleanParam().default(false),
}
```

The codec contract is conceptually:

```ts
interface QueryCodec<T> {
  parse(value: string | null): T;
  serialize(value: T): string | undefined;
}
```

The same codecs typecheck URL generation and validate untrusted incoming URLs.
The route render context also exposes the original `URLSearchParams` for
unstructured or repeated values.

### 8. Page association is consolidated, but loading breaks eager cycles

Route address and rendering configuration are authored together. Page modules
export ordinary typed Nisli factories rather than router-aware components:

```ts
// pages/user.ts
export type UserPageProps = {
  userId: string;
  tab: 'profile' | 'activity';
};

export const UserPage = component<UserPageProps>('page-user', (props) =>
  html`<main>...</main>`,
);
```

The route's typed async `render` callback performs the adaptation:

```ts
render: async ({ params, query }) => {
  const { UserPage } = await import('./pages/user.js');
  return UserPage({
    userId: params.userId,
    tab: query.tab,
  });
},
```

This avoids an eager ESM cycle between the application router and page module,
gives Vite a code-splitting/HMR boundary, lets SSG await the same module, and
typechecks both the route context and page props without generated route-local
types.

Reusable components should inject `Router`, not `AppRouter`. Application
components may import `AppRouter.routes.*` when they need known typed URLs; if
that creates an undesirable dependency direction, the parent should pass the
constructed `href` as a prop.

### 9. Browser routing is signal-backed progressive enhancement

The browser service owns one `popstate` listener and one delegated anchor-click
listener. Navigation:

1. resolves an `href` against the current/base URL;
2. matches it through the `AppRouter` definition;
3. calls `history.pushState()` or `replaceState()`;
4. updates the URL/match signals;
5. awaits the page renderer;
6. updates only the route outlet;
7. applies title/meta, focus, hash, and scroll behavior.

Back/forward navigation follows the same match/render path without writing a
new history entry. Stale asynchronous renders must be discarded with a
generation guard, like `query()`.

Navigation options are attached to the service operation rather than encoded
in a second destination type:

```ts
router.navigate(href, {
  replace: false,
  state: { source: 'user-menu' },
  scroll: 'top',
});
```

### 10. Vite matches the application definition, not `index.html`

`@nisli/router/vite` receives `AppRouter`:

```ts
export default defineConfig({
  plugins: [
    nisliHmr(),
    nisliRoutes(AppRouter),
  ],
});
```

A direct request for `/ui/button?tab=code` must match and render the same route
as browser navigation and production SSG. Vite must not blindly return a home
entry whose bootstrap ignores `location.pathname`.

HMR remains owned by `@nisli/core/vite-hmr`. The route adapter composes with
that plugin; it does not implement a second component-HMR protocol.

### 11. SSG expands dynamic route entries from the same definition

Dynamic routes declare static parameter entries:

```ts
component: route('/ui/:name', {
  entries: () => registry.items.map(({ name }) => ({ name })),
  render: ...,
}),
```

`entries()` is checked against the inferred path parameters. During a static
build:

```text
/ui/:name + { name: "button" }
  -> /ui/button
  -> dist/ui/button/index.html
```

An unexpanded dynamic route remains a build error. Static routes need no
entries function. Browser-only dynamic values may exist, but they cannot be
promised as generated files without entries or a host fallback.

### 12. Route matching is deterministic and environment-neutral

The pure matcher must support in v1:

- exact static segments;
- required named parameters (`:id`);
- a catch-all parameter;
- percent encoding/decoding;
- base paths;
- normalized leading/trailing slashes;
- query and hash preservation;
- deterministic specificity;
- duplicate/ambiguous route detection;
- explicit not-found handling.

The matcher must not depend on `window`. A small internal matcher is preferred
over requiring `URLPattern` or a polyfill until browser support and semantics
fit Nisli's compatibility target.

## Proposed API Summary

```ts
// Route definition
defineRouter()
route()
notFound()

// Query codecs
stringParam()
numberParam()
booleanParam()
enumParam()
optional()

// Generic browser service
Router

// Vite adapter
nisliRoutes()

// SSG integration
buildStaticSite({ router: AppRouter })
```

Representative application usage:

```ts
export const AppRouter = defineRouter({
  home: route('/', { render: async () => ... }),
  user: route('/users/:userId', { query: ..., render: async (ctx) => ... }),
});

html`${AppRouter({})}`;

const href = AppRouter.routes.user.href({
  params: { userId: '42' },
  query: { tab: 'profile' },
});

html`<a href="${href}">User</a>`;
inject(Router).navigate(href);
```

## V1 Scope

Included:

- typed route objects and `href()` generation;
- static, named-parameter, and catch-all matching;
- typed query codecs;
- generic injectable `Router` service;
- one root `AppRouter` outlet;
- History API and native anchor enhancement;
- reactive URL/current/pending/error state;
- not-found rendering;
- page metadata;
- typed SSG `entries()` expansion;
- one matcher shared by browser, Vite, and SSG.

Deferred:

- loaders/actions and mutation protocols;
- navigation guards and middleware;
- filesystem route generation;
- nested/scoped routers and nested route outlets;
- route-level layouts as a special router primitive (ordinary Nisli
  composition remains sufficient initially);
- structured `to()` destinations;
- animated route transitions;
- SSR streaming;
- parallel/intercepting routes;
- generated route-local `$types` files.

## Consequences

### Positive

- Vite, browser navigation, and production can no longer silently disagree on
  what a URL means.
- Applications get strongly typed path/query construction and page props.
- Native anchors, refreshes, static hosting, and no-JavaScript behavior remain
  first-class.
- Reusable components depend on a small generic service rather than an
  application route catalog.
- The route definition becomes a natural lazy-import and HMR boundary.
- `@nisli/core` stays small.

### Costs and risks

- A hybrid value that is both a component factory and application route
  definition is unusual and requires careful TypeScript/API design.
- Async page renderers require pending state and stale-result protection.
- Route modules that import `AppRouter` at runtime may recreate a conceptual
  dynamic dependency cycle; type-only imports or parent-supplied hrefs are
  preferable.
- Client-side navigation can diverge from native browser behavior unless click,
  focus, history, hash, and scroll semantics are tested comprehensively.
- Static hosts still require emitted files or a configured fallback for every
  directly visited URL.

## Alternatives Considered

### Put routing in `@nisli/core`

Rejected because component libraries and embedded widgets do not need it, and
core's minimal-runtime boundary should remain intact.

### Leave routing entirely to applications

Rejected because the blog and `www` already independently hand-roll route
output, clean URLs, query state, and development behavior. The Vite/production
disagreement demonstrates recurring framework-level risk.

### React-style `<Routes><Route>` component declarations

Rejected because route configuration is data/build input, not visual DOM.
Nisli pages should remain ordinary factories, and navigation should remain
native anchors.

### Separate address definitions and renderer bindings everywhere

Architecturally clean but rejected as the primary authoring API because it
forces duplicate-looking declarations. Consolidated route records with dynamic
page imports retain a single authoring location while avoiding eager cycles.

### Filesystem routing in v1

Deferred. It can generate the same `AppRouter` definition later, but the
explicit API must be proven first and must continue working without Vite or a
prescribed directory layout.

### Copy Angular, Vue Router, React Router, or Lit Labs Router wholesale

Rejected. Nisli borrows the useful ideas—official optional router package,
route records, outlet, history service, typed parameters, and shared build
contract—without adopting framework-scale loaders/actions/guards or coupling
routing to a class-component lifecycle.

## Open Questions Before Acceptance

1. Can `defineRouter()` cleanly return a value usable both as a Nisli factory
   (`AppRouter({})`) and as static route metadata without special-casing the
   existing `component()` type?
2. Should connecting `AppRouter({})` provide/configure the global `Router`, or
   should bootstrap explicitly call `provideRouter(AppRouter)` first?
3. What exact query option name should be public: `query`, `search`, or
   `queryParams`? Internally the platform representation remains
   `URLSearchParams`.
4. Should page `render` callbacks own their dynamic imports, or should a formal
   `load()` module contract be introduced after generated route types exist?
5. What are the v1 scroll/focus defaults for push, replace, popstate, and hash
   navigation?
6. Should unmatched programmatic navigation fall back to native full-page
   navigation or render the configured not-found route client-side?
7. How should page metadata be represented so static shell output and live
   browser updates share one typed contract?

## Arch Review Resolutions (accepted with these amendments)

Answers to the open questions, binding for ROUTER-1:

1. **Hybrid value**: attempt the dual factory/catalog value; if TypeScript
   fights it, the sanctioned fallback is `AppRouter.Outlet({})` as the
   component with `AppRouter` as a plain catalog — do not contort types.
2. **Bootstrap**: rendering `AppRouter({})` connects and configures the
   global `Router` implicitly; a second root connection is a clear error.
   No separate `provideRouter()` in v1.
3. **Option name**: `query`.
4. **Loading**: `render` callbacks own their dynamic imports in v1; no
   `load()` contract yet.
5. **Scroll/focus defaults**: push → scroll to top + move focus to the
   outlet container (`tabindex="-1"`); replace → preserve scroll; popstate →
   browser-native restoration; hash → native jump. Document all four.
6. **Unmatched programmatic navigation**: render the configured `notFound`
   client-side. Additionally, SSG emits the notFound route as `404.html`
   (Cloudflare/static-host convention).
7. **Metadata**: `{ title, meta: Record<string, string> }` — one typed
   contract applied by the SSG shell at build and by the browser service on
   navigation.
8. **Catch-all syntax**: `*name` only in v1 — no `:name*` alias; dual
   syntaxes create ambiguity with zero existing consumers.

## Validation Plan

Before acceptance:

1. Implement the pure path compiler, matcher, query codecs, and `href()` tests.
2. Prove TypeScript failures for missing, extra, and incorrectly typed params
   and queries.
3. Implement `Router` history/popstate/click behavior under happy-dom.
4. Implement a single transparent `AppRouter` outlet with async-generation
   guards and cleanup.
5. Adapt `packages/www` so `/`, `/ui`, `/ui/button`, and a real `/docs` route
   share the same `AppRouter` in Vite and SSG.
6. Assert equivalent match/context results for browser, Vite, and SSG.
7. Verify direct loads, native anchor fallback, back/forward, query updates,
   404s, refreshes, and HMR.
8. Evaluate migrating one blog route family after `www` proves the API.

## Implementation Audit Amendments (2026-07-11)

### Publication status (RTR-1)

`@nisli/router@0.1.0` is implemented but not published. The checkpoint push
`d70eaee` triggered `auto-tag.yml` run `29182902272`; its router matrix job used
the correct identity (`@nisli/router`), directory (`packages/router`), and tag
prefix (`router`). The publishability check, install, full build, full test,
npm upgrade, tag creation, and GitHub release creation all passed. Only
`npm publish` failed, after packaging, and npm still returns `E404` for
`@nisli/router@0.1.0`.

The repository-side workflow is therefore correct. The remaining blocker is
the npm Trusted Publisher identity/configuration for the router package, which
is administered outside this repository. The failed `router-v0.1.0` release
and tag have been removed, so the same version can be retried after that
configuration is corrected. Until npm confirms the version, documentation
must not claim that `@nisli/router` is installable from the registry.

### Blog adoption evaluation (RTR-2)

Ruling: **do not migrate a blog route family yet**. The first candidate would
be the post family (`/:slug`) together with its companion prompt pages
(`/:slug/prompts`), because both are already expanded from discovered post
metadata and written as clean-URL `index.html` files. That family would exercise
typed parameters and `entries()` honestly rather than adding a router around a
fixed page.

Two prerequisites make migration now premature:

1. The blog depends on `@nisli/core@^0.47.4`, while `@nisli/router@0.1.0`
   requires core `>=0.51.0`. A route experiment would therefore also be a
   multi-version framework migration, obscuring whether failures came from the
   router or the core upgrade.
2. The blog has a specialized static pipeline, not Vite or `@nisli/ssg`: it
   discovers Markdown/TypeScript posts, renders page shells, generates OG
   images, Markdown mirrors, RSS, sitemap, LLM artifacts, and serves clean URLs
   through BrowserSync middleware. It has no client router or router references.
   Migrating only URL strings would create a second route catalog without
   replacing the current output authority.

The pending npm publication recorded in RTR-1 is not an adoption blocker and
does not gate this evaluation; a local package/tarball can be used when the
blog experiment is otherwise ready. Re-evaluate after a separately verified
blog core upgrade. At that point, migrate the post/prompt family only if its
`route()` definitions and `entries()` become the canonical source for both
HTML output paths and href construction, while the existing content/SEO/feed
pipeline remains the renderer. Do not introduce a browser outlet merely to
claim adoption; the initial value is one typed static route family with no
parallel path list.

### Navigation effects documentation (RTR-3)

The package README now records the implemented push/replace/popstate/hash
scroll and focus contract from amendment 5. Cross-page and initial-load hash
jumps are post-render `scrollIntoView()` emulation; same-document hash anchors
remain unintercepted and browser-native. This distinction closes the previous
documentation gap without introducing a second navigation behavior.

### HMR composition validation (RTR-4)

A scripted route-page module edit now verifies `nisliHmr()` and
`nisliRoutes()` together: core HMR transforms both the original and edited
component module into self-accepting updates and retains the edited render
body, while the independent route middleware continues to match and serve the
same dynamic direct URL. `nisliRoutes()` still owns no transform or hot-update
hook; component replacement remains exclusively a core HMR responsibility.

### Runtime and proof hardening (RTR-5)

- The browser `Router` compiles its matcher once when the application
  definition connects and reuses it for every transition. Navigation no longer
  recompiles and revalidates the static route catalog.
- The package test command runs `vitest run --typecheck`, so
  `readme.test-d.ts` and `types.test-d.ts` are executed as typecheck suites in
  the normal CI path rather than merely existing as unchecked proof files.
- `target="_self"` is treated like an absent target and remains eligible for
  client-side interception; only non-self browsing-context targets opt out.
  This matches the explicit checks in
  [React Router](https://github.com/remix-run/react-router/blob/ac5d9d5ac3ba0c38ee14e1c75ba79621b3b0ba07/packages/react-router/lib/dom/dom.ts#L34-L42),
  [SvelteKit](https://github.com/sveltejs/kit/blob/5c38e515db7fbb92e5ae01db84b4f0040a02f187/packages/kit/src/runtime/client/client.js#L2714-L2722),
  and [Next.js](https://github.com/vercel/next.js/blob/1bd2fd585aac793ca2589e6f18f17a412fd11005/packages/next/src/client/app-dir/link.tsx#L240-L250).
  Treating explicit `_self` as a reload opt-out would be surprising because it
  names the same browsing context as the default. `data-router-ignore` remains
  the intentional full-page-navigation escape hatch.

### Validation status and canonical application path (RTR-6)

`defineRouter()` application configuration is the canonical path for a routed
Nisli application. Browser outlets, `nisliRoutes()`, and router-aware
`buildStaticSite({ router })` all consume that one definition. The SSG package's
plain static-path-list mode remains a useful lower-level primitive for sites
that have not adopted the router; it is not a parallel routing contract and no
second application route catalog should grow on top of it.

Audit status for the original validation plan as of 2026-07-12:

| Step | Status | Evidence / remaining gap |
| --- | --- | --- |
| 1. Path compiler, matcher, codecs, and `href()` | **Validated** | Router matcher/query runtime suites cover static, parameter, catch-all, base, normalization, encoding, specificity, ambiguity, codec, and href behavior. |
| 2. Type failures for path/query construction | **Validated** | `types.test-d.ts` and the README proof run under `vitest --typecheck` in the normal package test command (RTR-5). |
| 3. Browser history, popstate, and click service | **Validated** | Happy DOM tests exercise push, replace, popstate rendering, eligible anchor interception, `_self`, non-self/external exceptions, and not-found navigation. |
| 4. Transparent outlet, async guard, and cleanup | **Validated** | Browser tests cover lazy single registration, implicit connection, rendering/metadata, stale async discard, and rejection of a second root; component disconnect owns listener disposal through the returned connection disposer. |
| 5. Migrate `packages/www` | **Validated** | The real `AppRouter` owns `/`, `/ui`, `/ui/:name`, `/themes`, `/docs`, `/docs/:topic`, and not-found; Vite and SSG both consume it, including dynamic `entries()` and emitted `404.html`. |
| 6. Browser/Vite/SSG equivalence | **Validated** | Router/SSG and `www` equivalence suites compare route identity, params, query, base paths, dynamic entries, and not-found results against actual static builds. |
| 7. End-to-end navigation behaviors | **Partial** | Direct loads, native click exceptions, query parsing, client 404s, Vite refresh fallback, static output, stale renders, and scripted HMR composition are covered. Real browser back/forward scroll restoration and rendered-page scroll/focus/hash effects are specified and unit-inspected but do not yet have browser-level automation; retain this as the explicit remaining validation gap. |
| 8. Blog route-family evaluation | **Evaluated — not yet** | RTR-2 records the post/prompt candidate and prerequisites; no migration until the blog core upgrade and canonical integration with its specialized static pipeline can be evaluated independently. npm publication is explicitly not a gate. |

## 0.2.0 Gap-Closure Amendments (2026-07-13)

`@nisli/router@0.2.0` closes five gaps left open by 0.1.0 (the ADR "Deferred"
list plus the RTR-6 validation gap). Driver: **erent** is adopting the router
for bilingual SEO routing; its ADR 009 splits duties between the client router
and a Worker that emits server-side 301s and canonical/hreflang HTML. The
client half needs declarative SEO metadata and validated locale segments. All
changes keep zero runtime dependencies, keep the matcher pure and
environment-neutral, and introduce no breaking API **signatures**. Two
observable behavior changes are recorded with rationale below.

### 1. SEO metadata is a managed lifecycle, not append-only (P1)

`RouteMetadata` gains `property` (`<meta property>` for OpenGraph), `canonical`
(`<link rel="canonical">`), and `alternates` (`<link rel="alternate" hreflang>`).
0.1.0 only ever *added/updated* `document.title` and `<meta name>`; it never
removed anything, so a canonical or `og:*` tag from route A stayed in the
`<head>` after a client navigation to route B — a real SEO defect (stale
canonical). 0.2.0 replaces `applyMetadata` with a **reconciler**:

- every `<meta>`/`<link>` the router creates or adopts is tagged
  `data-nisli-managed="<key>"`;
- on each navigation the router computes the desired managed set and
  set/update/**removes** to match exactly, so canonical/OG/hreflang never go
  stale;
- `document.title` reconciles the same way — a route that omits `title` falls
  back to the title captured at connect, so a previous route's title never
  lingers (a review-caught sibling of the stale-canonical defect).

The router owns only the SEO tag *types* it manages (`title`, `<meta name>`,
`<meta property>`, canonical, alternate); it adopts a matching server-rendered
tag rather than duplicating it (adoption avoids two canonicals after
hydration). Head elements outside those types (charset, viewport, stylesheets,
scripts) are never touched.

**Behavior change (rationale-recorded):** the router now *owns* the SEO head
tag types it manages, including removing a managed tag when a subsequent route
omits it. This is required for correct canonical/hreflang behavior across SPA
navigations. The SSG shell remains the build-time authority; the browser
applies the same typed contract on navigation (amendment 7 of the original
ADR).

### 2. Typed path-parameter codecs; invalid segment ⇒ NO-MATCH (P2)

`route()` accepts an optional `params` codec map reusing the existing
`QueryCodec` contract, e.g. `params: { locale: enumParam(['en','ka']) }` on
`/:locale`. The **pure matcher** runs each codec during matching; a codec that
throws is a NO-MATCH — the URL falls through to the next candidate or
`notFound`, never a render-time error. `href()` re-serializes typed segments
through the codec (`numberParam` path segment ⇒ `params.id: number`). The typed
view is the `render` context (`RouteContext.params` is `ResolvedParams`); the
public `RouteMatch.params` remains `Record<string,string>` for the SSG
structural contract, with codec-refined values still present at runtime.

Codecs validate *values*, not route *shape*: two identically-shaped param
routes (`/:locale` and `/:slug`) remain ambiguous by design — a codec is not a
discriminator and matching stays order-independent.

### 3. Client-side redirect routes (P3)

New `redirect(path, to)` definition; `to` is a fixed href or
`(context) => href` of the matched params. The matcher compiles redirects
alongside routes and resolves the target purely; the browser `Router` performs
the redirect with `history.replaceState` (**replace semantics, no history
entry for the redirect source**) and a bounded hop guard (`MAX_REDIRECTS`) that
stops self-loops *and* multi-redirect cycles with an `error` instead of
hanging. `defineRouter`
base-prefixes redirect targets like `href`. Redirects are matcher-only: they
are not part of the typed `.routes` href catalog and the SSG `routes` map does
not emit them. **This is only the client half** — server 301s and canonical
HTML stay in the consumer's Worker, per erent ADR 009.

### 4. Scroll restoration (P4)

On connect the router takes over `history.scrollRestoration = 'manual'`
(restoring the previous value on disconnect), stamps each history entry with a
key, remembers per-entry scroll positions, and restores the target entry's
position on `popstate` (back/forward). Push still scrolls to top and focuses
the outlet; `replace` still preserves; hash still jumps post-render. The key
sequence is seeded from any key persisted across a reload, so freshly pushed
entries never collide with keys still live in the back stack (review-caught).

**Behavior change (rationale-recorded):** the router now wraps `history.state`
as `{ __nisli_router: <key>, state: <userState> }`. `NavigateOptions.state` is
unchanged and still round-trips (under `.state`); no public signature changes.
The router owns `history.state` shape because per-entry scroll memory requires
a stable key that survives `popstate`. The previous README row "Back/forward →
leaves restoration to the browser" is superseded by explicit manual
restoration.

### 5. Active-link helper (P5)

`Router.isActive(href, { exact? })` reads the reactive `url` signal so
`aria-current` re-evaluates in templates on every navigation. Pathname-prefix
match by default; `{ exact: true }` and the root path `/` require an exact
match (so a Home link is not always active).

### 6. erent SEO gap-audit additions (A–D)

erent's SEO engineer ran a final gap audit before its v0.2 freeze. Four items
entered 0.2.0 (the consuming project owns Worker sitemap, HTTP status, and
server redirects — explicitly out of scope):

- **(A) Managed JSON-LD** — `RouteMetadata.jsonLd` is a stable-key map; each
  entry becomes a `<script type="application/ld+json" data-nisli-managed>`
  reconciled by the same set/update/**remove** pass as meta/link, so
  Worker-injected `Car`/`LocalBusiness` structured data does not go stale after
  SPA navigation, notFound, redirect-away, or transition-away. **API boundary:**
  a server-rendered JSON-LD block is *adopted* (not duplicated) — a block
  already tagged `data-nisli-managed="jsonld:<key>"` is reused by key, and an
  untagged `application/ld+json` block is adopted (tagged + updated) on the
  first client render (each key adopts a distinct block; a fresh one is created
  only when no unmanaged block remains). Adopted/created blocks are removed when
  a later route omits the key. A `jsonLd` value that stringifies to `undefined`
  or throws (circular/BigInt) is treated as "no block for this key" — removed,
  never left stale or breaking the render path.
- **(B) Document-level `lang`/`dir`** — `RouteMetadata.lang` and `dir` set
  `<html lang>`/`<html dir>`, reconciled against the connect-time values
  (omission restores the default, removing the attribute when there was none).
  This is the same class as the title reconciliation; URL locale becomes
  authoritative without a per-app locale DOM effect.
- **(C) Lossless href URL state** — `href()` gains open-ended `search`
  (`URLSearchParams | Record | string`) and `hash`. Arbitrary query params are
  merged **under** the typed declared `query` (declared wins; a declared key at
  its default value clears any carried-over copy), and the fragment is appended.
  One URL builder serves both campaign-attribution passthrough and
  counterpart-locale links (`href({ params:{locale:'ka'}, search:url.searchParams,
  hash:url.hash })`), instead of two.
- **(D) Atomic managed-head reset on render failure** *(correctness)* — when a
  route renderer throws, the router now resets all managed head state
  (title/meta/property/canonical/alternate/JSON-LD/lang/dir) to the connect
  defaults, so URL B's error state cannot retain route A's canonical/OG/hreflang/
  JSON-LD — an SEO-visible defect in the P1 reconciler as first built. The
  larger application-level error-fallback-renderer + fallback-metadata API from
  the audit is **deferred to 0.3**; the atomic clearing is not deferrable and
  ships now.

### Validation status update (supersedes RTR-6 row 7)

| Concern | Status | Evidence / remaining gap |
| --- | --- | --- |
| SEO metadata set/update/remove | **Validated (unit)** | Router test navigates between an SEO-rich route and a bare route and asserts `og:*`, canonical, and hreflang tags are created then **removed**. |
| Path codec NO-MATCH + href round-trip | **Validated (unit + type)** | Matcher tests: enum locale valid/invalid→notFound, `numberParam` parse + href. `types.test-d.ts`: refined param types, rejected out-of-enum/`string` id. |
| Redirect replace semantics | **Validated (unit)** | Matcher resolves targets with params; browser test follows `/u/:id`→`/users/:id` and `/start`→`/` and asserts the resolved route/pathname. |
| Scroll restoration | **Validated (unit); browser-level manual** | Happy-DOM test drives `popstate` and asserts `scrollTo(x,y)` with the remembered position, and asserts `history.scrollRestoration === 'manual'`. Real-browser back/forward scroll across tall pages, `scrollIntoView` for hashes, and outlet focus effects still require **manual** verification (Chrome DevTools): navigate a tall page, scroll, navigate away, press Back, confirm the prior offset is restored and no double-scroll occurs. A durable real-browser guard is deferred; happy-DOM now exercises the code path that was previously only "specified and unit-inspected". |
| Active-link `aria-current` | **Validated (unit)** | Browser test asserts prefix vs `{exact}` vs root behavior across two navigations. |
| Managed JSON-LD (A) | **Validated (unit)** | Browser test sets, updates, and removes a keyed `LocalBusiness` block across three navigations. |
| html `lang`/`dir` (B) | **Validated (unit)** | Browser test applies `en`/`ltr`, switches to `ka`, and resets to connect defaults on a bare route. |
| Lossless href (C) | **Validated (unit + type)** | Matcher tests: passthrough of `utm_source`/`inquiry` + hash with declared query retained; default-value override. `types.test-d.ts`: `search`/`hash` compose with typed params/query. |
| Atomic head reset on render error (D) | **Validated (unit)** | Browser test: route A canonical + JSON-LD are gone after route B render throws. |

The remaining explicit gap is unchanged in kind from RTR-6 — **real-browser
automation of scroll/focus/hash effects** — but its surface is now smaller: the
scroll-restoration logic itself is unit-driven, leaving only pixel-level
browser confirmation manual.

### Deferred (unchanged) / newly deferred

- Path codecs as route discriminators (shape-level disambiguation) — out of
  scope; codecs validate values only.
- SSG emission of redirect routes (e.g. `<meta http-equiv=refresh>` files) —
  redirects are client-only in 0.2.0; the Worker owns server redirects.
- A durable real-browser scroll/focus automation harness.
- Application-level error-fallback renderer + fallback-metadata contract
  (erent audit item D's larger form) — deferred to 0.3; 0.2.0 ships only the
  atomic managed-head reset on render failure.
