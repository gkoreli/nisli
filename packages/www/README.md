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
| `build`     | `render` + compile `dist/assets/site.css` with the Tailwind v4 CLI. Produces a complete `dist/`. |
| `deploy`    | `build` + `npx wrangler deploy` — publish `dist/` to Cloudflare (worker `nisli-www`). |
| `test`      | `vitest run` — the render test doubles as an end-to-end regression.       |
| `typecheck` | `tsc --noEmit`.                                                            |

Run from the repo root, e.g. `pnpm --filter @nisli/www build`.

## Deploy

**Deploys are local, via the authenticated wrangler CLI** — the same model as Goga's blog
and the other sites. There is no CI/CD workflow and no API token: `wrangler` uses the
interactive OAuth login already present on the deploy machine (`npx wrangler whoami` to
check; `npx wrangler login` once if not authed).

```sh
pnpm --filter @nisli/www deploy    # build + wrangler deploy
```

### Norm: deploy is the last step when www changes land

Whenever a change to `packages/www/**` lands on `main` (or a `packages/ui/**` change is
resynced into `src/nisli-ui/` and committed), **eng3 runs `pnpm --filter @nisli/www deploy`
as the final step** so merge → live stays one motion. The site deploys its *committed*
`src/nisli-ui/` copies (the honest-consumer model — copies refresh only via `sync` + commit,
never auto-updated), so what's live always matches what's on `main`.

## Custom domains

`wrangler.toml` attaches `nisli.dev` and `www.nisli.dev` as Cloudflare custom domains (the
zone lives in Goga's Cloudflare account). Top-level `routes` **must** precede the `[assets]`
table in the TOML, or they get nested under `assets` and silently ignored. After the first
deploy that adds a domain, its DNS record can take a few minutes to propagate globally.
