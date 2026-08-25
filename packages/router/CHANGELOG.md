# Changelog

All notable changes to `@nisli/router`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## Unreleased

- **View Transitions**: `defineRouter(catalog, { viewTransitions })` animates
  navigations through the platform's View Transition API. Opt-in and off by
  default — `enabled` takes `true` or a `(nav) => boolean` predicate, and
  `types` chooses the transition types `:active-view-transition-type()` keys
  off, defaulting to the navigation direction. Only the **commit** is wrapped
  (rendered output, managed head, and the scroll/focus effects, so title and
  meta swap atomically inside the snapshot); the awaited route render stays
  outside, so a slow loader never freezes the page inside a capture window. A
  navigation that lands mid-animation skips the transition in flight instead of
  queueing behind it. The initial render, hash-only moves, and a hidden
  document never transition. Where `document.startViewTransition` is missing the
  commit applies directly and the router behaves exactly as before: no
  polyfill, no UA sniffing, no new bytes on the no-opt-in path. Recommended
  root-crossfade and `prefers-reduced-motion` CSS is documented in the README;
  the package ships no stylesheet.
- **`NavigateOptions.viewTransition`**: per-navigation override — `false` never
  transitions, `true` transitions even where the policy is off, and
  `{ types }` transitions with explicit types.
- **`NavInfo`**: what the policy callbacks are told about a navigation —
  `from`, `to`, `kind` (`'push' | 'replace' | 'pop'`), and `direction`
  (`'forward' | 'back' | 'unknown'`). Direction is answered by the navigation
  engine: history-entry indices under the Navigation API, the engine's own
  per-entry keys under the History API, and `'unknown'` where neither can
  decide. Both engines are covered by the same behavioural tests.
- **Navigation API engine**: where the browser has `window.navigation`, routing
  now runs on `navigation.intercept()` — the browser owns scroll restoration,
  fragment jumps, and traversal semantics, and every same-origin navigation the
  matcher owns becomes a same-document transition, including
  `location.href = '/x'` from application or third-party code. The routing
  contract is unchanged; navigation state moves from the `history.state` wrapper
  onto the history entry, which `router.state()` already abstracts.
- **`defineRouter(catalog, { engine })`**: `'auto'` (default) detects the
  Navigation API and falls back to the History engine; `'history'` and
  `'navigation'` are the operator kill switch. `'navigation'` still falls back
  where the API is absent. The History engine stays maintained, not deprecated,
  and both engines are covered by the same behavioural tests.
- **`router.state()`**: accessor for the navigation state of the current history
  entry — the value last passed as `NavigateOptions.state`. Reading
  `history.state.state` directly is deprecated: the wrapper the router stamps
  its per-entry scroll key into is a detail of the browser mechanics, not part
  of the contract.
- Internal: the browser mechanics (the `popstate` and delegated click
  listeners, history commits, cross-origin escape, and per-entry scroll memory)
  now sit behind a `NavigationEngine` seam, with `HistoryEngine` as the only
  implementation. Matching, signals, redirects, head reconciliation, and the
  render pipeline are unchanged and engine-independent. No behavior change: the
  browser suite passes unmodified.

## 0.5.1 — 2026-07-16

- Eligible same-origin anchors are intercepted only when the connected matcher
  owns the URL; unmatched documents and resources keep native navigation.
- True no-match navigations now clear all router-managed metadata and restore
  connect-time title, language, and direction defaults.

## 0.5.0 — 2026-07-13

- **Typed outlet host attributes**: `defineRouter(catalog, { outletAttrs })`
  applies `id` and `aria-*` to the router's `<main>` landmark host — enabling a
  skip link (`href="#main-content"`) and `aria-label` on the main region. The
  surface is conservative and typed (unknown or managed attributes are compile
  errors); the managed `role="main"`/`tabindex="-1"` are applied last and cannot
  be overridden. The router applies these itself, with no `@nisli/core` change.

## 0.4.0 — 2026-07-13

Render-separated route definitions with one identity — a strict-boundary
monorepo (`shared` must not reference client render modules, even dynamically)
can now author the whole catalog in its pure `shared` package.

- **`route()`/`notFound()` `render` is optional**: a route may be authored as
  pure identity (path, param/query codecs, metadata, redirects) with no render —
  safe for a `shared` package and the `@nisli/router/catalog` subpath.
