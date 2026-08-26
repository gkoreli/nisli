# c11-appearance — appearance derived from meaning and context

**Throwaway prototype. Nothing here ships.** Parent record:
[`docs/worklists/nextgen/`](../../docs/worklists/nextgen/) (candidate C11,
decision record [ADR 0032](../../docs/adr/0032-derived-appearance-package.md)).

## The question

> Can appearance be **derived** from declared meaning and context — with zero
> pixel values, zero colours and zero breakpoints in component source — for
> components the framework has never seen?

## Current answer

**Yes, at prototype scale, and the cost is in the checker rather than the
components.** 240 of 240 context combinations pass **ten** independent
assertion paths in real Chromium — including a pass that **opens every overlay**
— with a proof that self-tests: every path is verified capable of failing before
the run is trusted.

```
PASS — 240/240 combinations clean, 0 assertion failures, 0 incomplete findings, 0 page errors
overlay pass — 110 overlay(s) opened, measured and closed across 240 combination(s)
```

The honest headline from building it: **eight of the fourteen defects found were
in the oracle, not the page** (§Findings). An appearance checker is easy to write
and hard to make truthful, and almost every one of those eight was silent or
misattributed until something measured it three different ways.

## Run it

```sh
pnpm --filter @nisli/experiment-c11-appearance dev      # http://127.0.0.1:5199
pnpm --filter @nisli/experiment-c11-appearance verify   # 141 tests behind tsc, no browser
node proof/geometry-proof.mjs                           # 240 cells in Chromium
node proof/geometry-proof.mjs --self-test                # prove all 10 paths can fail
node proof/state-sweep.mjs                               # declared states x contexts
node proof/no-values-guard.mjs                           # the exclusivity invariant
node proof/declaration-guard.mjs                         # the table checks itself
```

Every proof script takes `--self-test`. Four pages (inbox, settings, data,
marketing), four context axes (density, input, theme, width), seven declared
states, and a **Run check** button that runs the derived checks over whatever is
on screen.

## The claim, checkable in one command

```sh
node proof/no-values-guard.mjs
# PASS — 53 files carry no length, no colour, no media query, no className and
#        no size prop. Every value in the rendered UI comes from src/theme/.
```

The guard proves it is not passing vacuously: it still matches 120 length and 34
colour literals inside `src/theme/`, where they belong. Components declare only:

| declaration | meaning |
|---|---|
| `data-appearance` / `data-role` / `data-text` | what this **is** |
| `data-layout` / `data-grow` / `data-align` / `data-clip` | how it **composes** |
| `data-priority` / `data-collapse` | what matters **least**, and what to do when space runs out |

No `size` prop and no class-name prop exists anywhere in `src/ui/`. That
exclusivity is not tidiness — it is what makes derivation, checking, consistency
and provenance possible at all.

## Architecture

Ports and adapters, so the domain can graduate unchanged if the bet survives,
and so the solver and every check are testable without a browser.

```
src/appearance/contracts.ts        FROZEN seam: vocabulary, Box, Bounds, Metrics, Mutator, Inspector, Rule
src/appearance/fit/                candidates · strategies · solver   (pure domain)
                                   dom                                (the only DOM reader/writer)
                                   observe                            (nisli lifecycle binding)
src/appearance/diagnostics/        15 rules as pure generic factories over Inspector
                                   observe (Lens) · rule (composition) · codes (append-only)
                                   runner · report · admitted · dom
src/appearance/explain.ts          provenance: why is this element this size
src/theme/                         tokens → structure → roles → states   (THE resolution table)
src/ui/                            8 primitives + 5 patterns, one file each
src/app/                           4 pages + the context harness + declared states
test/                              141 tests via fakes, behind a tsc gate
proof/                             240-cell matrix · state sweep · values guard · declaration guard
```

Two named geometries, because confusing them cost five defects: **`Box`** is the
padding box for *containment* claims, **`Bounds`** the border box plus origin for
*pressability and extent* claims. A **`Lens`** has exactly two selectors —
`painted()` is the only route to geometry, `declared()` is for claims about what
the author wrote — which makes "measuring an unrendered node" unreachable rather
than merely discouraged.

