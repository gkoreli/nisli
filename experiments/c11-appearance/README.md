# c11-appearance — appearance derived from meaning and context

**Throwaway prototype. Nothing here ships.** Parent record:
[`docs/worklists/nextgen/`](../../docs/worklists/nextgen/) (candidate C11).

## The question

> Can appearance be **derived** from declared meaning and context — with zero
> pixel values, zero colours and zero breakpoints in component source — for
> components the framework has never seen?

## Current answer

**Yes, at prototype scale, and the cost is in the checker rather than the
components.** 240 of 240 context combinations pass seven independent assertion
paths in real Chromium, with a proof that self-tests: all seven paths are
verified capable of failing before the run is trusted.

```
PASS — 240/240 combinations clean, 0 assertion failures, 0 incomplete findings, 0 page errors
```

The honest headline from building it: **five of the defects found were in the
oracle, not the page** (§Findings). An appearance checker is easy to write and
hard to make truthful, and every one of those five was silent or misattributed
until something measured it three different ways.

## Run it

```sh
pnpm --filter @nisli/experiment-c11-appearance dev          # http://127.0.0.1:5199
pnpm --filter @nisli/experiment-c11-appearance verify       # 128 domain tests, no browser
node proof/geometry-proof.mjs                               # 240 cells in Chromium
node proof/geometry-proof.mjs --self-test                   # prove the proof can fail
node proof/no-values-guard.mjs                              # the exclusivity invariant
```

Four pages (inbox, settings, data, marketing), four context axes (density,
input, theme, width), and a **Run check** button that runs the derived checks
over whatever is on screen.

## The claim, checkable in one command

```sh
node proof/no-values-guard.mjs
# PASS — 45 files carry no length, no colour, no media query, no className and
#        no size prop. Every value in the rendered UI comes from src/theme/.
```

The guard also proves it is not passing vacuously: it matches 90 length literals
and 34 colour literals inside `src/theme/`, where they belong. Components
declare only:

| declaration | meaning |
|---|---|
| `data-appearance` / `data-role` / `data-text` | what this **is** |
| `data-layout` / `data-grow` / `data-align` | how it **composes** |
| `data-priority` / `data-collapse` | what matters **least**, and what to do when space runs out |

No `size` prop and no class-name prop exists anywhere in `src/ui/`. That
exclusivity is not tidiness — it is what makes derivation, checking, consistency
and provenance possible at all.

## Architecture

Ports and adapters, so the domain can graduate into `@nisli/core` unchanged if
the bet survives, and so the solver and every check are testable without a
browser.

```
src/appearance/contracts.ts        FROZEN seam: vocabulary, Box, Metrics, Mutator, Inspector, Rule
src/appearance/fit/                candidates · strategies · solver   (pure domain)
                                   dom                                (the only DOM reader/writer)
                                   observe                            (nisli lifecycle binding)
src/appearance/diagnostics/        10 rules as pure generic factories over Inspector
                                   codes (append-only) · runner · report · admitted · dom
src/appearance/explain.ts          provenance: why is this element this size
src/theme/                         tokens → structure → roles → states   (THE resolution table)
src/ui/                            8 primitives + 5 patterns, one file each
src/app/                           4 pages + the context harness
test/                              78 domain tests via fakes
proof/                             240-cell Chromium matrix + self-test + values guard
```

Weighting, so the demo is not mistaken for the bet: the resolution table is
~40% of the idea, exclusivity ~25%, the vocabulary ~20%, verification ~10%, and
the measured fit pass — the only novel runtime code, ~35 lines — is ~5%.

## Measured results

### Derivation — one inherited variable produces every value

| context | `--unit` | control height | padding-inline | font-size |
|---|---|---|---|---|
| comfortable | 4px | 36px | 16px | 14px |
| compact | 3px | 27px | 12px | 13px |
| dense | 2px | 18px | 8px | 12px |
| touch | 4px × 1.25 | 45px | 20px | 14px |
| dense + touch | 2px × 1.25 | 44px (floor) | — | — |

Axes compose. Same component source in every row.

### Fit — 240 cells, seven assertion paths

4 pages × 3 densities × 2 inputs × 2 themes × 5 widths (1080/720/480/360/320):

