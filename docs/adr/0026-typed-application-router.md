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

Three prerequisites make migration now premature:

1. The blog depends on `@nisli/core@^0.47.4`, while `@nisli/router@0.1.0`
   requires core `>=0.51.0`. A route experiment would therefore also be a
   multi-version framework migration, obscuring whether failures came from the
   router or the core upgrade.
2. `@nisli/router` is not yet available from npm (RTR-1). The blog is a separate
   repository and has no workspace link to this monorepo, so adopting it now
   would require an unpublished tarball/path dependency rather than proving the
   consumer installation path.
3. The blog has a specialized static pipeline, not Vite or `@nisli/ssg`: it
   discovers Markdown/TypeScript posts, renders page shells, generates OG
   images, Markdown mirrors, RSS, sitemap, LLM artifacts, and serves clean URLs
   through BrowserSync middleware. It has no client router or router references.
   Migrating only URL strings would create a second route catalog without
   replacing the current output authority.

Re-evaluate after router publication and a separately verified blog core
upgrade. At that point, migrate the post/prompt family only if its
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
