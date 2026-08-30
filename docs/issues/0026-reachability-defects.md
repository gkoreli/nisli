# 0026 — Five engine decisions are not reachable by keyboard or assistive technology

**Status**: resolved (2026-08-30) by [ADR 0042](../adr/0042-engine-reachability.md) — all five defects fixed in the engine with keyboard-path proofs, three claims added (`SORT_UNREACHABLE`, `POPUP_ARIA`, `LIVE_TONE`) and two widened, zero Ledger edits; the review round's four further fixes are in 0042 §Review
**Priority**: P1
**Area**: `@nisli/engine` — `blocks/app.ts`, `blocks/table.ts`, `blocks/notice.ts` (+ `status.ts`), `blocks/form.ts`, `blocks/toolbar.ts`
**Found**: 2026-08-30, by the next-round panel
([research](../research/engine/next-round-panel-2026-08-30.md) §Synthesis),
re-verified against `main @ d5747a3` (engine 0.5.0) while filing this issue.
Line numbers below are from that tree.

## Summary

ADR 0040 says *anything that floats is a layer* and *the engine owns focus and
ARIA*; ADR 0034 says a primary never leaves. Five places in the engine do not
keep those promises. None needs a new block or a new prop; each is the engine
not doing what its own record says it does. All five are user-felt on every
Ledger screen at phone width or from a keyboard, and none is visible to a
sighted person with a mouse at 1280 px — which is why they survived.

### (a) The App bar-mode menu is a sticky sheet, not a layer

[`blocks/app.ts`](../../packages/engine/src/blocks/app.ts):

- L101-112: the narrow-mode menu is a second `<nav aria-label="Primary">`
  rendered `position: sticky; top: barHeight; zIndex: metrics.layer.bar - 1`
  under the bar. It never calls `ctx.overlay(...)`, so it is on no layer
  stack: **no Escape, no outside-pointer dismiss, no focus move on open, no
  focus return on close.** It pushes the content down instead of floating.
- L92-98: the toggle carries `aria-expanded` but no `aria-controls` and no
  `aria-haspopup`; the two nav elements have no ids to point at.
- L43: the only thing that closes the menu besides the toggle is a change of
  `props.location`.
- L60-74 + L101-112: in bar mode with the menu closed **both** `<nav>`s are
  `display: none`, so a screen-reader user on a phone has no navigation
  landmark at all.

Bar mode is every viewport below `sidebarWidth + contentMin` (792 px,
`layout.test.ts:39-42`), i.e. every phone. The Toolbar overflow menu
([`blocks/toolbar.ts:67-77`](../../packages/engine/src/blocks/toolbar.ts))
is the reference: it is a `popover` layer with all of the above.

### (b) Sortable Table headers have no keyboard; selectable rows have no name

[`blocks/table.ts`](../../packages/engine/src/blocks/table.ts):

- L189-195: a sortable `<th scope="col">` gets `aria-sort` and an
  `on: { click }` (and `cursor: pointer` at L123) — but **no `tabindex`, no
  `role`, no `keydown`**. A keyboard user cannot reach or toggle the sort;
  a screen reader announces a sortable column with nothing to activate.
- L140-148: a selectable `<tr>` gets `tabindex="0"` when `onSelect` is set
  and handles `Enter` only (not `Space`); it has **no role and no accessible
  name** — focus lands on "a row" and AT reads whatever cell text it
  chooses. There is no visible focus treatment via a part (only
  `table.row.hover`).

`table.test.ts` has no test that mentions `sort`, `onSelect`, `tabindex` or a
key (verified: `grep -n -E "sort|select|tabindex|keydown|Enter"` returns
nothing).

### (c) A negative notice is polite, dismiss is a click-only div, timers never pause

[`blocks/notice.ts`](../../packages/engine/src/blocks/notice.ts):

- L34-35: the region is `role="status" aria-live="polite"` for **every
  tone** — a `notify(msg, 'negative')` from a failed save (every
  `busy.run` rejection, [`status.ts:49,53`](../../packages/engine/src/blocks/status.ts))
  is announced at the same urgency as "Saved".
