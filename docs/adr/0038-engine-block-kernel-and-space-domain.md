# 0038. Engine Block Kernel and the Space Domain

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md), [0035-engine-appearance-layer](./0035-engine-appearance-layer.md), [0037-engine-form-intent-capture-domain](./0037-engine-form-intent-capture-domain.md)
**Code**: [`packages/engine/src/blocks/kernel.ts`](../../packages/engine/src/blocks/kernel.ts), [`engine/space.ts`](../../packages/engine/src/engine/space.ts), [`engine/paging.ts`](../../packages/engine/src/engine/paging.ts), [`engine/report.ts`](../../packages/engine/src/engine/report.ts), [`test/mount.ts`](../../packages/engine/src/test/mount.ts); guard [`blocks/kernel.test.ts`](../../packages/engine/src/blocks/kernel.test.ts); reference migrations [`blocks/section.ts`](../../packages/engine/src/blocks/section.ts), [`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts)

## Context

0034 recorded fifteen blocks and the rules inside them; 0035 split the look
out into skins and parts. Neither said *how a block is built*. Each block was
a hand-rolled `component()` that measured, decided, styled and waited in its
own way, and an inventory of the tree at 0.2.0 showed what that had cost:

- **1,927 lines of block code** under `packages/engine/src/blocks/` (non-test)
  for fifteen blocks whose intent surface is small.
- **61 `look()` call sites and 87 `css()` call sites.** Every block reached
  into the Appearance layer directly and composed structure with look by
  hand, so the same element could be dressed from two places.
- **Three skeleton implementations**: `blockSkeleton()` in
  [`blocks/status.ts`](../../packages/engine/src/blocks/status.ts), a
  one-bone variant in [`blocks/stat.ts`](../../packages/engine/src/blocks/stat.ts)
  and five rows of per-column bones in
  [`blocks/table.ts`](../../packages/engine/src/blocks/table.ts).
- **Seven copies of the test harness**: a local `mount()` /
  `setMeasurer()` pair in
  [`toolbar.test.ts`](../../packages/engine/src/blocks/toolbar.test.ts),
  [`table.test.ts`](../../packages/engine/src/blocks/table.test.ts),
  [`layout.test.ts`](../../packages/engine/src/blocks/layout.test.ts),
  [`status.test.ts`](../../packages/engine/src/blocks/status.test.ts),
  [`extras.test.ts`](../../packages/engine/src/blocks/extras.test.ts),
  [`form.test.ts`](../../packages/engine/src/blocks/form.test.ts) and
  [`skin.test.ts`](../../packages/engine/src/skin.test.ts), each slightly
  different in what it measured and what it restored.
- **Three latent mixed-write sites**, where an imperative `apply(el, …)` /
  `el.style.x = …` and a reactive `style:` string touched the same element:
  Grid's `gridTemplateColumns` ([`blocks/grid.ts`](../../packages/engine/src/blocks/grid.ts)),
  the App shell's flex direction ([`blocks/app.ts`](../../packages/engine/src/blocks/app.ts))
  and Dialog's body scroll lock ([`blocks/dialog.ts`](../../packages/engine/src/blocks/dialog.ts)).
  None had bitten yet; each was one re-render away from a stale write
  shadowing a live one.

The width decisions themselves — shell shape, dialog shape, columns, label
column, page size — were correct and tested, but scattered as inline
arithmetic in the blocks that used them, with the thresholds read from the
`metrics` module constant. That is fine for one axis (colour) and wrong for
the next two (density, input), which 0034's long-term plan promises: a
threshold read from a constant cannot vary by context.

## Decision

### Space: the Decision context's pure vocabulary

[`engine/space.ts`](../../packages/engine/src/engine/space.ts) is the one
module a block imports to decide from a width. Every function is pure —
numbers in, data out, no DOM, no signals — and every threshold arrives as a
trailing `layout` parameter defaulting to `metrics.layout`, so a block
passes `ctx.metrics.layout` and a test passes its own numbers:

| decision | signature | used by |
|---|---|---|
| `fit` | `(input: FitInput) => FitPlan` (re-exported from `fit.ts`) | Toolbar, Table via `ctx.fitRow` |
| `columnsFor` | `(width, count, minColumn, gap) => number` | Grid, Form |
| `shellMode` | `(width, layout?) => 'sidebar' \| 'bar'` | App |
| `dialogMode` | `(viewport, layout?) => 'card' \| 'sheet'` | Dialog |
| `labelColumn` | `(width, longest, layout?) => number` | Bars |
| `labelEvery` | `(slot, longest) => number` | Columns |
| `labelWidth` | `(text, padding?, charWidth?) => number` | every estimate, `textMeasurer` |
| `pageSize` | `(shown, total, page?) => { remaining, next }` (from [`engine/paging.ts`](../../packages/engine/src/engine/paging.ts)) | Table |

`reportIf(plan, report)` in [`engine/report.ts`](../../packages/engine/src/engine/report.ts)
is the one way a block files a layout report: hand it anything with a
`slack` and the report is filed iff the slack is negative. Blocks never call
`report()` by hand, so a report is a property of a plan, not a judgement a
block makes.

### The block kernel: a block is a composition of behaviours

[`blocks/kernel.ts`](../../packages/engine/src/blocks/kernel.ts) exports one
function, `block<P>(tag, spec)`. There is no base block and no class
hierarchy; a block opts into behaviours, each a function over the same small
`Ctx`:

- **`host(ctx)`** — the host's structural style, one reactive effect that
  *replaces* its previous run (a key absent this run is blanked).
  **`hostParts`** layers the skin's look for the host's parts over it, live
  with the skin.
- **`measure: 'width' | 'viewport'`** — gives `ctx.width`, the block's own
  inline size or the document's for blocks that float. Absent, `ctx.width`
  is 0 and every decision takes its roomiest form.
- **`surface: true`** — provides `SurfaceContext` depth; `ctx.nested` reads
  it (a surface inside a surface is not a card, 0034).
- **`status: true | { skeleton }`** — the engine draws waiting, failure and
  refresh; `true` uses `blockSkeleton()`, an object supplies the block's own.
  `ctx.failure`, `ctx.updating` and `ctx.waiting(body)` are the slots the
  block places, each cut on its own boolean so a slot re-runs only when its
  flag flips. Placing a slot without declaring `status` fails at setup.
- **`ctx.part(parts, structure?)`** — the only way a block styles an element:
  a computed style string of structure (from `ctx.metrics` and decisions)
  with the skin's look for `parts` layered after it. Either argument may be
  a thunk; a parts thunk may return `[]` to switch a look off.
- **`ctx.busy`** — `createBusy()` on first read, for promise-returning
  actions.
- **`ctx.fitRow(spec)`** — measure → `fit()` → plan, filing `spec.report`
  through `reportIf` on every plan with negative slack.
- **`lockScroll(open)`** — the single sanctioned imperative style write in
  the engine, on `<body>`, which no block styles reactively; clears on close
  and on dispose.
- **`ctx.metrics`** — the door every structural number comes through. Blocks
  read `ctx.metrics`, never the module constant; the scan below enforces it.

`render(props, ctx)` returns the block's children; the kernel wraps them in a
`display: contents` root, so the DOM shape of every migrated block is the
same as before.

### The test kernel

[`test/mount.ts`](../../packages/engine/src/test/mount.ts) replaces the
seven harness copies. `mount(tag | factory, props, { width, viewport, scheme,
text })` mounts one block at a width with no browser: the measurer seam
answers the host with `width`, the document with `viewport`, text-shaped
elements with `text` (`textMeasurer(charWidth)` uses `labelWidth`, the
engine's own estimate, so a plan is arithmetic) and everything else with the
frame. `styleOf(selector)` reads the decision; `unmount()` restores the
measurer, the skin, the scheme and `<body>`.

## Design principles applied

**Composition over inheritance.** A behaviour is a spec key or a `Ctx`
method, never a superclass. The one place inheritance was considered was
row-fitting: Toolbar and Table both measure items, solve, and report, and a
`FittingBlock` base was the obvious shape. It was rejected because the two
blocks share the loop and nothing else — Table's items are columns with
`stackInto`, Toolbar's are buttons with a rank — and a base class would have
made the loop the block's identity rather than one of its behaviours.
`ctx.fitRow(spec)` is the same code without the taxonomy; a third fitting
block (an action row for dialogs, issue 0023) adds one call, not one class.

**Exactly one way to style.** `ctx.part()` is that way, and
[`kernel.test.ts`](../../packages/engine/src/blocks/kernel.test.ts) makes
the rule mechanical: it reads every `blocks/*.ts` that imports `./kernel.js`
and fails on four patterns — importing `apply`, `css` or `look` from
`style.ts`/`skin.ts`; any `.style.` or `.style[` write; any string `style:`
literal; importing `metrics` from `metrics.ts`. The test also asserts that
the reference migrations are in the scanned set, so the scan cannot be
satisfied by nothing being scanned. Mixed writes are not discouraged; they
do not compile against the spec.

**Decisions as data.** `fit()` returns a `FitPlan`; `shellMode()` returns a
word; `pageSize()` returns two numbers; `reportIf` files a report from a
plan's slack. A block renders what the data says. This is what makes each
decision provable at a width through `mount()` and why no test in the
engine reads a screenshot.

**Axis-readiness through `ctx.metrics`.** Every threshold and spacing a block
uses arrives through `Ctx`, and every Space decision takes its `layout` as a
parameter. When density and input become skin axes (0035's contract), the
kernel swaps what `ctx.metrics` returns and no block changes.

## What the adversarial review changed, and why

The first draft of the kernel was reviewed against the migrations of every
block before the API was frozen. Eight things changed:

1. **`host` replaces instead of merging.** The first effect merged the new
   record over the old one, so a `hostParts` thunk toggling `button.busy`
   off left its `opacity` behind. The effect now blanks keys absent this run
   (tested: *the effect replaces*).
2. **A parts thunk may return `[]`.** Delta tone on Stat and row hover on
   Table need "no look" as a state; the first `Parts` type had no way to say
   it, and blocks reached for a conditional `apply`. `[]` is now a value and
   the property is cleared on the element (tested).
3. **`status` shape simplified to `true | { skeleton }`.** The draft had a
   `StatusShape` enum mirroring the three skeleton implementations. Two of
   the three were the same skeleton with different bones; `true` covers them
   and an object covers a block with a real reason to differ. `StatusShape`
   is gone from the public index.
4. **`fitRow` takes its report as part of the spec.** Toolbar and Table each
   called `report()` by hand after `onPlan`, with their own deficit
   arithmetic. `FitRowSpec.report = { code, detail }` moves the filing into
   the kernel through `reportIf`, filed once per solve with the block's tag
   (tested).
5. **`ctx.metrics` replaces the module constant, and the scan enforces it.**
   Migrated blocks kept importing `metrics` from `metrics.ts`, which would
   have made the density axis a rewrite. Rule 4 of the scan bans the import;
   `buttonBox()` and `menuItemBox()` in `style.ts` became zero-arg so they
   read the same door.
6. **Space decisions take a trailing `layout`; `labelWidth` is the one
   estimate formula.** Thresholds were read inside the functions; tests had
   to mutate metrics to vary them, and `test/estimate.ts` and `test/mount.ts`
   each had their own characters-times-glyph formula. Both now call
   `labelWidth`.
7. **`pageSize` moved from `space.ts` to `engine/paging.ts`.** Paging is a
   decision over a count, not a width; keeping it in Space blurred what
   Space's vocabulary comment promises ("the decisions the engine makes from
   a width"). Space re-exports it so a block still has one import.
8. **`lockScroll` is a kernel export, and the `skin.test.ts` scanner is
   deleted.** Dialog's body scroll lock was the third mixed-write site and
   had no reactive counterpart to conflict with; naming it as the single
   sanctioned imperative write is more honest than forbidding it and
   leaving `dialog.ts` off the scan. The older style-literal scanner in
   `skin.test.ts` overlapped the kernel scan with weaker rules and was
   removed so there is one guard.

Two gaps the migrations worked around rather than fixed are recorded for
the next round, not silently absorbed: `spec.host(ctx)` does not see props
(Grid stores its column count in a `WeakMap` slot read by `host`), and
`spec.status.skeleton()` receives neither props nor ctx (Stat stashes
`ctx.metrics`; Table declares `status: true` and draws its own rows behind a
pending flag). Both point at the same API move — `host(ctx, props)` and
`skeleton(ctx, props)` — and will be taken together.

## Consequences

- **One way to build a block, one way to style, one way to test.** A new
  block is a `block()` spec; its look is a set of parts; its proof is
  `mount()` at widths. The 0034 rule "every block ships with a width test
  before a screenshot" now has a fixed shape for that test.
- **LOC.** `kernel.ts` is 192 lines; the reference migrations came out
  shorter (Section 28, Toolbar 127) and the layout blocks roughly level
  (App 125→117, Page 42→48, Grid 28→43, Stat 36→39, Table 215→225) with
  their harness copies deleted. The whole-tree delta against the 1,927-line
  inventory is recorded in
  [`packages/engine/CHANGELOG.md`](../../packages/engine/CHANGELOG.md) once
  the last blocks land — see CHANGELOG.
- **Two skin parts were added to make migrations honest**: `nav.side` (the
  App sidebar's border, previously a `look('bar').borderBottom` read) — the
  0035 "do not edit skin.ts" rule yields to a migration that would otherwise
  reintroduce a second styling path.
- **The Appearance layer is now reached from exactly one call site.**
  `look()` and `css()` are called inside `kernel.ts` and nowhere in a block;
  the 61/87 sites collapse to the kernel's `part()` and host effect.
- **The acceptance test is Ledger with zero edits.**
  [`packages/ledger`](../../packages/ledger) is built only from Intent
  (0034); if the kernel changed a public prop, a DOM role, an aria
  attribute or a behaviour, Ledger's typecheck, its 28 tests or its screens
  would say so. Every migration report ran all three and made no Ledger
  change. That is the contract being verified, not a convenience.

## Long-term plan

1. **Density and input axes through `ctx.metrics`** (0034 phase 5). The
   kernel is the one place that resolves `metrics` for a block; an axis
   changes what it hands out, and the trailing `layout` parameters already
   accept the result. Blocks are not touched.
2. **`prove()` over `mount()`.** `mount()` proves one block at one width;
   `prove()` ([issue 0024](../issues/0024-prove-harness-parked.md)) mounts a
   screen at many widths and returns its layout reports. With `reportIf` as
   the only filing path and `mount()` as the only seam, un-parking it is
   composition, not a new harness.
3. **The block vocabulary stays at fifteen.** The kernel makes a block cheap
   to write, which is exactly when a vocabulary grows for convenience. 0034's
   rule holds: a block is added only when a Ledger screen needs it, and the
   next candidate (an action row for dialogs, issue 0023) is a `fitRow`
   behaviour on Dialog before it is a sixteenth block.
