# 0046. Engine Density and Input Axes — One Intent, Sized by Context the Engine Detects

**Date**: 2026-08-31
**Status**: Accepted (2026-08-31, after the gate's 19 edits, the implementation review's 11 and the Ledger proof over four contexts — §What the gate changed, §What the review and the Ledger proof changed, §Acceptance; 0045 is held for Ledger's money-clarity ADR, in flight in the Ledger session)
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md) (long-term plan phase 5, the promise this ADR keeps), [0035-engine-appearance-layer](./0035-engine-appearance-layer.md) (`SkinAxes`, the scheme mechanism this ADR generalises), [0038-engine-block-kernel-and-space-domain](./0038-engine-block-kernel-and-space-domain.md) (`ctx.metrics` as the door; Space decisions with a trailing `layout`), [0041-engine-proof-domain](./0041-engine-proof-domain.md) (the claim catalogue this ADR grows), [0044-engine-deterministic-decisions](./0044-engine-deterministic-decisions.md) (decisions are functions of width and intent — this ADR adds *context* to that function, never data)
**Resolves**: [issue 0029](../issues/0029-metrics-are-one-context.md)
**Code**: `packages/engine/src/engine/axes.ts` (new), `metrics.ts`, `skin.ts`, `style.ts`, `blocks/kernel.ts`, every block under `blocks/` that reads `ctx.metrics`, `test/mount.ts`, `test/prove.ts`, `test/claims.ts`, `index.ts`

## Context

The north star's measured claim was that one declaration, with no size in it,
renders as a 36 px control in one context and an 18 px one in another
([NORTH-STAR](../research/nextgen/NORTH-STAR.md) §Measured). 0034 named the
two contexts after colour — **density** and **input** — and 0038 built the
door for them: blocks read `ctx.metrics`, Space decisions take their
`layout` as a parameter, "the kernel swaps what `ctx.metrics` returns and no
block changes". Nothing has walked through the door. `metrics` is a frozen
constant; a touch user of Ledger gets 32 px buttons, 36 px rows and a 24 px
notice dismiss; and — the audit's finding — most of the engine's reads would
not follow the door if it moved
([issue 0029](../issues/0029-metrics-are-one-context.md) §b).

One lesson from the north-star prototype governs the shape of this ADR.
Round 7's finding F9 ([scratchpad](../research/nextgen/NEXTGEN-SCRATCHPAD.md)
§2026-08-25 round 7): *derivation from one unit is not automatically
self-consistent* — a grid track that shrank with density while the control
inside it kept its floor produced the only overflow in the matrix, in the
context whose job was to fit more. The rule it forced: **floors are
explicit, and an axis moves rhythm, never a floor**.

## Ubiquitous language

