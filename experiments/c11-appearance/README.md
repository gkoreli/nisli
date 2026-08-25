# c11-appearance — derived appearance, in real nisli components

**Throwaway prototype. Nothing here ships.** Parent record:
[`docs/worklists/nextgen/`](../../docs/worklists/nextgen/) (candidate C11).

## The question

> Can appearance be **derived** from declared meaning and context — with zero
> pixel values, zero colours and zero breakpoints in component source — for
> components the framework has never seen?

## Run it

```sh
pnpm --filter @nisli/experiment-c11-appearance dev   # http://127.0.0.1:5199
```

The page has four real pages (inbox, settings, data, marketing) and four context
switches (density, input, theme, width) plus a **`nisli check`** button that runs
the derived verification over whatever is currently on screen.

## The claim, checkable in one command

```sh
grep -nE '[0-9]+(px|rem|em)|#[0-9a-fA-F]{3,6}|@media' src/components.ts src/app.ts
```

Three matches, all accounted for: two are the deliberate `Escaped` component
(the escape hatch — it exists to be raw, and reports itself as `N601`), and one
is an English sentence in demo copy. **No component styles itself.** Every value
in the rendered UI comes from [`src/theme.css`](./src/theme.css) — the resolution
table — as a function of one inherited `--unit` plus the element's declared role.
The components declare only:

| declaration | meaning |
|---|---|
| `data-appearance` / `data-role` / `data-text` | what this **is** |
| `data-layout` / `data-grow` / `data-align` | how it **composes** |
| `data-priority` / `data-collapse` | what matters **least**, and what to do when space runs out |

There is no `size` prop and **no `className` prop** anywhere in
[`src/components.ts`](./src/components.ts): the caller cannot make an appearance
decision because no channel exists through which to make one.

## Layout

| path | role | share of the bet |
|---|---|---|
| [`src/theme.css`](./src/theme.css) | the resolution table — the only place any number, colour or radius exists | ~40% |
| [`src/components.ts`](./src/components.ts) | real `@nisli/core` components; no `className`, no sizes | ~45% (exclusivity + vocabulary) |
| [`src/appearance.ts`](./src/appearance.ts) | `solve()`/`fit()` (measured tier, ~35 lines), `check()` (verification byproduct), `explain()` (provenance) | ~15% |
| [`src/app.ts`](./src/app.ts) | four pages plus the context harness | — |

## Measured results

Twelve context combinations, headless Chromium, measured with
`getComputedStyle` / `getBoundingClientRect`.

### Derivation — one inherited variable produces every value

| context | `--unit` | control height | padding-inline | font-size |
|---|---|---|---|---|
| comfortable | 4px | 36px | 16px | 14px |
| compact | 3px | 27px | 12px | 13px |
| dense | 2px | 18px | 8px | 12px |
| touch | 5px | 45px | 20px | 14px |

Same component source in every row. Compare the shipped
`packages/ui/registry/default/ui/button.ts`, where those four results need four
hand-written class sets **and a caller who picked one by looking at a design**.

### Fit — settled everywhere, no breakpoints anywhere

| context | fit state / collapsed groups | overflow menus shown | canvas overflow | document overflow | findings |
|---|---|---|---|---|---|
| inbox / comfortable / 1080 | settled ×5 / 0 | 0 | 0px | 0px | none |
| inbox / comfortable / 480 | settled ×5 / 1 each row | 4 | 0px | 0px | none |
| inbox / comfortable / 320 | settled ×5 / 1–2 | 5 | 0px | 0px | none |
| inbox / dense / 320 | settled ×5 / 1 | 4 | 0px | 0px | none |
| inbox / touch / 360 | settled ×5 / 1–2 | 5 | 0px | 0px | none |
| inbox / dark / 720 | settled ×5 / 0 | 0 | 0px | 0px | none |
| settings / compact / 720 | settled / 0 | 0 | 0px | 0px | 1 × N601 (intentional escape) |
| settings / touch / 360 | settled / 1 | 1 | 0px | 0px | 1 × N601 (intentional escape) |
| data / comfortable / 720 | settled / 0 | 0 | 0px | 0px | none |
| data / dense / dark / 480 | settled / 0 | 0 | 0px | 0px | none |
| marketing / comfortable / 1080 | settled / 0 | 0 | 0px | 0px | none |
| marketing / comfortable / 320 | settled / 0 | 0 | 0px | 0px | none |

