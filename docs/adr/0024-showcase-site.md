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

- **Location: a new private workspace package, now `packages/www`** — not an
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
  with `pnpm --filter @nisli/site sync` (deliberate: a real consumer's copies
  don't auto-update either).
- First non-published workspace package; root `pnpm build/test/typecheck`
  now include it.