| term | meaning | where |
|---|---|---|
| **Axis** | One dimension of context the engine detects or is told, and never authored per block: `scheme`, `density`, `input`. | `engine/axes.ts` |
| **Axes** | The resolved triple `{ scheme, density, input }`, one signal, the input to both the metrics table and a skin. | `axes` (readonly signal) |
| **Density** | How much rhythm a person wants: `comfortable` (today's numbers) or `compact` (tighter spacing, shorter controls, more rows in view). A preference; `'system'` resolves to `comfortable`. | `setDensity()` |
| **Input** | The primary pointing device: `pointer` (fine, hovers) or `touch` (coarse, no hover). Detected from `(pointer: coarse)`, live; overridable. | `setInput()` |
| **Hit** | The smallest side an interactive target may have: `control.hit`. The input axis's one number; it floors, never scales. | `metrics.control.hit` |
| **The door** | `metrics` — the same object at every read, whose numbers are live over the axes. `ctx.metrics` is it. | `metrics.ts` |
| **Table** | The numbers decided for one `Axes`: `metricsFor(axes)`, pure. | `metrics.ts` |

## Decision

### 1. Axes are an engine domain, detected like scheme

`engine/axes.ts` owns the three axes the way `skin.ts` owns `scheme` today,
and `scheme` moves there (re-exported from `skin.ts` and `index.ts` unchanged):

```ts
export type Scheme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type Input = 'pointer' | 'touch';
export interface Axes { readonly scheme: Scheme; readonly density: Density; readonly input: Input }

export const axes: ReadonlySignal<Axes>;                 // resolved, reactive
export function setScheme(s: Scheme | 'system'): void;   // as today
export function setDensity(d: Density | 'system'): void; // 'system' → 'comfortable'
export function setInput(i: Input | 'system'): void;     // 'system' → (pointer: coarse) ? 'touch' : 'pointer', live
```

- **Detection is the engine's.** `scheme` follows `prefers-color-scheme`
  (moved, not changed); `input` follows `(pointer: coarse)` through the same
  `matchMedia` watcher shape, live. With no `matchMedia` (tests, SSR) the
  platform reads `pointer`.
- **Density is a preference, not a derivation.** `'system'` is
  `comfortable` today — the word is kept so a platform density signal can
  be honoured later without an API change, and the README says it resolves
  to `comfortable`. It is *not* derived from `input` — F9: coupling axes
  implicitly is how a table states an impossible constraint. An app forwards
  a person's preference exactly as it forwards `appearance`:
  `setDensity(settings.density)`. No block, no screen, no prop says
  `compact`; that is the per-instance appearance prop 0034 bans.
- **`useSkin(skin, options)` gains `density?` and `input?`** beside
  `scheme?`, each `| 'system'`, for a one-call install. `SkinAxes` becomes
  `Axes`; a skin function receives all three. The default skin ignores the
  new two in this round (§Non-goals).
- **No import cycle.** `axes.ts` knows nothing about skins. `skin.ts` imports
  `axes` and owns one `effect` over `axes.value.scheme` and `installed` that
  writes `color-scheme` on the document (today's `syncDocument`, made
  reactive); `setScheme` in `axes.ts` only sets the preference. `skin.ts`
  re-exports `scheme`, `setScheme`, `Scheme` so `index.ts` is unchanged.

### 2. `metrics` stays the door; the numbers behind it become live

The audit's finding is that eleven blocks hold `const { metrics } = ctx` and
the module constant is read from `style.ts`, `space.ts` defaults,
`paging.ts`, `overlay.ts` and the tests. A door that *returned a new object*
per axes would break every one of them. So the object is stable and its
**groups are live**:

```ts
/** The literal table for the default context — today's constant, number for number. Its keys are the schema. */
const COMFORTABLE = { space: { 1: 4, … }, control: { height: 32, padX: 12, check: 16, hit: 24 }, charWidth: 7.2, layer: { … }, layout: { … } } as const;
export type LayoutKey = keyof typeof COMFORTABLE.layout;
export type Layout = Readonly<Record<LayoutKey, number>>;          // moves here from space.ts, which re-exports it
export interface Metrics {
  readonly space: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, number>>;
  readonly control: { readonly height: number; readonly padX: number; readonly check: number; readonly hit: number };
  readonly charWidth: number;
  readonly layer: { readonly sticky: number; readonly bar: number; readonly modal: number; readonly popover: number; readonly passive: number };
  readonly layout: Layout;
}

/** The table for one context. Pure. `{ density: 'comfortable', input: 'pointer' }` is `COMFORTABLE`, deeply equal. */
export function metricsFor(a: Pick<Axes, 'density' | 'input'>): Metrics;

/** Only the two axes that size anything: a scheme flip must not invalidate a single structural style or re-solve a row. */
const density = computed(() => axes.value.density), input = computed(() => axes.value.input);   // in axes.ts: primitives, so a scheme flip changes neither
const sizing = computed(() => ({ density: density.value, input: input.value }));
const current = computed(() => metricsFor(sizing.value));
/** The door: one object, every group a live read of the current table. */
export const metrics: Metrics = {
  get space() { return current.value.space; },
  get control() { return current.value.control; },
  get charWidth() { return current.value.charWidth; },
  get layer() { return current.value.layer; },
  get layout() { return current.value.layout; },
};
```

Consequences that make this the smallest correct change:

- A read inside any reactive scope — a `host` effect, a `ctx.part()` thunk,
  a `computed` — tracks `current` and re-evaluates on an axis change. The
  eleven destructures need no edit.
- A read *outside* a reactive scope — a plain record, a setup-time `const`,
  a default parameter evaluated at call time — reads the current table at
  that moment and never again. Those sites are the migration (§4).
- `Metrics` widens from `typeof metrics` (literal types) to numbers. Tests
  that compare against `metrics.layout.dateChars` keep working; a consumer
  who relied on the literal `32` type does not exist.
- `metricsFor({ scheme, density: 'comfortable', input: 'pointer' })` is
  today's table exactly, so every existing test and every Ledger screen
  renders byte-identically until an axis moves — the acceptance below
  includes the whole current suite unchanged.

### 3. What each axis moves — rhythm and controls scale, floors do not

| group | comfortable / pointer (today) | compact | touch |
|---|---|---|---|
| `space` 1…6 | 4 8 12 16 24 32 | **4 6 8 12 16 24** | unchanged |
| `control.height` | 32 | **28** | **max(·, 44)** |
| `control.padX` | 12 | **8** | unchanged |
| `control.check` | 16 | unchanged | **24** |
| `control.hit` (new) | **24** | unchanged | **44** |
| `charWidth` | 7.2 | unchanged | unchanged |
| `layer` | — | unchanged | unchanged |
| `layout` (every threshold) | — | unchanged | unchanged |

- **Density scales `space` and `control`, nothing else.** `layout` is
  floors and thresholds (`minTextColumn`, `minField`, `sidebarWidth`,
  `dialogMin`, the char budgets); F9 says a compact context that lowered
  them would be the one that overflows. Compact fits more by spending less
  on rhythm, not by promising smaller minimums. `tablePage` is not density
  (paging is a decision about asking, not about room). This overrides the
  expectation 0044 and `space.test.ts` wrote down — *"every Space decision
  takes an explicit layout, so a density axis can move it"* — the parameter
  stays (tests pass their own numbers); the axis does not use it. The test
  titles are retitled in the round. Compact's steps stay distinct
  (`4 6 8 …`, not `4 4 8 …`) so the checkbox↔label and label↔field gaps do
  not collapse into one — F9 in miniature.
- **Input floors, through `max`.** The touch table is the density table
  with `control.height = max(height, 44)`, `check = 24`, `hit = 44`. Compact
  + touch is therefore 44 px controls with compact spacing — touch wins the
  floor, density keeps the rhythm; the composition is explicit arithmetic,
  never a derivation.
- **Type does not move.** `charWidth` is calibrated to the default skin's
  14 px body ([0041](./0041-engine-proof-domain.md)); every char budget in
  `layout` and every glyph in `test/glyphs.ts` depends on it. A density that
  scaled type is a second round with a recalibration (§Non-goals).
- **`hit` is a floor blocks apply to targets that are not controls**, on
  both sides: a table row (`height: hit` on the `tr` — `min-height` does
  not apply to table rows, and table layout treats `height` as a minimum),
  the sortable header's cell (`height: hit` on the `th`; the button inside
  keeps its box, so at the default the header row does not move), a nav
  link and a menu item (`minHeight: hit`), the notice dismiss (`minWidth:
  hit` and `height: hit` — it is ≈ 23 px wide today, and WCAG 2.5.8 is
  24 × 24). Controls already get it through `control.height`. `hit` at
  pointer is 24 — WCAG 2.5.8 (AA) — so the notice dismiss (24 px today, by
  subtraction) becomes `hit` by name.