**Zero overflow in twelve contexts with no media query in the codebase.** The
only finding is the escape hatch reporting itself, which is the escape hatch
working.

### Visual record

| context | file |
|---|---|
| inbox, 1080 | [`proof/inbox-1080.webp`](./proof/inbox-1080.webp) |
| inbox, 320 (Star/Archive → `⋯`, excerpt + time truncated, Reply survives) | [`proof/inbox-320.png`](./proof/inbox-320.png) |
| inbox, touch, 360 (everything larger, same source) | [`proof/inbox-touch-360.png`](./proof/inbox-touch-360.png) |
| inbox, dark, 720 | [`proof/inbox-dark-720.webp`](./proof/inbox-dark-720.webp) |
| data, dense (same table twice, two contexts) | [`proof/data-dense-720.webp`](./proof/data-dense-720.webp) |
| settings, compact | [`proof/settings-compact-720.webp`](./proof/settings-compact-720.webp) |
| marketing | [`proof/marketing-1080.webp`](./proof/marketing-1080.webp) |

## Findings

**F1 — Derivation holds inside real components, with zero runtime cost.** Values
resolve through `@nisli/core` component boundaries and layout-transparent hosts
via inherited custom properties. No JavaScript participates.

**F2 — The measured tier is genuinely small.** `solve()` + `fit()` is ~35 lines
including lifecycle. Registering it in a component is one line: `fit(host)`.

**F3 — A colour-changing context must paint its own backdrop.** The first run
switched `--fg` for dark mode without setting a background on the same node, and
the derived checker immediately reported `contrast 1.10:1 (rgb(244,244,245) on
rgb(255,255,255))` — light text on white, which I had not noticed. Rule added to
`theme.css`: any context axis touching `--fg` also owns `--s1`. **This is the
thesis working on its author: a real appearance bug, caught by a check nobody
wrote, before any human looked.**

**F4 — A checker must assert rendered-ness before measuring.** The same run
produced ten false `N650` hit-target failures by measuring *collapsed*
(`display: none`) candidates as `0×0`. Matches the round-2 corpus finding
"the oracle itself was wrong" (three recorded instances). Fixed with
`checkVisibility()` as a precondition on every measurement.

**F5 — `truncate` is the wrong strategy for short atomic values.** At 320px the
timestamps degraded to `1…`, `Y…`, `M` — technically fitting, visually useless.
The engine did what it was told; the author chose the wrong strategy. Two
consequences: the strategy set needs `hide` alongside `truncate` and `menu`, and
the checker can derive a warning ("truncated below N characters — prefer hide"),
which is authoring feedback no framework currently gives.

**F6 — nisli's own diagnostics debugged this experiment.** `onCleanup()` inside
an `onMount()` callback threw `N402` with an exact message, stamped
`data-nisli-error` on the host, and dispatched a `nisli-error` event carrying
`{tag, phase, code, message}` — which is how the bug was found in one step. ADR
0030.2 T6, doing its job on the author.

**F7 — The escape hatch behaves as designed.** `app-escaped` raw-styles a
subtree; it is outlined in the UI, reported once as `N601`, and excluded from the
guarantees. Possible, explicit, counted.

## What this does NOT prove

- **No SSG pre-solve.** The static tier should be resolvable at build time
  (`@nisli/ssg`); untested here.
- **No byte budget.** `solve()`/`fit()` were not measured min+gzip against the
  10KB core ceiling.
- **No flash-of-unfit measurement.** The first paint before the measured pass is
  the real UX risk; not quantified.
- **Overflow menus are stubs.** No popover, no keyboard, no ARIA — the collapsed
  actions become unreachable, which in a real implementation is a blocker.
- **Chromium only**, and the vocabulary is small on purpose: four pages exercised
  it, not a whole product.
- **Nothing about beauty.** The table produces consistency. Whether an authored
  table can be made genuinely beautiful is the open question F5 hints at and
  §7.16 of the scratchpad names.

## Packaging note

This is a workspace package (`experiments/*` is in `pnpm-workspace.yaml`) so it
can link `@nisli/core` and its own vite. It defines **only** a `dev` script, and
`pnpm -r <script>` skips packages that do not define that script — so
`pnpm build`, `pnpm test` and `pnpm typecheck` at the root never touch it.
Nothing in `packages/*` references it, and deleting this directory affects
nothing.
