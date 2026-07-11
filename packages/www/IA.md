# nisli.dev — Information Architecture (proposal, `eng3` → arch review)

**Status**: proposed — awaiting arch review before page-building begins.
**Scope**: the full nisli website (`packages/www`, `@nisli/www`), deployed live at
**https://nisli.dev**. Everything here is authored in nisli, composed from `@nisli/ui`
(owned copies via the copy-in CLI), rendered static by `@nisli/ssg`.

**Identity — this is a FRAMEWORK site.** nisli.dev is the home of the nisli *framework*
(`@nisli/core` is the product); `@nisli/ui` is the framework's design language + component
layer, one cohesive thing. The site reads like **react.dev / svelte.dev / angular.dev** — a
framework site that *also* ships a first-class component library — **not** like a
component-library site. ui.shadcn.com is the model **only** for `/ui` (per-component pages,
`add` commands) and `/themes`. The one-liner used everywhere:

> **nisli = framework + design language + UI components, all in one — install the framework,
> copy in the components.**

---

## 1. Routes & navigation

**Persistent top nav** (a nisli component — the site's own chrome is dogfood too):

```
[nisli]        Docs   Components   Themes            GitHub ↗   ◐ theme
```

- Logo → `/`
- Sticky, translucent, bottom border — shadcn/blog pattern.
- `◐ theme` = the light/dark toggle (already in `shell.ts`, promoted to a nisli component).
- Later: `⌘K` command palette (search docs + components).

**Route map:**

| Route              | Page                                   | Source of content              |
| ------------------ | -------------------------------------- | ------------------------------ |
| `/`                | Home — **framework-led** hero (signals, tagged-template components, no build step, no vDOM, DI), then `@nisli/ui` as the second beat ("batteries included: shadcn-style components you own"), live teasers, quick-start | hand-authored sections |
| `/docs`            | Docs landing — what nisli is, install, a **framework hello-world** quick-start | README + ADRs          |
| `/docs/<topic>`    | One page per concept (see §2)          | README + ADRs                  |
| `/ui`              | Component gallery index (grid of all)  | registry (auto)                |
| `/ui/<component>`  | Per-component page (shadcn-style)       | registry + curated examples    |
| `/themes`          | Token / design showcase, light+dark    | registry `theme.css`           |

Framework-site shape (react.dev/svelte.dev): **home / docs / components / themes**. The
shadcn model applies to `/ui` + `/themes` only; `/` and `/docs` lead with the framework.
The hero leads with `@nisli/core`; `@nisli/ui` is the second beat, never the headline. The
`/docs` quick-start is a framework hello-world (signal + component + `html`), **not** an
`@nisli/ui add` walkthrough — the copy-in flow lives in the `/docs/cli` and `/ui` pages.

Docs topics (`/docs/<topic>`), grouped in a left sidebar like shadcn:
- **Getting started**: `installation`, `quick-start`
- **Core concepts**: `signals` (reactivity), `templates` (`html`, `each`, `ref`),
  `components` (custom elements + lifecycle), `dependency-injection` (context + injector),
  `query` (async data)
- **Tooling**: `ssg` (static rendering), `cli` (the copy-in `@nisli/ui` workflow)

(Topics map 1:1 to real `@nisli/core` exports + ADRs, so nothing is invented.)

---

## 2. How docs pages get authored

The blog has a markdown→nisli pipeline (`lib/markdown.ts` + frontmatter), but **that
pipeline does not exist in this repo's `@nisli/ssg`**. Rather than build one up front:

**v1 — docs authored as nisli template modules (no new pipeline).**
Each doc page is a `.ts` module returning a regular nisli `html` template (from
`@nisli/core`) rendered through `buildStaticSite` — the same path the home sections use.
(The blog's `staticHtml` from `@nisli/core/static` is **not** available: that subpath was
removed in ADR 0020.1; static internals moved into `@nisli/ssg`.) Pages compose a small set
of **doc primitives** — `Prose`, `CodeBlock`, `PropsTable`, `ComponentPreview`, `Callout` —
built from nisli + `@nisli/ui`. Text bindings escape by default, which is exactly what
`CodeBlock` needs for safe code samples. This is the
honest dogfood (the docs *are* a nisli app), ships immediately, and ~8 concept pages is a
comfortable amount of prose-in-TS.

**Later — a markdown content pipeline, if volume warrants (needs an ADR).**
Port the blog's `lib/markdown.ts` + frontmatter into a www-local `lib/`, or propose
promoting it into `@nisli/ssg` as a documented primitive. Markdown under `content/docs/*.md`
→ parsed → rendered through the *same* doc primitives. Adding a content pipeline to the SSG
is an architecture decision, so it gets its own ADR + arch sign-off — **explicitly not v1.**
Trigger to revisit: docs exceed ~10 pages or non-engineers start editing them.

> Decision I need from arch: OK to keep v1 prose-in-TS and defer markdown to its own ADR?

---

## 3. How the gallery integrates with the registry

**One page per component** (`/ui/<name>`), plus an index grid at `/ui` — the shadcn model,
not a single mega-gallery. Rationale: deep-linkable, room per component for variants + the
`add` command + notes, and it scales as the registry grows.

**Data-driven from the registry — the gallery stays in lockstep automatically:**
- Routes + index are **enumerated from registry metadata** (`loadRegistry()` from
  `@nisli/ui`, the same source `scripts/sync.mjs` already uses). New registry component →
  new `/ui/<name>` page with zero route wiring. No hand-maintained component list to drift.
- Each page renders **live previews from the owned copy** in `src/nisli-ui/` (the
  honest-consumer path, exactly like the home sections) — never a workspace import.
- The `npx @nisli/ui add <name>` command + "you own this source file" note + deps come
  from registry metadata.

**What can't be auto-generated: the interesting demos.** Button's variant matrix, a working
Dialog, a populated Table — these are curated. v1 ships a hand-authored **examples map** for
the high-value components and a default "render with sensible defaults" preview for the rest;
filling in examples is incremental and never blocks a component from appearing.

So: **structure auto-derived (always complete), example content curated (grows over time).**

---

## 4. v1 vs later

**v1 — first real site (replaces the scaffold's stubs):**
1. Persistent nav + theme toggle as nisli components.
2. **Home** (framework-led): hero pitches `@nisli/core` — signals, tagged-template
   components, no build step, no vDOM, DI — with `@nisli/ui` as the second beat ("batteries
   included: shadcn-style components you own"); a framework hello-world; live component
   teasers. Replaces the 4 stubs. **Not** component-library-first.
3. **`/themes`**: color palette + tokens + typography + radius, light & dark side by side —
   cheap, high-signal, dogfoods the token layer.
4. **`/ui`** index + **`/ui/<name>`** for the top ~8–10 components with curated examples;
   every other registry component auto-listed with a default preview.
5. **`/docs`** landing + 4 core concept pages (`signals`, `templates`, `components`, `cli`)
   as nisli templates; the quick-start is a framework hello-world (signal + component +
   `html`), not an `@nisli/ui add` walkthrough.
6. **Multi-route build**: extend `build.ts` beyond the single `/` route (per-route body
   fragment through `buildStaticSite` → `writeRoute`, wrapped by the shell). *arch approved
   me taking this over as www owner.*

**Later:**
- Full docs coverage (DI, query, ssg, quick-start) + curated examples for *all* components.
- Markdown docs pipeline (own ADR) if volume warrants.
- `⌘K` search, copy-to-clipboard on code blocks, per-component "open in playground".
- `llms.txt` / `sitemap.xml` / RSS (blog has templates to port).

---

## 5. Deploy

Cloudflare **Workers Builds** (git-connected, like the blog): push to `main` → clean-env
build + deploy in ~60s. Build is self-contained (`pnpm install && pnpm --filter @nisli/www
build`), runs the `@nisli/ui` copy-in, and deploys via `wrangler deploy` with root dir
`packages/www`. Watched paths: `packages/www/**`, `packages/ui/**`, `packages/core/**`.
`pnpm --filter @nisli/www deploy` remains the manual escape hatch. Details in
[`README.md`](./README.md).

---

## Resolved with arch (review verdict)
1. **Docs authoring** — v1 as nisli-module prose with doc primitives; markdown pipeline
   deferred to its own ADR (tripwire: >~10 pages or non-engineer editors). ✅
2. **Multi-route `build.ts`/shell rework** — mine as www owner. ✅
3. **Folded SITE-1/SITE-2** — stub sections are disposable; authoritative inputs are the
   ticket specs (gallery = eng2's approved component list + SSG-safe open/closed states;
   hero/install/framework = the SITE-2 outline). ✅
4. **Identity** — framework site (react.dev/svelte.dev class), `@nisli/ui` as the second
   beat; shadcn model scoped to `/ui` + `/themes`. ✅