### 4. The migration: every read follows the door

From the audit ([issue 0029](../issues/0029-metrics-are-one-context.md) §b),
by class:

| class | sites | change |
|---|---|---|
| plain record to `ctx.part()` — including records built from a `style.ts` box (`buttonBox()`, `menuItemBox()`, `inputBox()`), which contain no `metrics.` text and freeze just the same | `app.ts:110,172`; `bars.ts:33`; `columns.ts:50,51,72`; `dialog.ts:74,76,78`; `form.ts:180,202,209,223,269,314,331,353`; `notice.ts:106,125,134`; `page.ts:24,34,35,37`; `meter.ts:22`; `table.ts:250`; `actions.ts:58`; and the kernel's own `kernel.ts:198–199` (`bone`, `skeleton`), `:227–237` (`failure`, `updating`) | become thunks `() => ({ … })` |
| frozen derived constant | `bars.ts:27`, `columns.ts:43` (budgets), `form.ts:105` (gap), `toolbar.ts:44` (`fitRow.gap`), `table.ts:67` (page seed) | read inside the computed that uses them; `FitSpec.gap` becomes `number \| (() => number)` |
| untracked `fitRow` callbacks | `table.ts:92,96`, `toolbar.ts:45,51` | **the kernel re-solves every `fitRow` on a sizing change** — `useFit` reads `sizing.value` (density + input, never scheme: Toolbar's measuring solve would otherwise flash on every dark/light toggle) in its own deps once; no block edits. The deps effect already `queueMicrotask(solve)`s after the style effects flush, so one solve per flip and no `UNSETTLED` |
| `table.ts:71` (page reset effect) | reads `metrics.layout.tablePage` inside the reset effect → would reset paging on every axis flip | `untrack(() => metrics.layout.tablePage)` (core exports `untrack`; the door has no `peek`) — an axis change is not new data |
| `style.ts` boxes | already zero-arg functions read at call time (0038 §5) | `buttonBox()` gains `minHeight: hit` only where a target is not already `height`d; `menuItemBox().minHeight` becomes `max(control.height, hit)` — i.e. `control.height` |
| `estimate.ts:69`, `mount.ts:58` | per-call reads of the door | unchanged (they read the current table per call, which is right) |

And the two pointer-agnostic fixes recorded in the issue as adjacent but
one-line: `table.ts:178–179` `mouseenter/mouseleave` → `pointerenter/pointerleave`;
the header cell (`th`) and every body row get `height: hit`, and the sort
**click moves to the `th`** — the cell is the target's box, the button
inside keeps its own box (Enter/Space on it bubble to the cell once).

**The scan grows one rule** (`kernel.test.ts`, rule 5): under `blocks/`,
the second argument of every `ctx.part(` call, when present, must begin
with `() =>` — an object literal, a `buttonBox()` call or a bound identifier
is a failure. (A literal with no metrics in it is allowed to be a thunk too;
uniformity is cheaper than an allow-list.) Setup-time constants are not
regex-catchable; the live-flip proof (§5) is what catches them, and the
kernel — excluded from the scan — is covered by that proof through
`skin.test.ts`'s pending and failed block variants.

### 5. Proof — two claims, and axes as a proof dimension

- **`mount(make, props, { width, viewport, scheme, density, input })`** —
  the two new options set the axes through `setDensity`/`setInput` before
  mount; `unmount()` resets density and input to `'system'`
  **unconditionally** (not only when the option was given — `AXIS_STALE`
  flips them after a mount that set neither). happy-dom implements
  `matchMedia`, and evaluates `(pointer: coarse)` as
  `navigator.maxTouchPoints > 0`, so `'system'` input resolves to `pointer`
  there and every existing test is unchanged; `axes.test.ts` proves
  detection for real by setting `maxTouchPoints`, not by mocking
  `matchMedia`.
- **`prove(make, { widths, axes? })`** — `axes` is a list of partial
  `{ density?, input? }` contexts, default `[{}]` (today's behaviour). The
  proof loops **widths × axes**; every claim carries `width` and `axes`.
  The Ledger proof will run the five widths × `[{}, { density: 'compact' },
  { input: 'touch' }]`.
- **`TARGET_SMALL`** (severity `error`, checked only when `input` is
  `touch`): an interactive element (`INTERACTIVE`, visible, not inert) whose
  target box is under `metrics.control.hit` on either side. **Height**: the
  element's inline `height`/`minHeight`, else the nearest ancestor's that
  sets one and contains no other interactive element (a sort button inside
  its `th`, a link inside a `tr`). **Width**: inline `width`/`minWidth`,
  else the estimator's text width plus inline horizontal padding (what
  `OVERFLOW_TEXT` already computes), and a block-level element with no
  width set is as wide as its box (passes). **No inline height anywhere**:
  a failure — except an element that is inline in flowing text (`display`
  unset or `inline`, e.g. `Link` in a `Text`), which WCAG 2.5.8 exempts and
  the claim skips. So the nav link (padding only today) fails until it
  carries the floor, which is the point. The engine writes every size
  inline, so this is decidable with no browser; `min-height` on a `tr` is
  ignored by CSS, which is why the row uses `height` and the claim reads
  both. Chart bars are not interactive (they carry a `title`, not a role)
  and are out of scope; the issue records that gap.
- **`AXIS_STALE`** (severity `error`): after the base mount reaches its
  fixed point and `settle()`s at axes A — and **before** the page-advance
  perturbation, which changes the row count — `prove()` flips the live
  axes to B (compact + touch when A is the default, else the default),
  settles again, and diffs the tree against a **fresh mount at B** taken
  through the same `fixedPoint` + `settle()`. Pairing is by document order
  and is valid only when both trees have the same length and the same tag
  sequence (as `diffPlans` requires); a length or tag mismatch is filed
  once, naming the first differing position. Any inline `style` difference
  names the block: "did not follow the axes: `<tag>` at *selector* has
  `padding:8px 12px` live and `padding:4px 8px` fresh". Cost: one extra full
  mount per width per axes entry. This is the general instrument that makes
  a frozen number a test failure in any future block, screen-wide, without
  a scan.
- **`verify()` in Chromium** gains nothing in this round; the Acceptance
  includes a by-hand Chromium check of the touch floors on the phone
  (device emulation), recorded as held or pending, as 0044 did.

### 6. Where a new need goes, restated

A new axis is a new field on `Axes` + a column in `metricsFor` + a detector
or a setter. A block never reads an axis by name — it reads a number through
the door and lets the table decide. A block that needs "is this touch?" as a
boolean is asking for a look word; the answer is a number in `control` it
should be reading instead.

## Consequences

- **Ledger's app code changes nothing and gains two things**: 44 px
  targets on the phone (input is detected), and a density it can forward
  with one line when it chooses to (`setDensity(settings.density ??
  'system')` beside `setScheme`, and a `?density=compact` query next to
  `?bare` in `main.ts`). Those lines are Ledger's, for the session that
  owns it. **One Ledger test file does change in this round**:
  `screens.proof.test.ts` runs the axes contexts, and its `KNOWN` table is
  keyed by width alone, so the standing `FIGURE_TRUNCATED` entries are
  re-keyed by (width, axes). This round makes that edit, in its own commit,
  announced to the Ledger session.
- **Differences at the default** (comfortable + pointer), all in inline
  styles and none moving a pixel in Chromium (verified, §Acceptance): every
  `th` and body `tr` gains `height: 24px` (below their ≈ 33 / ≈ 36 px
  rendered heights); every button gains `min-width: 24px` from
  `buttonBox()` — WCAG 2.5.8's floor by construction, which the ⋯ trigger
  (37 px) and the ✕ close already exceed and the notice dismiss (≈ 23 px)
  now meets; the nav link goes from `display: block` to `display: flex;
  align-items: center; min-height: 24px; box-sizing: border-box` (same
  rendered height); the boolean field's `<label>` becomes the row (`flex`,
  `min-height: control.height`). The sort click lives on the `th`.
