# 0024. Showcase Site — `packages/site`, Full-Stack Dogfood

**Date**: 2026-07-11
**Status**: Accepted
**Depends on**: [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md)

## Context

Goga wants a public static site that showcases both the nisli framework and
`@nisli/ui`, built by dogfooding the entire stack: pages authored in nisli,
composed from `@nisli/ui` components, rendered to static HTML by `@nisli/ssg`,
deployed to Cloudflare Workers Static Assets.

## Decision

- **Location: a new private workspace package, `packages/site`** — not an
  extension of `packages/ui/demo`. The demo is a byte-locked CLI-output
  fixture (its files must equal the registry exactly, enforced in CI); a
  showcase site needs editorial freedom, its own sections and copy, and a
  deploy pipeline. Both remain honest consumers: the site installs its own
  component copies through the real CLI (`pnpm --filter @nisli/site sync`).
- **Pipeline**: `src/render.test.ts` drives `buildSite()` (vitest is the
  repo's TS runner on Node 20) → `@nisli/ssg` renders `src/pages/home.ts`
  → `src/shell.ts` wraps it in a full document → Tailwind CLI
  (`@tailwindcss/cli`, a site-only devDependency; the zero-runtime-deps rule
  applies to registry code, not site tooling) compiles `dist/assets/site.css`
  from the rendered HTML + our theme tokens. `pnpm --filter @nisli/site
  build` produces a complete `dist/`.
- **Deploy**: `wrangler.toml` with `[assets] directory = "./dist"`
  (Cloudflare Workers Static Assets; `npx wrangler deploy`). `dist/` is plain
  static files — host-portable to GitHub Pages or any static host.
- **Ownership**: sections are per-ticket modules under `src/sections/`
  (hero/install/framework: eng1; gallery: eng2); the page composition
  (`src/pages/home.ts`), shell, pipeline, and deploy wiring are arch's.
  Section owners edit only their module — no composition conflicts.
- Dark mode: `.dark` class persisted in localStorage; tokens are the
  registry's `theme.css` (upstream `new-york-v4` neutral).

## Consequences

- The site doubles as an end-to-end regression: `pnpm test` renders the whole
  page from real installed component copies.
- Site component copies can drift from the registry between syncs — refresh
  with `pnpm --filter @nisli/site sync` (deliberate: a real consumer's copies
  don't auto-update either).
- First non-published workspace package; root `pnpm build/test/typecheck`
  now include it.