- **`bindRenders(catalog, { name: renderer })`**: typed client-side binding that
  attaches render implementations keyed by route name, with **compile-time
  exhaustiveness** (a missing or extra name is a type error) and per-route
  **context types flowing from the definition**. Identity is retained — binding
  adds behavior only; it never re-declares a path.
- **Worker path unchanged**: `createMatcher`/`defineRoutes` accept the
  render-less catalog directly (matching, `href()`, and metadata all derive from
  the single shared definition).
- Navigating to an unbound route throws a clear "bind it with bindRenders()"
  error; a static build likewise requires bound renders.
- Additive/non-breaking (`render` widened to optional). SSG's structural route
  type relaxes `render` to optional with a build-time guard.

## 0.3.0 — 2026-07-13

Worker single-source-of-truth: an edge Worker can consume the same authored
route catalog as the browser for HTTP status, redirect targets, and initial
canonical/hreflang metadata — with no `@nisli/core` runtime and no adapter.

- **Pure `@nisli/router/catalog` subpath**: side-effect-free entry exposing
  `route`/`redirect`/`notFound`, the query codecs, `createMatcher`,
  `defineRoutes`, and `normalizePathname` — never importing the `@nisli/core`
  component runtime (the package root still does, via the browser outlet).
- **`createMatcher` accepts the flat catalog**: the exact object `defineRouter`
  takes now works in `createMatcher(catalog)` too — one catalog shape for
  browser and Worker, no consumer-side partitioner.
- **`defineRoutes(catalog, { base })`**: the blessed pure normalizer
  (flat catalog → `MatcherDefinition`), shared by `defineRouter` internally so
  browser and Worker can never disagree.
- **Purity guard test**: enforces `matcher`/`route`/`query`/`catalog` stay free
  of runtime `@nisli/core` imports and BFS-checks the built `catalog` subpath's
  import graph, so a future refactor can't silently break Worker consumers.
- No breaking changes; additive subpath + widened `createMatcher` input.

## 0.2.0 — 2026-07-13

- **SEO metadata lifecycle**: `RouteMetadata` gains `property` (OpenGraph
  `<meta property>`), `canonical` (`<link rel="canonical">`), and `alternates`
  (`<link rel="alternate" hreflang>`). The browser router now reconciles the
  head — it set/update/**removes** the tags it manages (including `document.title`,
  which falls back to the connect-time title), so canonical/OG/hreflang/title no
  longer go stale after a client navigation.
- **Typed path-parameter codecs**: `route({ params })` validates and refines
  `:segments` with the query codecs (e.g. `enumParam(['en','ka'])`). An invalid
  segment is a matcher no-match (falls to `notFound`), and `href()` re-serializes
  typed segments.
- **Client-side redirects**: new `redirect(path, to)` definition — replace
  semantics, no history entry for the source, with a bounded hop guard that
  stops redirect cycles. Server 301s stay in the host.
- **Scroll restoration**: the router manages `history.scrollRestoration` and
  restores per-entry scroll positions on back/forward.
- **Active-link helper**: `Router.isActive(href, { exact })` for `aria-current`.
- **Managed JSON-LD**: `RouteMetadata.jsonLd` (stable-key map) renders managed
  `<script type="application/ld+json">` blocks with the same set/update/remove
  reconciliation, so structured data never goes stale after SPA navigation.
- **Document `lang`/`dir`**: `RouteMetadata.lang`/`dir` set `<html>` attributes
  per route/notFound, reconciled against the connect-time defaults.
- **Lossless `href` URL state**: `href({ search, hash })` merges arbitrary
  `URLSearchParams`/record/string query and appends a fragment while keeping the
  typed declared params/query (declared wins) — one builder for attribution
  passthrough and counterpart-locale links.
- **Atomic head reset on render error**: a failed route render now clears all
  managed head state so the previous route's canonical/OG/hreflang/JSON-LD/title/
  lang/dir cannot linger.
- No breaking API signatures. Two rationale-recorded behavior changes: the
  router now owns the head elements it manages, and wraps `history.state` to
  carry a per-entry scroll key (`NavigateOptions.state` still round-trips).
  See ADR 0026 "0.2.0 Gap-Closure Amendments".

## 0.1.0 — 2026-07-11

- Initial publish of `@nisli/router`.
- Typed `defineRouter`, `route`, and `href` with shared browser, Vite, and SSG matching.
- Added the browser outlet, Vite adapter, and static-site integration on one route contract.
- Hardened the adoption surface with lazy outlet registration, DOM-free router definitions, and inference-safe route catalogs.
