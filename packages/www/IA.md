# nisli.dev — Information Architecture (proposal, `eng3` → arch review)

**Status**: proposed — awaiting arch review before page-building begins.
**Scope**: the full nisli website (`packages/www`, `@nisli/www`), deployed live at
**https://nisli.dev**. Modeled on ui.shadcn.com's `www` and Goga's blog
(`/Users/goga/Documents/goga/blog`). Everything here is authored in nisli, composed from
`@nisli/ui` (owned copies via the copy-in CLI), rendered static by `@nisli/ssg`.

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
| `/`                | Home — hero, live teasers, install, framework pitch | hand-authored sections |
| `/docs`            | Docs landing — what is nisli, install, quick start  | README + ADRs          |
| `/docs/<topic>`    | One page per concept (see §2)          | README + ADRs                  |
| `/ui`              | Component gallery index (grid of all)  | registry (auto)                |
| `/ui/<component>`  | Per-component page (shadcn-style)       | registry + curated examples    |
| `/themes`          | Token / design showcase, light+dark    | registry `theme.css`           |

This is the shadcn shape exactly: **home / docs / components (one page each) / themes**.

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

**v1 — docs authored as nisli static-template modules (no new pipeline).**
Each doc page is a `.ts` module returning `staticHtml` (`@nisli/core/static`, the blog's
approach), composed from a small set of **doc primitives** — `Prose`, `CodeBlock`,
`PropsTable`, `ComponentPreview`, `Callout` — built from nisli + `@nisli/ui`. This is the
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
2. **Home**: real hero / install / framework / live component teasers (replace the 4 stubs).
3. **`/themes`**: color palette + tokens + typography + radius, light & dark side by side —
   cheap, high-signal, dogfoods the token layer.
4. **`/ui`** index + **`/ui/<name>`** for the top ~8–10 components with curated examples;
   every other registry component auto-listed with a default preview.
5. **`/docs`** landing + 4 core concept pages (`signals`, `templates`, `components`, `cli`)
   as nisli templates.
6. **Multi-route build**: extend `build.ts` beyond the single `/` route (apply the shell
   per route, `writeRoute` each). *This touches the pipeline/shell that ADR 0024 assigned to
   arch — I propose taking it over as www owner; flagging for your OK.*

**Later:**
- Full docs coverage (DI, query, ssg, quick-start) + curated examples for *all* components.
- Markdown docs pipeline (own ADR) if volume warrants.
- `⌘K` search, copy-to-clipboard on code blocks, per-component "open in playground".
- `llms.txt` / `sitemap.xml` / RSS (blog has templates to port).

---

## Open questions for arch
1. Docs authoring: OK to ship v1 as prose-in-TS and defer markdown to its own ADR? (§2)
2. `build.ts`/shell multi-route rework was arch's per ADR 0024 — hand it to me as www owner? (§4.6)
3. Any of eng1/eng2's folded SITE-1/SITE-2 content I should treat as authoritative vs. rework?