Weighting, so the demo is not mistaken for the bet: the resolution table is ~40%
of the idea, exclusivity ~25%, the vocabulary ~20%, verification ~10%, and the
measured fit pass — the only novel runtime code, ~35 lines — is ~5%.

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

### Fit — 240 cells, ten assertion paths

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
| `overlay/shred` | no label inside an **open** panel is broken mid-word | 240/240 |
| `overlay/boxless` | an open panel owns a box that can be measured | 240/240 |
| `overlay/unreachable` | every item in an open panel can be pressed and focused | 240/240 |

The overlay pass opens **110 overlays per run** and costs **+0.3s on 40.6s** —
under one percent, so it runs on the full matrix with no subsetting.

Plus F6 reachability driven end to end: trigger painted, `aria-haspopup`,
`aria-expanded` flipping, `aria-controls` naming the panel, items reachable,
focus moved, Escape returning focus.

### The state sweep — content hostility pays, lifecycle does not

Seven declared states × a context subset, 100 cells in 3.4s:

```
loading 0 · error 0 · empty 0 · single 0 · many 0 · hostile 5
RESULT — 5 distinct defect(s) across 21 witness cell(s), each silent on the
         ready state in the same context
```

**Every defect came from hostile content; lifecycle states found zero across
1,200 cells.** The states most often described as "where UI rots because nobody
looks" were clean everywhere. Keep the hostile corpus; do not keep a lifecycle
sweep as a standing gate at this surface size. Keep the *declaration* regardless
— rendering those states produced three findings about what the vocabulary
cannot say, and no sweep of any size could have produced those.

### The declaration guard — the table checks itself

```
PASS — every one of 285 declarations in src/theme parses, substitutes and
       computes to what it says, and every one of 34 legal values is exercised
       by the demo. 0 undecidable, 7 unmatched selectors (warnings).
```

Four classes, falsified 12/12. Class A substitutes custom properties for what
they *resolve to* before asking `CSS.supports()`, because substitution happens at
computed-value time — which is exactly where a lone `calc()` was being rejected.
Class D fails when a legal vocabulary value is rendered nowhere, since a value
nothing renders is a value no rule has ever run against.

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
| marketing, dense, 320 — one column, words intact, four visibly different derived button sizes | [`proof/marketing-dense-320.webp`](./proof/marketing-dense-320.webp) |

## Findings

### About the idea

**F1 — Derivation holds inside real components, with zero runtime cost.** Values
resolve through `@nisli/core` component boundaries and layout-transparent hosts
via inherited custom properties. No JavaScript participates.

**F2 — The measured tier is genuinely small.** `solve()` plus `fit()` is ~35
lines including lifecycle; registering it in a component is one line.

**F9 — Derivation from one unit is NOT automatically self-consistent.**
`[data-layout=grid]` derived its minimum track from `--unit`, so the track shrank
with density while the content floors inside it did not. At dense/320 the table
sized a track at 62px of usable space and simultaneously demanded a 76px control
inside it — and dense, the context whose whole job is fitting more in less, was
the only one that overflowed. The rule it forces: *a floor must propagate through
every derivation that bounds it.* Consequence: the table needs its own
consistency check, so "the framework checks the UI" grows a second half —
**the framework checks the table**.

**F10 — A solver must measure the world it creates.** The solver declared a row
`unsatisfiable` while a declared strategy was unspent. The missing 2–3px was its
own overflow trigger, revealed after the loop and therefore never in the geometry
any pass measured.

**F11 — Priority orders WHEN a strategy is spent, never WHETHER.**

**F12 — A strategy can be spent for nothing (N730).** `data-collapse="truncate"`
is a no-op on a single unbreakable token: the table resolves it to `nowrap` plus
an ellipsis, and `nowrap` makes min-content equal the whole text. Measured at
433px needed in a 318px container after four degradations, with the truncated
element at 375 wide and 375 of content — it never shrank. The third direction on
F9/F11: the author declared right, the solver executed right, and the *table*
implemented a strategy that returns zero on that content.

**F13 — A clip margin is the ancestor's problem.** `overflow-clip-margin`
extends ink overflow, and ink overflow is scrollable overflow in every ancestor,
so a two-pixel decorative bleed crushed its own parent (320 client / 322 scroll)
on every ancestor forever. Deleted rather than exempted.

### About the checker — eight oracle bugs, which is the real cost signal

