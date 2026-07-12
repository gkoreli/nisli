# 0024. nisli Website — `packages/www`, Full-Stack Dogfood

**Date**: 2026-07-11
**Status**: Accepted
**Depends on**: [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md)

## Context

Goga wants a public static site that showcases both the nisli framework and
`@nisli/ui`, built by dogfooding the entire stack: pages authored in nisli,
composed from `@nisli/ui` components, rendered to static HTML by `@nisli/ssg`,
deployed to Cloudflare Workers Static Assets.

**Update (same day)**: scope expanded from a single showcase page to the
**full nisli website** — home, docs, design/theme showcase, and component
gallery. **Identity (per Goga)**: nisli.dev is the home of the nisli
*framework* — `@nisli/core` is the product, `@nisli/ui` its design language
and component layer, one cohesive thing. The site reads like a framework
site (react.dev / svelte.dev class) that also ships a first-class component
library; ui.shadcn.com is the model only for the `/ui` and `/themes`
sections, and Goga's blog (a static nisli+wrangler site) for the build/deploy
shape. One-liner: framework + design language + UI components, all in one —
install the framework, copy in the components. The `/docs` quick-start is a
framework hello-world (signal + component + html), not a ui-add walkthrough. Following the shadcn `apps/www` precedent the package is renamed
`packages/site` → **`packages/www` (`@nisli/www`)**, and a dedicated engineer
(eng3) owns it — the pipeline below (CLI-dogfood sync, SSG render via the
vitest runner, Tailwind CLI, wrangler static assets) carries over unchanged.

## Decision

- **Location: a new private workspace package, now `packages/www`** — a
  showcase site needs editorial freedom, its own sections and copy, and a
  deploy pipeline. The site remains an honest consumer by installing its own
  component copies through the real CLI (`pnpm --filter @nisli/www sync`).
  **Update 2026-07-11**: www superseded the former duplicate UI consumer and
  its registry-copy equality check; CI now requires complete registry preview
  coverage in this single dogfood consumer.
- **Pipeline**: `src/render.test.ts` drives `buildSite()` (vitest is the
  repo's TS runner on Node 20) → `@nisli/ssg` renders `src/pages/home.ts`
  → `src/shell.ts` wraps it in a full document → Tailwind CLI
  (`@tailwindcss/cli`, a site-only devDependency; the zero-runtime-deps rule
  applies to registry code, not site tooling) compiles `dist/assets/site.css`
  from the rendered HTML + our theme tokens. `pnpm --filter @nisli/www
  build` produces a complete `dist/`.
- **Deploy**: `wrangler.toml` with `[assets] directory = "./dist"`
  (Cloudflare Workers Static Assets; `npx wrangler deploy`). `dist/` is plain
  static files — host-portable to GitHub Pages or any static host.
- **Ownership**: eng3 owns `packages/www` end to end (pages, sections, IA,
  content); arch owns the cross-package architecture, reviews, and landing.
  The original section split (hero/install/framework: eng1; gallery: eng2)
  was folded into eng3's backlog when the scope expanded.
- Dark mode: `.dark` class persisted in localStorage; tokens are the
  registry's `theme.css` (upstream `new-york-v4` neutral).

## Consequences

- The site doubles as an end-to-end regression: `pnpm test` renders the whole
  page from real installed component copies.
- Site component copies can drift from the registry between syncs — refresh
  with `pnpm --filter @nisli/www sync` (deliberate: a real consumer's copies
  don't auto-update either).
- First non-published workspace package; root `pnpm build/test/typecheck`
  now include it.

## Amendment 2026-07-12 — reusable layout system (WWW-12, Goga's design direction)

Goga's ask, verbatim intent: a "reusable sidebar and proper web layout for
the www package, proper modular architecture and reusable pages/components"
— the docs-site pattern of code.claude.com/docs and ui.shadcn.com/docs:
persistent top bar, grouped left sidebar navigation, content column with
breadcrumb + title, optional "on this page" rail, sidebar collapsing to a
drawer on mobile. Production-grade, no bandaids; at 0.n we replace fully and
delete the old page-local layout in the same series.

**Decision — a composable layout layer in `src/layout/`, one source of truth
for navigation:**

- **Pieces** (each a reusable nisli component, composed — never page-local
  markup): `SiteShell` (top bar: brand, top-level nav, theme toggle — every
  page renders inside it, home included), `DocsLayout` (the three-region
  docs frame: sidebar / content / optional TOC rail), `SidebarNav` (grouped,
  scrollable nav; current item highlighted via `aria-current` + data-state),
  `ContentShell` (breadcrumb + title + prose container), `PageToc` (right
  rail, optional per page).
- **Dogfood the registry `sidebar` family** for `SidebarNav` and the mobile
  drawer (it already carries provider/group/menu structure, `use-mobile` +
  sheet behavior). This is the point of the site: **if the registry sidebar
  cannot serve a real docs site, that is a registry component gap — fixed in
  `packages/ui` FIRST**, captured in ADR 0022/0025, then consumed here. No
  www-local fork of sidebar behavior.
- **Nav data is derived, never hand-maintained** (ADR 0026 spirit): the
  sidebar groups (Getting Started / Components / Primitives) are computed
  from the same sources the router derives its routes from —
  `src/registry.ts` (registry JSON → Components + Primitives groups) and the
  docs source catalog. Adding a registry item or docs page yields its nav
  entry with zero nav edits; a nav entry with no route (or route with no nav
  coverage decision) is a test failure.
- **Coverage**: `/ui` index, every `/ui/<name>`, and every `/docs/*` page
  render through `DocsLayout`; home renders through `SiteShell` alone. The
  old per-page layout markup is deleted in the same landing series (no
  legacy path).
- **Accessibility floor**: skip-to-content link, `nav`/`main`/`aside`
  landmarks, full keyboard operability (sidebar is a tabbable tree; mobile
  drawer inherits the sheet's focus trap + Escape), `aria-current="page"` on
  the active item.
- **Hydration interplay** (WWW-10/WS1): the layout is static-first — sidebar
  links are real anchors and work with zero JS; only the mobile drawer
  toggle and theme toggle need the hydration runtime, which the WS1 guard
  already verifies per page. The drawer's portaled sheet is subject to the
  ADR 0025 item-6 SSG limit and therefore must be in the hydrate set.
- **Staffing**: eng3 leads implementation and route/nav-data wiring (after
  the WS1 fix set lands); eng2 joins for the layout components and owns any
  registry `sidebar` gaps the dogfooding surfaces. rev gates; deploy to
  nisli.dev on pass so Goga sees it.