- **On touch**: rows ≈ 44+ px, buttons and inputs 44 px, checkboxes 24 px,
  menu items 44 px. A Table shows fewer rows per screen on a phone; that is
  the intended trade. Toolbar's `minHeight` follows `control.height`
  (`toolbar.ts:31`), so the bar grows with it.
- **`metrics` is reactive**: any code that reads a group outside a reactive
  scope holds the table of that moment. Inside the engine every such site is
  migrated (§4); outside it, `metrics` is exported for tests and skins, and
  the README says it is live.
- **The skill** (`.agents/skills/nisli-engine`) gains: `setDensity`/
  `setInput` in the app-imports rule; "never say compact per block"; the two
  `MountOptions`; `prove` axes; the `part()`-thunk rule.
- **Engine 0.10.0.** `Metrics` widens; `SkinAxes` gains two fields (a skin
  function that destructures `{ scheme }` is unaffected); `FitSpec.gap`
  accepts a thunk; `index.ts` exports `axes`, `setDensity`, `setInput`,
  `metricsFor`, the `Axes`/`Density`/`Input` types.

## What the gate changed

The draft was reviewed read-only against `main @ f103e02` before any code.
Nineteen findings; the ones that changed a decision:

| # | finding | change |
|---|---|---|
| 1 | `Layout` was defined from `Metrics['layout']` and `Metrics.layout: Layout` — circular | the comfortable table is the schema; `LayoutKey`/`Layout` live in `metrics.ts`, `space.ts` re-exports |
| 2 | happy-dom has `matchMedia` and evaluates `(pointer: coarse)` from `maxTouchPoints` | detection is tested for real |
| 3 | `peek` does not exist on the door | `untrack` |
| 4, 5 | five frozen `ctx.part` sites built from `buttonBox()` contain no `metrics.` text; rule 5 would miss them | sites listed; rule 5 is "the second argument is a thunk" |
| 6 | `min-height` is a no-op on `<tr>`; the claim would pass in happy-dom and fail in Chromium | `height: hit` on the row and the `th`; the claim reads both |
| 7 | the dismiss is 44 tall × 23 wide | `TARGET_SMALL` has a width leg; the dismiss gets `minWidth: hit` |
| 8 | `minHeight` on the sort button grows the header line box 4 px at the default | the floor goes on the `th` |
| 9 | `useFit` on `axes` re-solves every Toolbar (measuring flash) on a scheme flip | `sizing` = density + input; `current` and `useFit` depend on that |
| 10, 11, 15 | `AXIS_STALE` after the page advance compares 120 rows to 60; `unmount()` reset scheme only when the option was set; pairing unspecified | before the advance; unconditional reset; length + tag-sequence guard |
| 12 | `TARGET_SMALL` undecidable for elements with no inline height (nav link, `Link`) | fail unless inline in text (WCAG 2.5.8 exemption) |
| 13 | `setScheme` → `syncDocument` → skin state: a cycle | `skin.ts` owns the `color-scheme` effect |
| 14 | "zero Ledger edits" vs the Acceptance's Ledger proof | one test-file edit, named |
| 16 | compact `4 4 8 …` collapsed two steps | `4 6 8 12 16 24` |
| 17 | 0044/`space.test.ts` expected the axis to move `layout` | overriding stated, with F9 |