**F4 — Measuring unrendered nodes.** Collapsed nodes measured 0×0 and produced
ten false hit-target failures. Rendered-ness is now a precondition of every
measurement, enforced by the lens rather than by discipline.

**F8 — A container-only overflow test cannot see a crush.** A row measured
`scrollWidth 318 === clientWidth 318` — "settled" — while a child sat at 32/71
and painted over its neighbour. **Buttons visibly overlapped while the oracle
reported success.**

**N670's first version was anti-correlated with its own defect.** It fired when
children escaped an overflowing row (where nothing collides) and was silent at
318/318 when children were crushed to fit (the actual collision).

**N650 measured the wrong box.** 710 findings were the padding box; a hit target
is what a finger presses, so it is the border box. This is why `Bounds` exists.

**N690 repeated that mistake inside the rule written to prevent it**, dividing a
padded box height by a line height.

**N700 shipped DEAD.** Its selector said `[data-surface]` where the vocabulary
spells it `[data-appearance="surface"]`, so it matched nothing and reported a
clean page. Unit tests passed because the fixtures were invented from the same
wrong assumption; the matrix passed because a rule matching nothing produces no
findings; `tsc` passed because a selector is a string. **Silence read as
success.** `test/reachability.test.ts` exists because of this.

**Widening N690 to control labels fired on a clean 44px icon button** — a
control's box is a hit *target*, and the slack is the target floor doing its job.
N650's mistake in different clothes. Reverted: the sound fix needs a text-box
measurement the port does not expose.

**N715 exempted out-of-flow elements but walked into their descendants**, so a
button inside an open popover was reported as painting above an ancestor it is
not laid out in. N710 had been given exactly that exemption an hour earlier. **A
fix applied to one rule and not the rule beside it is its own defect class.**

**And one in a self-test, which is the most expensive kind.** The
`overlay/boxless` fixture could no longer inject its defect — a top-layer element
is absolutely positioned and therefore blockified, so `display: contents
!important` computes to `block`. The harness reported the **check** as blind when
the truth was that the **injection** had failed.

**The principle they share, now stated in the types rather than in a chat log: a
check must measure the box its claim is about, and a check that cannot measure
must say so rather than pass.**

### About agents building this

**Three correct measurements produced three wrong causal stories** — a
"genuinely unsatisfiable" row that was really the solver's unrevealed
affordance, a "single word cannot wrap" claim that missed `overflow-wrap:
anywhere` releasing min-content, and a "cross-axis squeeze" that was really the
oracle reading the padding box. Every wrong *why* came from an agent; every right
*where* came from a measurement.

## What this does NOT prove

- **No SSG pre-solve.** The static tier should resolve at build time; untested.
  Measured consequence: the flash of unfit is **zero composited frames**
  client-rendered, but **9–10 frames / 69–87ms** on a 100ms hydration budget.
- **No byte budget.** `solve()`/`fit()` were never measured min+gzip against the
  10KB core ceiling.
- **Chromium only.** No Firefox or WebKit run.
- **Small surface.** Four pages exercised the vocabulary, not a product.
- **Nothing about beauty.** The table produces consistency. Whether an authored
  table can be made genuinely beautiful is still the open question, and F9 shows
  a table can be internally contradictory while every value in it looks
  reasonable.
- **One deferred item:** bare markup inside a flush surface, with no wrapper to
  promote, is still clipped. That needs the mutator to insert an element. It is
  no longer *silent* — N710 reports it — which is the actual change: the loss
  became loud, and one shape of it became derivable.

## Packaging

`experiments/*` is in `pnpm-workspace.yaml` so a prototype can link
`@nisli/core` and its own tooling. It defines only `dev`, `verify`, `proof` and
`lint:values` — never `build`, `test` or `typecheck` — and `pnpm -r <script>`
skips packages that do not define the script, so the root gates never see it.
`pnpm typecheck` reports "Scope: 6 of 7 workspace projects". The experiment's own
type gate runs inside `verify`, because the absence of one is how a real type
error survived. Nothing in `packages/*` references this directory; deleting it is
a no-op.

`proof/shots/` is gitignored — actually, now, having previously claimed to be
while tracking 240 files that every run rewrote. The committed visual record is
the hand-picked set above.