| assertion | what it proves | result |
|---|---|---|
| `declared` | every appearance declaration sits on an element that owns a box | 240/240 |
| `fit` | every `[data-fit]` container reports `settled` | 240/240 |
| `afford` | a collapsed group's trigger is painted and reachable | 240/240 |
| `crush` | nothing paints outside its own box | 240/240 |
| `overlap` | no two rendered siblings' boxes intersect | 240/240 |
| `document` | the page never exceeds the viewport | 240/240 |
| `check` | the derived rules report no failures | 240/240 |

Plus F6 reachability driven end to end: trigger painted, `aria-haspopup`,
`aria-expanded` flipping, `aria-controls` naming the panel, menu items
reachable, focus moved, Escape returning focus.

### Visual record

| context | file |
|---|---|
| inbox, 1080 | [`proof/inbox-1080.webp`](./proof/inbox-1080.webp) |
| inbox, 320 — toolbar and row actions collapsed, timestamps hidden, excerpts truncated, Reply survives | [`proof/inbox-320.png`](./proof/inbox-320.png) |
| inbox, touch, 360 — same source, everything larger | [`proof/inbox-touch-360.webp`](./proof/inbox-touch-360.webp) |
| inbox, dark, 720 | [`proof/inbox-dark-720.webp`](./proof/inbox-dark-720.webp) |
| data, dense — same table twice, two contexts | [`proof/data-dense-720.webp`](./proof/data-dense-720.webp) |
| settings, compact — including the escape hatch reporting itself | [`proof/settings-compact-720.webp`](./proof/settings-compact-720.webp) |
| marketing, 1080 | [`proof/marketing-1080.webp`](./proof/marketing-1080.webp) |
| marketing, dense, 320 — the F9 case after the fix: one column, words intact, four visibly different derived button sizes | [`proof/marketing-dense-320.webp`](./proof/marketing-dense-320.webp) |

## Findings

### About the idea

**F1 — Derivation holds inside real components, with zero runtime cost.** Values
resolve through `@nisli/core` component boundaries and layout-transparent hosts
via inherited custom properties. No JavaScript participates.

**F2 — The measured tier is genuinely small.** `solve()` plus `fit()` is ~35
lines including lifecycle; registering it in a component is one line.

**F9 — Derivation from one unit is NOT automatically self-consistent.** The
sharpest finding, and a limit on the thesis rather than a bug.
`[data-layout=grid]` derived its minimum track from `--unit`, so the track shrank
with density, while the content inside it had floors the same table declares and
those do not shrink. At dense/320 the table sized a track at 62px of usable space
and simultaneously demanded a 76px control inside it — and dense, the context
whose whole job is fitting more in less, was the only context that overflowed.
F8 was the browser resolving an impossible constraint badly; **F9 is the
resolution table stating one.** The rule it forces: *a floor must propagate
through every derivation that bounds it, not only to the leaf that declares it.*
Consequence for the bet: the table needs its own static consistency check, so
"the framework checks the UI" grows a second half — "the framework checks the
table".

**F10 — A solver must measure the world it creates.** The solver declared a row
`unsatisfiable` while a declared strategy was unspent. The missing 2-3px was its
own overflow trigger, revealed after the loop and therefore never in the geometry
any pass measured. Now revealed on the first `menu` degradation, and asserted by
a standing proof path (`afford`).

**F11 — Priority orders WHEN a strategy is spent, never WHETHER.**
`unsatisfiable` means every declared strategy is spent and it still does not fit
— nothing weaker.

### About the checker — five oracle bugs, which is the real cost signal

**F4 — Measuring unrendered nodes.** Collapsed (`display: none`) candidates
measured 0×0 and produced ten false hit-target failures. Rendered-ness is now a
precondition of every measurement.

**F8 — A container-only overflow test cannot see a crush.** Flex children default
to shrinking, so a row measured `scrollWidth 318 === clientWidth 318` — "settled"
— while a child sat at 32/71 and painted over its neighbour. **Buttons visibly
overlapped while the oracle reported success.** The fit test is now
`overflows(container) || crushed(container)`, the theme forbids shrinking except
where declared, and N660 exists so this class can never be silent again.

**N670's first version was anti-correlated with its own defect.** The
sum-of-children comparison fired when children escaped an overflowing row (where
nothing collides) and was silent at 318/318 when children were crushed to fit
(the actual collision). Deleted on evidence: a container measurement cannot see a
collision between its children; only the children can.