## What the review and the Ledger proof changed

The implementation was reviewed read-only against the ADR (11 findings),
and every Ledger screen was proven at five widths × four contexts
(`{}`, compact, touch, compact + touch) through a scratch copy of
`screens.proof.test.ts` — the proof surface fired, which is its job:

| finding | change |
|---|---|
| `TARGET_SMALL` read `min-width: 0` (spread from `truncate`, and on every segmented option) as a zero width — 88 false "0px wide" claims on Transactions alone | a zero `min-width` is "may shrink", not a width; a growing flex item is as wide as its share; a sort button's pinned `th` answers for it; a native check/radio is judged by the row it sits in; an estimate of nothing is no answer |
| the sort target in Chromium was the 17 px button, not the 44 px `th` | the `click` handler moves to the `th`; the button keeps its box and its keyboard path |
| the ⋯ trigger was 44 × 37 on touch | `buttonBox()` gains `min-width: hit` (24 at the default) |
| the file input had no height anywhere | `min-height: control.height` |
| the checkbox's own 24 px box was the judged target while its `<label>` was ≈ 20 px | the label is the row (`flex`, `min-height: control.height`) |
| the estimator ignored `min-width`, so a touch Toolbar plan could pass a row Chromium overflows | `estimateText` is `max(min-width, text + padding)` |
| **the runner never settled a screen with a standing report** — every turn `remeasure()`s, a block whose plan cannot be satisfied re-files the same report on every solve, and `UNSETTLED` followed (latent in 0041; exposed by the first `FIT_COLUMNS` under compact) | movement is a *new* report (host, code, detail, deficit), never a standing one re-filed; a report-only oscillation with an unchanged DOM now settles once both keys are seen — a semantics change every proof inherits, recorded in the CHANGELOG |
| the every-block live-flip proof mounted each block in its simplest shape | extended to Columns, Form with group / segmented / select / boolean / file / long / `when`, Table sorted + folded + paged, pending and failed statuses, Dialog as a sheet, App and Toolbar with their menus open, Empty with actions, Bars and Meter edges |

