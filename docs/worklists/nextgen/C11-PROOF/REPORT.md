# C11 proof run — derived appearance and solved fit, measured

**Date**: 2026-08-25 · **Fixture**: [`index.html`](./index.html) ·
**Visual**: [`proof.webp`](./proof.webp)
**Parent**: [`../NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) §5 round 5,
[`../C11-EXCLUSIVITY-AND-DERIVATION.md`](../C11-EXCLUSIVITY-AND-DERIVATION.md)

Run in headless Chromium via the browser tool, 1100×1400 viewport, measured with
`getComputedStyle` and `getBoundingClientRect`. The fixture is plain CSS +
vanilla JS on purpose — it tests the *mechanism*, not a nisli integration.

## What the fixture asserts

One component (`MessageRow`) authored with **zero pixel values, zero
breakpoints, zero media queries**. It declares only: structure (`layout`,
`grow`), semantic roles (`appearance`, `text`), which parts matter least
(`priority`), and what should happen to them when space runs out
(`collapse="menu" | "truncate"`). Rendered into four contexts that differ only
by an inherited context attribute and the container's width.

## Measured: derivation (static tier, zero JS)

Same button markup, four contexts, each behind a `display: contents` host —
the exact layout-transparent host shape `transparentHost()` produces:

| context | inherited `--ui-unit` | height | padding-inline | font-size | resolved through `display:contents` |
|---|---|---|---|---|---|
| comfortable | 4px | 36px | 16px | 14px | yes |
| compact | 3px | 27px | 12px | 13px | yes |
| dense | 2px | 18px | 8px | 12px | yes |
| touch | 5px | 45px | 20px | 14px | yes |

**One inherited variable produced every value.** No lookup table, no class
strings, no per-callsite decision. Compare with today's real
`packages/ui/registry/default/ui/button.ts`, where the same four results require
four hand-written class sets (`h-9 px-4`, `h-8 px-3`, `h-6 px-2`, `h-10 px-6`)
and a caller who picked one by looking at a design.

## Measured: fit solving (measured tier, ~25 lines)

| context | container | fit | action clusters visible | overflow menu | timestamp truncated | type | avatar | surface |
|---|---|---|---|---|---|---|---|---|
| page 900px | 874px | settled | 2 of 2 | no | no | 14px | 32px | surface-1 |
| sidebar 320px | 294px | settled | 1 of 2 | **yes** | **yes** | 14px | 32px | surface-1 |
| phone 380px, touch | 348px | settled | 1 of 2 | **yes** | **yes** | 14px | **40px** | surface-1 |
| dense list 640px, nested ×2 | 612px | settled | 2 of 2 | no | **12px** | 12px | 20px | **surface-2** |

Every row settled: `scrollWidth === clientWidth` in all four cases, i.e. **no
overflow at any width, with no breakpoint authored anywhere.** Degradation
followed declared priority — the timestamp (priority 4) truncated first, then
the Star/Archive cluster (priority 3) collapsed into the overflow menu, while
Reply (priority 2) survived in every context.

Two derived results worth naming separately:

- **Touch context raised the whole scale automatically** — 45px controls and a
  40px avatar, from one inherited attribute. Hit-target sizing (WCAG 2.5.8, the
  rule axe-core spends 66M weekly downloads *checking*) becomes a property of
  context rather than a thing to remember.
- **Elevation came from nesting depth.** The dense row sits two surfaces deep
  and resolved to `surface-2` without anyone choosing a shade.

## Findings that change the design

**F1 — Priority ties must collapse as declared groups, not siblings.** First run
had three separately-declared actions at priorities 2/3/3; the solver hid *Star*
and kept *Archive*, because DOM order broke the tie. Fixed by declaring the
cluster as one unit. The rule this forces: **`collapse` is a property of a
declared group, and ties inside a group are not a solver decision.**

**F2 — Pure derivation produces degenerate extremes; scale rules need floors.**
At `dense`, the avatar resolved to 16px — technically consistent, visually
wrong. Fixed with `max(calc(var(--ui-unit) * 8), 20px)`, which measured 20px.
This is the taste risk from the scratchpad, observed on the first run: **a
resolver delivers consistency, never beauty. The floors and ceilings in the
resolution table are the design work, and they are not derivable.**

**F3 — The measured tier really is small.** The whole solver is one
`ResizeObserver` plus ~25 lines: sort declared candidates by ascending
importance, degrade until it fits. No constraint system, no layout engine, no
second pass over the tree.

**F4 — Unsatisfiable is a DOM fact.** `data-fit="settled" | "unsatisfiable"` on
the container makes an unfittable layout machine-readable — the same pattern ADR
0030.2 T6 establishes for contained failures, so `nisli check`, Playwright, and
any agent read it with no new protocol.

## Honest limits of this run

- Plain CSS/JS, not the nisli runtime: no signal integration, no SSG pre-solve,
  no HMR interaction tested.
- The truncate strategy used a crude `max-inline-size: 6ch`; a real one derives
  from the container's remaining space.
- No flash-of-unfit measurement — the first paint before the measured pass is
  the risk the static tier is supposed to keep rare, and this fixture does not
  quantify it.
- The overflow menu is a stub trigger: no popover, no keyboard, no ARIA.
- Single engine (Chromium). Container style queries and `max()` are Baseline,
  but nothing here was cross-checked in Firefox or WebKit.

## Verdict

The two load-bearing mechanisms both hold, measured rather than argued:
**context-derived values reach through layout-transparent hosts with zero JS**,
and **declared-priority fit solving eliminates overflow without breakpoints in
~25 lines**. The scratchpad's decisive question (§7.17 — "does it work for a
component the framework has never seen?") is answered **yes at the mechanism
level**; what remains unproven is integration into the runtime, the byte budget,
and whether an authored resolution table can be made beautiful.