- L50-56: each notice is a `<div>` with `on: { click }` only — **no
  `tabindex`, no button, no `keydown`**, so it cannot be dismissed from a
  keyboard; the region itself is `pointerEvents: 'none'` (L45).
- L14: dismissal is a fixed `setTimeout` (8 s negative, 4 s otherwise) that
  **never pauses** on hover or focus — WCAG 2.2.1 (Timing Adjustable) and
  the practical case: a phone user reading a long sync message loses it.

ADR 0040 §Consequences recorded the first two as "still open"; this issue
takes them.

### (d) Form: a `<label for>` that targets a `radiogroup` `<div>`; a checkbox caption that is not a label

[`blocks/form.ts`](../../packages/engine/src/blocks/form.ts):

- L300 + L280-284: every field renders
  `<label for="<id>" id="<id>-label">`. For a segmented select
  (2–3 options, rule 4) the element with that id is a `<div role="radiogroup">`
  — not a labelable element, so `for=` labels nothing and clicking the label
  focuses nothing. The radiogroup does carry `aria-labelledby="<id>-label"`
  (L284), which is why the `LABEL_MISSING` checker passes it; the dangling
  `for=` is still wrong and the click affordance is still lost.
- L197-210: a checkbox is `<input type="checkbox">` beside a `<span>` showing
  `f.placeholder` (Ledger: "This is income", "Only uncategorized"). The
  caption is **not** a `<label>`: it is not part of the control's name
  (the name is the field label alone: "Kind", "Filed"), and clicking it does
  not toggle the box. `placeholder` is being used as a caption word.

### (e) Toolbar: the primary is `overflowable: true` while every document says it never leaves

[`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts):

- L52: every action, primary included, is `overflowable: true`; primary
  merely ranks last (`RANK` L16). Below `minTitle + gap + trigger + gap +
  primary` the primary goes into the "More actions" menu.
- The promise: ADR 0034 §Decision rules ("the title truncates before a
  primary action leaves"; Table: "primaries never leave"), the README
  ("At 360px the title truncates rather than lose the primary action"), and
  the agent skill (`SKILL.md:53,99`, `AGENTS.md:141` — "A primary never
  leaves … Reports `FIT_ROW` when even that fails").
- `toolbar.test.ts:66-72` proves only 360 px, where the title still absorbs
  the deficit; nothing proves the width where it cannot.

Table keeps the promise (`table.ts:93`, `overflowable: c.priority !==
'primary'`); Toolbar does not. Same word, two meanings. ADR 0042 decides
which is right (the promise) and records the rule.

## Why it matters

1. **These are broken promises, not missing features.** 0040 and 0034 state
   the rules; the code does not keep them. Nothing new is added by fixing
   them.
2. **Every Ledger screen is affected without a line changing.** The shell
   menu is on every screen below 792 px; four sortable columns on
   `transactions.ts`; selectable rows on seven tables across six screens;
   `notify` on every mutation, `negative` on every failed async action;
   segmented selects in the transaction dialog and Settings; checkboxes in
   Rules and Transactions filters.
3. **The proof cannot see them.** `prove()` (ADR 0041) has a `NAME_MISSING`
   and an `UNREACHABLE` claim, but a `<th>` with a click handler and a
   `<div>` with a click handler are invisible to both — they are not
   `INTERACTIVE`. That is the class of defect the claim catalogue must grow
   to catch, or it recurs.

## Options

1. **Fix each in the engine, composing what exists** — the menu through
   `ctx.overlay({ kind: 'popover' })`, the header as a `<button>` in the
   `<th>`, the row named from its primary cell, the notice with a Dismiss
   button and tone-mapped live region, the checkbox caption as a `<label>`,
   the primary `overflowable: false` with `FIT_ROW` when even the minimum
   row cannot fit. Zero Ledger edits. This is ADR 0042.
2. Document the gaps in the skill and leave the code. Not an option: the
   skill would then teach that `priority: 'primary'` means two things.

## Notes

- The panel's related findings that are **not** this issue: no skip link, no
  `h1`, the document title never changing, breadcrumbs. Those are shell /
  router seam questions and are listed as non-goals in 0042.
- Related open items: [0023](./0023-actions-block-for-dialogs.md) (dialog
  action row — the `fitRow` + popover it needs is unaffected by this issue).