**A floor inconsistency the axis exposed (F9, exactly).** Under compact at
480, Page and Section spend 12 px instead of 16, so the Overview's rollup
`Grid` gets a 456 px content box and decides **two** columns (a 222 px cell
clears `minColumn` 220); the Table inside has 198 px for a money column
(`figureChars` 12 × 7.2 + 16 padding = 102.4) plus a primary text column
floored at `minTextColumn` 96 — 198.4 px, **0.4 px short**, and files
`FIT_COLUMNS` honestly. The same table needs 206.4 + 32 = 238.4 px of grid
cell at the default, so a two-primary table in a minimum grid cell cannot
fit in *any* context: `minColumn` (220) does not cover a card's padding plus
the narrowest two-primary table. It never showed because no Ledger width
produces a 220–238 px cell at comfortable. This is not the axis's defect and
`layout` does not move by axis; the consistent fix is one number —
`layout.minColumn` 220 → 240 — which changes Grid decisions at the default
(three columns need 752 px instead of 692) and is therefore **a decision
for the owner, not this round**. Until then it stands as the one finding of
the Ledger axes proof, to be recorded in `KNOWN` at (480, compact) and
(480, compact + touch).

**One sighting not reproduced.** One four-context run filed `AXIS_STALE`
on the Transactions filter form at 360 and `DECISION_UNSTABLE` on the
Overview at 360 compact; three further identical full runs filed neither.
Recorded, not explained; the instrument stays as specified and the Ledger
proof will show whether it recurs.

