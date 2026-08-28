# @nisli/recipes

A recipe book, built to find out whether `@nisli/intent`'s vocabulary is enough
to build an application from — by someone who reads only the package README and
[`CAPABILITIES.md`](../intent/CAPABILITIES.md) and never opens the stylesheet.

**Private, not published.** It is a consumer, not a library. Every place the
vocabulary ran out is logged in [`GAPS.md`](./GAPS.md); that file is the
deliverable, the app is the instrument.

## What it does

| route | page | what it exercises |
|---|---|---|
| `/` | recipe grid with search and tag filter | `grid`, `wrap`, `field`, a measured meta row per card |
| `/recipes/:id` | ingredients, method, a toolbar | `table`-free lists, the `menu` strategy degrading Share → Print → Add → Cook |
| `/recipes/:id/cook` | one step at a time | a page that declares its own context: `touch` + `comfortable` |
| `/shopping` | aggregated ingredient table | `table`, `field` checkboxes, truncating provenance |

The header carries the three context axes as live settings, so every page can be
seen in every density, input mode and theme without leaving it.

## The invariant

No file under `src/` contains a length, a colour, a media query, a class
attribute or an inline style, and none writes a `data-*` attribute the theme
does not answer to. `pnpm lint:values` proves it, reading the attribute list
from `@nisli/intent`'s own `contracts.ts` rather than a copy.

## Run

```sh
pnpm --filter @nisli/recipes dev          # http://127.0.0.1:5177
pnpm --filter @nisli/recipes typecheck
pnpm --filter @nisli/recipes lint:values
```

In development `window.__rb` exposes `check()`, `explain()`, `solveAll()` and
the reporters from `@nisli/intent/devtools`, so "is this UI wrong" can be asked
of whatever is on screen from the console or a probe. The production bundle
carries none of it.

## Status (2026-08-27)

Client-rendered. All four pages measure clean at 1200px and 360px in Chromium:
zero findings, zero console errors, no sideways scroll — with one honest
`undecidable` (N680) on a disabled button's contrast, logged as G6.

Not yet: a static build. The static tier would be correct in pre-rendered
output with no JavaScript; the measured tier would show the known flash-of-unfit
until hydration (`@nisli/intent` README, *Limits*). Wiring `@nisli/ssg` is the
next step, and the point of doing it here is to see that flash in a real app.