**N650 measured the wrong box.** 710 findings across the matrix were the padding
box — every border box cleared the 44px floor, and 45 − 2px of border = 43. A hit
target is what a finger presses, so it is the border box; a crush is content
against its container, so it is the padding box.

**N690 repeated the same mistake in the rule written to prevent it.** The
shredded-word check divided the *padded* box height by the line height, so every
padded table header reported "1 word across 2 lines". Caught by the matrix on its
first run, within minutes of being added.

**The principle all five share, now stated in the code rather than in a chat
log: a check must measure the box its claim is about.** And the corollary that
matters for the bet: five oracle bugs to four page bugs means the expensive half
of "the framework checks the UI" is the checker's own truthfulness — which is
exactly the kill criterion this experiment was built to test.

### About agents building this

**Three correct measurements produced three wrong causal stories** — a
"genuinely unsatisfiable" row that was really the solver's unrevealed
affordance, a "single word cannot wrap" claim that missed `overflow-wrap:
anywhere` releasing min-content, and a "cross-axis squeeze" that was really the
oracle reading the padding box. Every wrong *why* came from an agent; every
right *where* came from a measurement. A derived oracle that reports a location
and a magnitude is far more trustworthy than the narrative anyone wraps around
it.

## What this does NOT prove

- **No SSG pre-solve.** The static tier should resolve at build time; untested.
- **No byte budget.** `solve()`/`fit()` were never measured min+gzip against the
  10KB core ceiling.
- **No flash-of-unfit measurement.** The first paint before the measured pass is
  the real UX risk and is not quantified here.
- **Chromium only.** No Firefox or WebKit run.
- **Small surface.** Four pages exercised the vocabulary, not a product.
- **Nothing about beauty.** The table produces consistency. Whether an authored
  table can be made genuinely beautiful is still the open question, and F9 shows
  the table can even be internally contradictory while every value in it looks
  reasonable.
- **The flush surface's clip is derived now, but only for one shape.** This used
  to read "one deliberate open item: the flush surface clips a wide table rather
  than scrolling it (silent loss); the scroll-region fix was specified and is
  not fully landed." What landed is narrower than "fixed" and the difference
  matters. The theme now derives a scroll region for a clipping surface's single
  in-flow child, so the demo table is reachable rather than deleted — measured on
  the real component at 360: 0 lost, the full 477 of overhang reachable,
  `scrollLeft` 477/477, `tabindex="0"` and `role="region"` named by the caption,
  rounded-corner clip intact. `data-scroll-region` was deleted from the call site
  and `data-clip="trim"` added, so the author vocabulary did not grow.
  What is still open: **bare markup inside a flush surface — no component
  wrapper to promote — is still clipped.** That is variant A4, where the engine
  generates the wrapper itself, and it is deferred because the mutator in
  `appearance/fit/dom.ts` only sets attributes and cannot insert an element. A4
  measured identically to the variant that landed, so this is a dependency and
  not a design question. The real change is therefore not that the loss stopped:
  **the loss became loud (N710) and one shape of it became derivable.**
- **The resolution table does not check its own declarations.** Two declarations
  in this round resolved to something other than what they said, and every
  safety net here was blind to both: `overflow-clip-margin: calc(var(--unit)/2)`
  is silently rejected by Chromium and computes to zero, and `overflow-y: clip`
  beside `overflow-x: auto` computes to `hidden`. The values guard passes because
  there is no literal, `tsc` passes because it is CSS, and the matrix passes
  because a declaration that does nothing is not a defect anyone declared. This
  is F9's sibling from a second direction — F9 was the table stating an
  impossible constraint, these are the table stating a rejected one — and it is
  the second independent argument that "the framework checks the UI" needs the
  half where the framework checks the table.

## Packaging

`experiments/*` is in `pnpm-workspace.yaml` so a prototype can link
`@nisli/core` and its own tooling. It defines only `dev`, `verify`, `proof` and
`lint:values` — never `build`, `test` or `typecheck` — and `pnpm -r <script>`
skips packages that do not define the script, so the root gates never see it.
`pnpm typecheck` reports "Scope: 6 of 7 workspace projects". Nothing in
`packages/*` references this directory; deleting it is a no-op.

`proof/shots/` is gitignored: a run writes 240 screenshots that are stale
immediately. The committed visual record is the hand-picked set above.