## Non-goals

- **No type scaling with density.** The skin's ramp and `charWidth` stay.
  When a compact type ramp is wanted, it is: `charWidth` per density in the
  table, the default skin's `fontSize` per density, `scripts/calibrate-glyphs`
  per density — one round, one ADR.
- **No per-block or per-screen density.** Not a prop, not a context provider.
  A "dense table inside a comfortable page" is the first step back to
  `className`.
- **No hover axis.** `(hover: hover)` is not an axis in this round; the row
  tint works on both inputs once it listens to pointer events. If a hover-only
  affordance ever becomes structural, it joins `Input`.
- **No layout floors move with density.** `layout` is one column for every
  context (F9).
- **No Toolbar budget migration.** 0044 §Toolbar decided it stays measured;
  re-solving on an axis change (§4) is enough.
- **No `verify()` target check** in Chromium yet; the by-hand check is in
  Acceptance.

## Acceptance (to hold before Accepted)

- Every existing test passes unchanged with the door live (the default table
  is today's, number for number).
- `axes.test.ts`: detection (`pointer: coarse` → `touch`, live), `'system'`
  resolutions, `setDensity`/`setInput` override, `metricsFor` is pure and
  `comfortable+pointer` equals the 0.9.0 constant deeply.
- `kernel.test.ts`: scan rule 5 (no object-literal `metrics.` structure in
  `ctx.part`); a live axis flip re-applies `host` and every `part()`; every
  `fitRow` re-solves on an axis change with no block deps.
- **The live-flip proof over every block**: `skin.test.ts`'s block list
  mounted at the default, flipped to compact + touch, byte-identical inline
  styles to a fresh mount — this is `AXIS_STALE` as a unit test and the
  round's gate for §4's completeness.
- `claims.test.ts`: `TARGET_SMALL` fires on a 24 px control under touch and
  not under pointer; `AXIS_STALE` fires on a block with a frozen record and
  names it.
- `prove.test.ts`: `widths × axes`, claims tagged with both.
- **Held** — every Ledger screen through a scratch copy of
  `screens.proof.test.ts` at five widths × four contexts (`{}`, compact,
  touch, compact + touch), three consecutive full runs identical: no
  `TARGET_SMALL`, no `AXIS_STALE`, no `UNSETTLED`, nothing new at the
  default; the one standing finding is Overview `FIT_COLUMNS` at (480,
  compact) and (480, compact + touch) — the F9 floor above. **Pending** —
  the same contexts and `KNOWN` rows in the committed
  `screens.proof.test.ts`: the file is dirty in the Ledger session's tree
  tonight, so the exact edit is handed over in
  [`docs/tasks/ledger-axes-proof.md`](../tasks/ledger-axes-proof.md) rather
  than made under it.
- **Held** — Chromium (Playwright, iPhone 13 emulation, the running Ledger
  dev server, 2026-08-31): `(pointer: coarse)` resolves to `touch` with no
  app code; on Transactions 68 of 72 targets are ≥ 44 px on both sides —
  Menu 63 × 44, More actions 44 × 44, inputs and selects 324 × 44, Add
  transaction 131 × 44; the four under are the checkbox's own 24 × 24 box
  (its label is the 44 px row) and the three sort buttons at 17 px inside
  their 44 px `th` (the `th` is the click target). Settings: 16 of 16. At
  1280 with a pointer: nav links 199 × 36, buttons 32 — nothing moved
  versus 0.9.0.
