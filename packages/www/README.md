# @nisli/www — the nisli website

The real website for the nisli ecosystem — home, docs, the `@nisli/ui` component
gallery, and the theme/token showcase. **One static site**, authored in nisli, composed
from `@nisli/ui` (owned copies installed via the copy-in CLI), rendered to static HTML by
`@nisli/ssg`, and deployed to Cloudflare Workers Static Assets.

**Live: https://nisli.dev** (and https://www.nisli.dev).

Information architecture and roadmap: [`IA.md`](./IA.md).

## Scripts

| Script      | What it does                                                              |
| ----------- | ------------------------------------------------------------------------- |
| `sync`      | Reinstall the site's `src/nisli-ui/` component copies through the real `@nisli/ui` CLI (`init` + `add` every registry item). Run after registry changes, then commit the refreshed copies. |
| `render`    | Render the site to `dist/` via `@nisli/ssg`, driven by `src/render.test.ts` (vitest is the repo's TS runner on Node 20). |
| `build`     | **Self-contained**: `sync` (build `@nisli/ui` + copy-in) → `render` → compile `dist/assets/site.css` with the Tailwind v4 CLI. Produces a complete `dist/` from a cold checkout. |
| `release`   | `build` + `npx wrangler deploy` — the manual deploy path (publishes `dist/` to Cloudflare worker `nisli-www`). Named `release`, not `deploy`, because `pnpm deploy` is a reserved pnpm builtin. |
| `test`      | `vitest run` — the render test doubles as an end-to-end regression.       |
| `typecheck` | `tsc --noEmit`.                                                            |

Run from the repo root, e.g. `pnpm --filter @nisli/www build`.

`build` is self-contained by design: it makes no warm-workspace assumptions, so a fresh
`pnpm install && pnpm --filter @nisli/www build` produces `dist/` — this is what the
Cloudflare build runs. Note `build` runs the copy-in (`sync`), so it regenerates
`src/nisli-ui/` from the current registry on every build; the committed copies are a dev
snapshot, and the deployed site always reflects the registry at build time.

## Deploy

**Deploys run on Cloudflare Workers Builds** — the worker `nisli-www` is git-connected to
`gkoreli/nisli` (branch `main`), exactly like Goga's blog. A push to `main` that touches
the watched paths triggers a clean-env build + deploy in ~60s. No GitHub Actions, no API
token.

Cloudflare dashboard settings (Workers & Pages → `nisli-www` → Settings → Build):

| Setting         | Value                                                       |
| --------------- | ----------------------------------------------------------- |
| Git repository  | `gkoreli/nisli`, branch `main`                           |
| Root directory  | `packages/www`                                              |
| Build command   | `pnpm install && pnpm --filter @nisli/www build`            |
| Deploy command  | `npx wrangler deploy` (default)                             |
| Watch paths     | `packages/www/**`, `packages/ui/**`, `packages/core/**`     |

`packages/ui/**` + `packages/core/**` are watched because `build` copies the current
`@nisli/ui` source in, so a component or framework change redeploys the site with fresh
copies even without a `packages/www` change.

### Manual escape hatch

`pnpm --filter @nisli/www release` (build + `npx wrangler deploy`) still works from an
authenticated machine (`npx wrangler whoami`; `npx wrangler login` once if needed) — use it
when you need to deploy without pushing.

## Custom domains

`wrangler.toml` attaches `nisli.dev` and `www.nisli.dev` as Cloudflare custom domains (the
zone lives in Goga's Cloudflare account). Top-level `routes` **must** precede the `[assets]`
table in the TOML, or they get nested under `assets` and silently ignored. After the first
deploy that adds a domain, its DNS record can take a few minutes to propagate globally.
