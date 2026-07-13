# Changelog

All notable changes to `@nisli/router`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

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
- No breaking API signatures. Two rationale-recorded behavior changes: the
  router now owns the head elements it manages, and wraps `history.state` to
  carry a per-entry scroll key (`NavigateOptions.state` still round-trips).
  See ADR 0026 "0.2.0 Gap-Closure Amendments".

## 0.1.0 — 2026-07-11

- Initial publish of `@nisli/router`.
- Typed `defineRouter`, `route`, and `href` with shared browser, Vite, and SSG matching.
- Added the browser outlet, Vite adapter, and static-site integration on one route contract.
- Hardened the adoption surface with lazy outlet registration, DOM-free router definitions, and inference-safe route catalogs.
