# Changelog

All notable changes to `@nisli/ssg`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## Unreleased

- Opt-in `viewTransitions` on the static-site config emits the cross-document
  view-transition contract into every page's head: the
  `@view-transition { navigation: auto }` style both sides of a navigation need,
  and optional prefetch/prerender speculation rules (`href_matches` scope,
  eagerness, and a `[data-no-prerender]` exclusion, all tunable). The payload is
  minified with a fixed key order so committed output is byte-stable, and a
  build without the option is byte-identical to before.
- `renderViewTransitionHead()` is exported for sites that render body fragments
  through SSG and assemble the document in their own shell: they place the same
  markup in their head instead of enabling injection.
- New `@nisli/ssg/client` entry point exports `whenActive(fn)`, the prerender
  guard for anything observable (analytics, timers, autofocus, media) in a page
  a browser may render in a hidden prerendered document. It is dependency-free,
  side-effect-free, and runs its callback immediately — never throwing — where
  `document.prerendering` or the DOM itself is absent.
- `renderToString()` now throws on `@nisli/core`'s `sanitized()` markup
  instead of silently emitting an escaped `[object Object]`. This module is
  DOM-free by design, so there is no `Element.setHTML()` and no registered
  sanitizer to run untrusted markup through — matching `html:inner`'s
  fail-closed N107 rather than producing wrong output in a built page.
  Render untrusted markup on the client, or sanitize it at build time and
  wrap the result in `raw()`.

## 0.4.0 — 2026-07-16

- Static application routers that declare client-side redirects now remain
  structurally assignable to the SSG contract without making redirects a
  static-build concern.
- Render-separated route and not-found definitions can flow from a shared
  catalog into SSG; static builds fail with a targeted error until those
  definitions have renders bound.
- Top-level component factories now snapshot signal/computed props and host
  classes with the same static output as nested factory composition. Static
  snapshots also omit browser-runtime slot boundary comments.
- The structural router metadata contract now includes property metadata,
  canonical/alternate links, document language/direction, and keyed JSON-LD,
  matching the full browser-router surface without a runtime router dependency.

## 0.3.0 — 2026-07-11

- Typed router mode: `buildStaticSite` consumes a `StaticApplicationRouter`
  directly — `entries()` expansion through typed `href()`, re-match-before-
  render validation, metadata/shell plumbing, and root `404.html` emission.
- `renderToHtml()` awaits `tick()` before snapshotting, so microtask work
  (projection sweeps, initial effects) lands in static output.

## 0.2.0 — 2026-07-11

- Static-site build spine for Nisli: `buildStaticSite()` with route-by-route
  output, optional public-asset copying, build hooks, and the file-writing
  helpers (`cleanOutDir`, `copyPublicAssets`, `writeRoute`, `writeRoot`).
- Plain static route arrays with per-route render callbacks.
- Earlier history lives in git.
