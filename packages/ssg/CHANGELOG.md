# Changelog

All notable changes to `@nisli/ssg`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

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
