# 0042. Engine Reachability — Every Decision Reachable by Keyboard and AT

**Date**: 2026-08-30
**Status**: Accepted (2026-08-30, after one review round — see §Review)
**Depends on**: [0040-engine-overlay-domain](./0040-engine-overlay-domain.md) (the layer stack the menu composes; "the engine owns focus and ARIA"), [0041-engine-proof-domain](./0041-engine-proof-domain.md) (the claims that make a regression red), [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md) (the `priority` rule this ADR makes true)
**Resolves**: [issue 0026 — five engine decisions are not reachable by keyboard or AT](../issues/0026-reachability-defects.md) (resolved by this record)
**Code**: [`packages/engine/src/blocks/app.ts`](../../packages/engine/src/blocks/app.ts), [`blocks/table.ts`](../../packages/engine/src/blocks/table.ts), [`blocks/notice.ts`](../../packages/engine/src/blocks/notice.ts), [`blocks/form.ts`](../../packages/engine/src/blocks/form.ts), [`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts), [`engine/fit.ts`](../../packages/engine/src/engine/fit.ts) (slack snap), [`test/claims.ts`](../../packages/engine/src/test/claims.ts), [`blocks/kernel.ts`](../../packages/engine/src/blocks/kernel.ts) `onPointerdown` (anchor-inside, from review); composing [`engine/overlay.ts`](../../packages/engine/src/engine/overlay.ts) and `ctx.overlay` unchanged
**Research**: [`next-round-panel-2026-08-30.md`](../research/engine/next-round-panel-2026-08-30.md) §Synthesis (the adopted plan)

## Context

0040 finished with two sentences that are the whole of this record's
mandate: *anything that floats is a layer*, and *the engine owns focus and
ARIA*. 0034 added the rule that an author's `priority: 'primary'` means the
thing never leaves. Issue 0026, filed from a read of `main @ d5747a3`,
records five places where the engine does not keep those promises:

| | where | what a keyboard / AT user gets today |
|---|---|---|
| (a) | `app.ts:92-112` | The phone menu (every viewport < 792 px) is a `position: sticky` sheet: no Escape, no outside dismiss, no focus move, no focus return, no `aria-controls`; with it closed there is no navigation landmark at all. |
| (b) | `table.ts:140-148, 189-195` | A sortable `<th>` has `aria-sort` and a click handler and cannot be focused or toggled by key. A selectable `<tr>` has `tabindex` but no role, no name and no Space. |
| (c) | `notice.ts:14, 34-35, 50-56` | Every tone is `role=status aria-live=polite`, including a failed save. A notice is a click-only `<div>`. The 4 s / 8 s timer never pauses. |
| (d) | `form.ts:197-210, 280-300` | `<label for>` points at a `radiogroup` `<div>`. A checkbox's caption is a `<span>` reading `f.placeholder`, not a `<label>`. |
| (e) | `toolbar.ts:52` | The primary action is `overflowable: true`; below `minTitle + trigger + primary` it goes into the menu, which ADR 0034, the README and the agent skill all say never happens. |

None is visible to a sighted mouse user at desktop width, which is why the
Proof round's nine-screen table is all "pass" and this is still true. The
panel ranked fixing these first for the post-Proof round because the fix is
composition of what exists (the layer stack, the kernel scan, the claim
catalogue), deletes bespoke code, and changes what a person can *do* on every
Ledger screen with zero Ledger edits.

**Rules this round works under.** No new blocks and no new props — an app
still states intent only. Exactly one way to style (`ctx.part()`, enforced
by the kernel scan). Overlays compose `engine/overlay.ts` through
`ctx.overlay` — there is not a third focus implementation. Every fix ships
with a proof that drives the keyboard path through `mount()`; an assertion
that an element exists is not a proof. `packages/ledger` is not touched.

## Decision

### Ubiquitous language (additions)

| term | meaning | where it lives |
|---|---|---|
| **Reachable** | A decision the engine made is *reachable* when a keyboard user can get focus to it, operate it with the keys its ARIA role promises, and an AT user hears what it is. Every interactive thing a block renders is reachable or the block is wrong. | this ADR; `test/claims.ts` |
| **Live tone** | The mapping from a notice's `Tone` to how it is announced: `negative` → `role="alert"` / `aria-live="assertive"`; every other tone → `role="status"` / `aria-live="polite"`. The app says the tone; the engine says the urgency. | `blocks/notice.ts` |
| **Minimum row** | The Toolbar row with every non-primary action overflowed, the title at `minTitle`, the trigger (if anything overflowed) and the primaries at natural width. Below it the row cannot fit and says so. | `blocks/toolbar.ts`, `FIT_ROW` |

### The rule per defect

**(a) The App menu is a popover layer.** In bar mode the menu is
`ctx.overlay({ kind: 'popover', open, onDismiss, anchor: () => toggle,
within: () => nav, size, initialFocus, restoreFocus })` where `open` is
`mode === 'bar' && menuOpen`, so at sidebar width no layer is ever pushed.
The engine then does what it already does for the Toolbar menu: Escape
closes it, an outside pointer closes it, focus moves to its first link on
open (`initialFocus`), focus returns to the toggle on close, it is placed in
viewport coordinates at `metrics.layer.popover` and no longer pushes the
content down. **Placement:** the sheet is the phone drawer shape — placed by
`placement.top` only (below the toggle, from `placeMenu`) and styled
`position: fixed; left: 0; right: 0`, full width under the bar; there is no
`align` (`PlaceOptions.align` is `leading | trailing` only, neither applies
to a full-width sheet), and `size()` returns `{ width: ctx.width,
height: metrics.control.height }` so the fallback placement is at the left
edge. Like the Toolbar's menu it is `visibility: hidden` until `placement`
resolves (a microtask after open), so it never paints at the corner.

**The pattern is APG *disclosure navigation*** (a "Disclosure (Show/Hide)
Navigation Menu"): the toggle is `<button aria-label="Menu"
aria-expanded aria-controls="<nav id>">` and carries **no `aria-haspopup`** —
WAI-ARIA 1.1+ defines `aria-haspopup="true"` as a synonym of `"menu"`, and
this is not a menu. The arrow keys are the pattern's optional extension,
borrowed from the Toolbar's `onMenuKey`/`onTriggerKey` model: ArrowDown on
the toggle opens on the first link, ArrowUp on the last, ArrowUp/ArrowDown
move with wrap, Home/End jump, Tab and Shift+Tab leave to the tabbable
after/before the toggle and close. The links stay natively tabbable (no
roving `tabindex` — they are `<a href>`s that must also be plain links in
the sidebar), which is why Tab is intercepted at the nav and leaves the
whole sheet, as the Toolbar's does. Every key handler is on the nav or the
toggle, so the kernel scan keeps forbidding a document listener in
`app.ts`. The sticky sheet and its `zIndex: bar - 1` are deleted.

**Navigation closes it without moving focus.** A `location` change closes
the sheet with `restoreFocus: () => false` — the Toolbar's `leaving`
mechanism, already in `OverlaySpec` — because the router owns focus on
navigation (Non-goals) and a popover otherwise restores focus to its anchor
on every close; the toggle must not fight the router for it.

The menu keeps `role="menu"` + `role="menuitem"` on its links? **No.** Links
that navigate are links; the WAI-ARIA menu pattern is for application
commands, and a `menuitem` that is an `<a href>` is announced without its
destination. The surface is `<nav aria-label="Primary">` containing `<a>`s,
with the key model above. The `MENU_ITEM_ROLE` claim does not fire because
there is no `[role=menu]`.

The landmark: one `<nav aria-label="Primary">` whose *display* the mode
decides, not two. In sidebar mode it is the sticky column; in bar mode it is
the layer's surface, `display: none` while closed — so on a phone the
landmark exists only while open, which is the same as every phone app's
drawer. The skip link, `h1` outline and document title stay out of scope
(Non-goals).

**(b) A sortable header is a button; a selectable row has a name.**

- The `<th scope="col">` keeps `aria-sort` (the attribute belongs on the
  header cell). Inside it, when `c.sortable`, the header text renders as a
  real `<button type="button">` styled through `ctx.part([], …)` — a reset
  (`font`, `color` and `text-align: inherit`, no background, no border, no
  padding beyond the cell's own, full cell width, `inline-block` so the
  estimator measures it as the cell's text) and no button look, so under the
  cell's own `table.header` part it looks as it does today. Its accessible name is
  the header text (the sort mark is `aria-hidden`). Enter and Space toggle
  through the same `toggleSort(c)` as click, because a button does that
  natively; the block adds no keydown. A non-sortable header stays text.
- The `<tr>` keeps `tabindex="0"` when `onSelect` is set and gains an
  accessible name from its primary cell: `aria-labelledby` pointing at the
  first primary column's `<td>`, falling back to the first cell. The cell's
  id is `${tableId}-r<n>-<col>` where `<n>` comes from a **per-render
  counter**, not the row's index — `each()` keeps a row's element across a
  keyed reorder (a sort), so an index-derived id would collide or drift;
  `ID_DUPLICATE` is the guard. It gains `role="button"`? **No.** A row is
  a row; replacing `row` would break the table semantics AT builds columns
  from. It stays a focusable `tr` with a name; `Enter` and `Space` both
  select (Space with `preventDefault` so the page does not scroll). A
  focused row lights up through the existing `table.row.hover` part, which
  the block applies while the row is hovered *or* holds focus (`focusin`/
  `focusout`) — no new part, the skin decides how, the block only says
  which; one styling door.

**(c) Notices: live tone, a Dismiss button, Escape, paused timers.**

- The region is split by live tone: one `role="status" aria-live="polite"`
  container and one `role="alert" aria-live="assertive"` container, both
  inside the single passive layer's fixed box; a notice mounts into the one
  its tone maps to. `negative` is the only assertive tone. Two containers
  rather than a per-notice role because live regions must exist *before*
  content arrives to be announced reliably.
- Each notice is a `<div role="group" aria-label="<tone> notice"
  data-nisli-tone="<tone>">` holding the text and a `<button type="button"
  aria-label="Dismiss">` (`×`, through `ctx.part([], buttonBox…)` — a reset
  inheriting the notice's own colour, since a `button.plain` look would put a
  bordered white box on a tinted toast).
  `data-nisli-tone` is a **test seam stamp** in the family of
  `data-nisli-report` and `data-nisli-action` — evidence for a checker, not a
  prop and not a capability; nothing in the engine reads it back. The button
  is in the tab order; Enter/Space dismiss natively. Escape on a focused
  notice (keydown inside the notice's own element, not a document listener)
  dismisses that notice and calls **`preventDefault()`** — the overlay
  manager honours `e.defaultPrevented` first (`kernel.ts` `onKeydown`), which
  is the mechanism the proof asserts; `stopPropagation` alone would also
  work but is not what the manager checks. The region's `pointerEvents:
  'none'` stays; each notice is `auto`.
- The timer becomes a resumable countdown owned by the notice: it pauses on
  `pointerenter` and `focusin`, resumes on `pointerleave`/`focusout` with the
  remaining time (WCAG 2.2.1). Durations stay 8 s / 4 s. No new prop; the
  app still says `notify(text, tone)`.
- Because the notice now holds a focusable, the `passive` layer's "never
  focused" note in 0040's table is amended to "never focused *by the
  engine*"; a person may Tab to it **while no modal is open**. It is still
  transparent to Escape at the stack level (`reach()` unchanged). **Known
  limit:** while a modal is open the Tab guard cycles inside the topmost
  modal's surface and the notice region is body-mounted outside it, so a
  notice over a dialog is reachable by pointer or by timer only — correct
  modal semantics, recorded here so nobody files it as a bug. The proof for
  "Escape on a focused notice leaves the dialog's layer" therefore focuses
  the notice programmatically, not by Tab.
- `status.ts` is unchanged in shape: `busy.run` rejections still call
  `notify(message, 'negative')`, which is now assertive.

**(d) Form labels point at what they label.**

- A field's `<label>` carries `for=` **only when** the control is a labelable
  element (input, select, textarea). For a segmented group the `<label>`
  becomes a plain **`<span id="<id>-label">`** — a `<span>`, not an
  unassociated `<label>`, which is a known AT trap — and the `<div
  role="radiogroup" aria-labelledby="<id>-label">` already there supplies
  the association; the span's click handler calls the existing `focusField`
  (`form.ts:131`), which focuses the checked radio (else the first). Because
  segmented-or-select is decided from the option count at render, the label
  element is a computed over that same decision. `formLabels`' selector
  keeps matching `[role=radiogroup]` through `aria-labelledby` — unchanged.
  No `for=` ever targets a `<div>`.
- A checkbox's caption becomes the `<label for="<id>">`: the field label
  ("Kind", "Filed") stays the group heading as a `<span id="<id>-label">`
  and the input is `aria-labelledby="<id>-label <id>-caption"`, so the
  accessible name is "Kind This is income" and clicking the caption
  toggles the box. `Field.placeholder` keeps supplying the caption text
  — no new prop; the rule is that for `kind: 'checkbox'` the engine renders
  `placeholder` as the caption label, which is what the two Ledger sites
  already assume.

**(e) The primary never leaves — the promise is right, the code is wrong.**

The panel's evidence cuts both ways: below `minTitle + trigger + primary`
the code moves the primary into the menu, and one could argue that at such a
width *something* must give. The decision is that the primary is **never**
`overflowable`, for three reasons recorded here so the next reader does not
re-argue it:

1. *A title at minimum that still cannot fit is exactly when hiding the
   primary is wrong.* At that width the row is already broken; the one verb
   the screen exists for ("Add transaction") is the last thing to take out
   of the place a person is looking, and putting it behind "⋯" is the
   silent-failure shape 0030.1 B1 exists to delete. The honest state is a
   standing `FIT_ROW` report — which `prove()` turns into a red claim — not
   a quiet demotion that passes every proof.
2. *One word, one meaning.* Table already keeps it
   (`overflowable: c.priority !== 'primary'`, `table.ts:93`). 0034 §Decision
   rules is **ambiguous** about Toolbar — it says the title truncates (to
   `minTitle`) *before* a primary action leaves, which does not say the
   primary never leaves — while its Table bullet is not ambiguous, and the
   README and the skill read the Toolbar sentence as "never". This ADR
   resolves the ambiguity toward Table's rule and amends 0034 (see "Records
   amended"). The vocabulary round (research, deferred) found "same word,
   two meanings" as the engine's worst contract defect; this is its one
   user-felt instance. `fit()`'s contract already has it: `overflowable`
   omitted → must stay.
3. *Nothing in Ledger reaches the width where the two rules differ* — the
   panel puts it below ~250 px — so the change costs no screen anything and
   buys the guarantee an agent is told to rely on.

The rule: `overflowable: a.priority !== 'primary'` in `toolbar.ts` items.
When even the minimum row cannot fit, `fit()` returns negative `slack`,
`reportIf` files `FIT_ROW` (detail already reads "title … and its primary
actions cannot fit"), the primary stays in the row at natural width, the
title at `minTitle`, and the trigger stays iff something non-primary
overflowed. Two primaries are both kept; the later one is not demoted (equal
priority gives ground from the end only through shrink/stack, and buttons
have neither). The skill's sentence becomes literally true.

### The claims to add (`test/claims.ts`)

So that `prove()` catches each regression, three checkers join the
catalogue and one is widened; each ships with a positive and a negative
fixture in `claims.test.ts` as 0041 requires:

| code | what it catches | blind spot |
|---|---|---|
| `SORT_UNREACHABLE` | A `th[aria-sort]`, or a `th` the engine styled `cursor: pointer`, that contains no focusable control (`INTERACTIVE`) — a sortable header a keyboard cannot reach. | A header whose button exists but whose handler is missing is not seen; the keyboard proof in `table.test.ts` covers that. |
| `POPUP_ARIA` | A visible `[aria-expanded]` control without an `aria-controls` that resolves to an element (catches the App toggle as it is today); an `[aria-expanded="true"]` whose controlled element is hidden (a menu that says open and is not); an `[aria-haspopup]` without `aria-controls` (a general rule; the App toggle carries none). **Timing:** an anchored popover is `visibility: hidden` until `placement` resolves in a microtask, and `isHidden` reads `visibility`, so over an *open* menu the checker is asserted after `tick()`/settle — as `prove()` does — or the "expanded but hidden" clause fires on the frame between open and placement. | Whether the controlled element is actually a layer on the stack is not in the DOM; `blocks/overlay.test.ts` proves that through `__layers`. |
| `LIVE_TONE` | A `[data-nisli-tone="negative"]` notice inside a `[aria-live="polite"]` or `[role="status"]` container; or any `[aria-live="assertive"]` / `[role="alert"]` container holding a notice whose `data-nisli-tone` is not `negative`. Catches (c) as it is today. | Reads the notice's `data-nisli-tone` stamp (decision (c)), not the skin: a notice rendered by something other than `notify()` carries no stamp and is not seen. |
| `NAME_MISSING` (widened) | `NAMED` grows to include non-native `[tabindex]:not([tabindex="-1"])` elements (a focusable `tr`, `div`), which must have a name **from the author** — `aria-label`, or `aria-labelledby` that resolves to text. Text content does not count for them: `accessibleName()` falls back to content for non-native elements, so a `<tr>` full of cell text would otherwise pass vacuously. Catches the row in (b). | Same accname limits as 0041 for the native set. |
| `LABEL_MISSING` (widened) | A `label[for]` whose target is not a labelable element (`input`, `select`, `textarea`, `button`, `meter`, `output`, `progress`) is a claim. Catches (d). | — |

`UNREACHABLE` is unchanged; `MENU_ITEM_ROLE` is unchanged and does not fire
on the App nav (no `role=menu`, by decision (a)).

### What does not change

`AppProps`, `TableProps`/`Column`, `notify()`'s signature, `Field`,
`ToolbarProps`/`Action`: **no new prop, no new block.** `engine/overlay.ts`
and `useOverlay` are not edited — the App menu is a fifth consumer of the
existing `popover` kind, which is the second real popover 0040's plan wanted
as evidence. The kernel scan (rules 1–7) runs unchanged over every touched
block; **no new part** — the row's focus treatment reuses `table.row.hover`,
so the default skin is untouched.

One solver edit fell out of (e): `engine/fit.ts` snaps a slack within
`1e-6` px to zero. A title that gives exactly the deficit left
`slack = -5.7e-14` in floats; before, the primary then overflowed and hid
the noise, and after (e) the noise stood as a `FIT_ROW` filed every turn,
so a fitted Ledger toolbar (Budgets at 360) never settled. A fitted row is
never reported; acceptance 6 carries the pure case with the estimator's
real widths.

## Review — what changed and why

The build landed all eleven gate CHANGES of the panel round, and the review
of that build (read of the diff plus a scratch vitest run) returned
**CHANGES** with four defects that must be fixed before PASS and two notes.
Every one is recorded here as a rule, because each is the kind of thing a
proof that only clicks would pass again.

| # | finding | the rule now | where |
|---|---|---|---|
| 1 | **A tap on the open toggle reopened the menu.** `within` is the nav and the toggle is outside it, so a real tap ran `pointerdown` → manager dismiss → `click` → `openMenu()`. On a phone the menu could not be closed by its own button. The Toolbar trigger had the identical defect; every existing test opened with a bare `.click()`, which is why both passed. | The manager treats the reachable layer's **anchor as inside**: `onPointerdown` counts a node inside a layer if the surface *or* `spec.anchor?.()` contains it. Fixed once in the manager, not per block — the third-focus-implementation rule. Proof: `pointerdown` on the toggle/trigger **then** `click()` while open → `__layers` empty, `aria-expanded="false"`, focus on the toggle (App block and Toolbar block in `overlay.test.ts`). | `kernel.ts` `onPointerdown` |
| 2 | **`LIVE_TONE` had a passing-but-broken variant.** A negative notice inside no live container (roles stripped, or a container that lost `role`/`aria-live`) yielded no claim, because the negative branch required `polite && !assertive` and the other required `assertive`. | `tone === 'negative' ? !assertive : !polite` → claim. Fixtures: `<div><div data-nisli-tone="negative">Failed</div></div>` → `['LIVE_TONE']`, and a non-negative notice outside any container → `['LIVE_TONE']`. | `claims.ts` `liveTone` |
| 3 | **A keyboard Dismiss dropped focus to `<body>`.** Enter on Dismiss or Escape on the notice removed the focused element; the next Tab restarted from the top of the document (WCAG 2.4.3). The test said "back in the dialog" but asserted only that a later Escape still closed the dialog. | The notice records where focus came from on its own `focusin` (`relatedTarget`); `dismiss`, when `activeElement` is inside the notice, focuses that element if still connected, else the nearest `main` / the modal surface through the existing `restoreTarget` shape. Stays on the notice element — no document listener. Proof asserts `document.activeElement` after Enter-dismiss and after Escape-dismiss (in the dialog case: the `[role=dialog]` contains it). | `notice.ts` `dismiss`, the notice's `focusin` |
| 4 | **Row `keydown` fired for any control inside a cell.** Enter/Space bubbling from a checkbox or button rendered in a `Content` cell would select the row and Space would be prevented, making the control unusable. No Ledger cell holds a control today; the block's promise is generic. | The row handler is guarded on `e.target === e.currentTarget`. Proof: a cell rendering `<button id="in">`, Space on `#in` → not prevented, `onSelect` not called. | `table.ts` row `keydown` |
| 5 | (note) `aria-label="negative notice"` is engine vocabulary read aloud, and inside a live region it is announced on arrival. | The group name uses human words — `Error` / `Success` / `Warning` / `Note` — while `data-nisli-tone` stays the checker's evidence. If a build keeps the tone words, this record's sentence applies: the tone words are the spoken names. | `notice.ts` the notice's `aria-label` |
| 6 | (note) Ledger-visible meaning changes the first draft did not record. | Added to §Consequences: width-dependent row names, the checkbox heading as a `<span>`, and `restoreFocus: () => !leaving && mode.peek() === 'bar'` so a bar→sidebar flip while open never restores focus to a hidden toggle. | `app.ts` `restoreFocus` |

Why these were not caught by the first gate: every menu proof opened with
`.click()` (no `pointerdown` precedes a synthetic click); the `LIVE_TONE`
fixtures only exercised the tone map, never a missing container; the notice
proofs asserted the stack, not `activeElement`; the row proof pressed keys on
the row, never on a child. The acceptance list below carries the added cases
so the gate is no longer weaker than the review.

## The rules as implemented

| rule | where |
|---|---|
| One `<nav aria-label="Primary">` whose display the mode decides; in bar mode it is the surface of `ctx.overlay({ kind: 'popover', within: nav, anchor: toggle, size, initialFocus, restoreFocus })`; `open = mode === 'bar' && menuOpen` | `app.ts` `render` (`overlay`, `openMenu`) |
| Toggle: `aria-label="Menu"`, `aria-expanded`, `aria-controls="<id>-nav"`, no `aria-haspopup`; ArrowDown opens on the first link, ArrowUp on the last | `app.ts` toggle `keydown` (`openMenu(at)`) |
| Nav keys: ArrowDown/Up with wrap, Home/End, Tab/Shift+Tab leave to the tabbable after/before the toggle and close with `leaving = true` | `app.ts` nav `keydown` (`focusLink`) |
| A `location` change closes without restoring focus (`stopNav` effect sets `leaving`); `restoreFocus: () => !leaving && mode is bar` | `app.ts` `stopNav`, `restoreFocus` |
| Sheet: `position: fixed; left: 0; right: 0`, placed by `placement.top`, `visibility` gated on `placement`, z from `overlay.z`; the sticky sheet, its `zIndex: bar - 1` and the second `<nav>` are gone | `app.ts` nav style |
| The reachable layer's anchor counts as inside on `pointerdown` | `kernel.ts` `onPointerdown` |
| Sortable `<th scope="col">` keeps `aria-sort`; its text is a `<button type="button">` reset through `ctx.part([], …)` (`inline-block`, so the estimator measures the cell); sort mark `aria-hidden`; Enter/Space toggle through `toggleSort(c)` natively; no click or cursor on the cell | `table.ts` header cell |
| Every `<td>` has `${tableId}-r<n>-<col>` from a per-render counter; a selectable `<tr>` has `tabindex="0"` and `aria-labelledby` → the first primary cell (fallback: first cell) | `table.ts` row (`rowId`, `nameColumn`) |
| Enter and Space select (Space `preventDefault`), only when `e.target === e.currentTarget`; `table.row.hover` applies while hovered or focused | `table.ts` row `keydown`, `focusin`/`focusout` |
| One fixed box holding `[role=status][aria-live=polite]` and `[role=alert][aria-live=assertive]` containers, both present before any notice; `negative` → assertive | `notice.ts` `defineRegion` (`container`, `isAssertive`) |
| A notice is `div[role=group][aria-label][data-nisli-tone]` + `button[aria-label=Dismiss]`; Escape on the notice `preventDefault`s and dismisses; focus returns to where it came from | `notice.ts` `notice`, `dismiss` |
| Resumable countdown: pause on `pointerenter`/`focusin`, resume with the remaining time on `pointerleave`/`focusout`; 8 s negative, 4 s otherwise | `notice.ts` `countdown` |
| `busy.run` rejections still call `notify(message, 'negative')` — unchanged, now assertive | `status.ts` |
| Field heading is a computed: `<label for>` for a labelable control; `<span id="<id>-label">` (click → `focusField`) for a segmented group; `<span>` for a checkbox whose caption is `<label for=id id="<id>-caption">`, input `aria-labelledby="<id>-label <id>-caption"`; the `placeholder` attribute is not set on a checkbox | `form.ts` field heading computed, checkbox branch, `focusField` |
| `overflowable: a.priority !== 'primary'`; below the minimum row `FIT_ROW` stands and the primary stays at natural width | `toolbar.ts` items |
| Slack within `1e-6` px snaps to zero, so a fitted row is never reported | `fit.ts` `EPSILON` |

### The claims as added

`test/claims.ts`, in checker order after `reachable`: `sortReachable`
(`SORT_UNREACHABLE`), `popupAria` (`POPUP_ARIA`), `liveTone` (`LIVE_TONE`,
with the review's "no container" branch). `accessibleNames` widened:
`FOCUSABLE_NON_NATIVE` needs an authored name. `formLabels` widened:
`label[for]` must target a labelable element. Each has positive and negative
fixtures in `claims.test.ts`; the checker-order test lists all eleven.

## Acceptance — the keyboard proofs

Each defect lands as one commit with its proof; a proof drives keys through
`mount()` in happy-dom and reads what changed. Vacuous assertions
(an element exists, an attribute is set) do not count.

1. **`blocks/overlay.test.ts` — App menu at 360.** Mount `App` at 360 with
   three nav items. Click the toggle: `aria-expanded="true"`, the layer stack
   (`__layers`) has one `popover`, `document.activeElement` is the first
   link. `ArrowDown` ×2 then `Home`/`End`: focus walks with wrap. `Escape`:
   stack empty, `aria-expanded="false"`, focus on the toggle. Reopen;
   `pointerdown` outside: closed, focus on the toggle. Reopen; `Tab`: closed,
   focus on the tabbable after the toggle (the content's first control).
   Reopen; change `location`: closed **and focus did not move to the
   toggle** (the router owns it). At 1280 the toggle is `display: none`
   and no layer is ever pushed. `POPUP_ARIA` over the mounted App is empty,
   closed and — after `tick()` — open. Reopen; `pointerdown` on the toggle
   **then** `click()`: closed, focus on the toggle (review 1; the same case
   for the Toolbar trigger). This is the App menu's **only** gate: see
   acceptance 8.
2. **`blocks/table.test.ts` — sort and select by key.** Mount a Table with
   `sortable` columns and `onSort`. `Tab` reaches the first sortable header's
   button (assert `activeElement`); `Enter` calls `onSort({ by, dir: 'asc' })`
   and `th[aria-sort]` reads `ascending`; `Space` calls it again with `desc`.
   A non-sortable `th` contains no button. With `onSelect`: `Tab` from the
   last header lands on the first row; `accessibleName(tr)` equals the
   primary cell's text; `Enter` and `Space` each call `onSelect(row)` once;
   Space's default is prevented. `SORT_UNREACHABLE` and `NAME_MISSING` over
   the mounted table are empty; a fixture `th` with `aria-sort` and no button
   makes `SORT_UNREACHABLE` fire. A cell rendering `<button id="in">`:
   Space on `#in` is not prevented and `onSelect` is not called (review 4).
3. **`blocks/extras.test.ts:103` — from "is polite" to the tone map.**
   `notify('Saved', 'positive')` lands in `[role=status][aria-live=polite]`;
   `notify('Failed', 'negative')` lands in `[role=alert][aria-live=assertive]`.
   Each notice has a `button[aria-label=Dismiss]`; with no modal open `Tab`
   reaches it and `Enter` removes that notice from `__notices`. `Escape` on a
   notice **focused programmatically** (a modal's Tab guard never reaches
   the region — the known limit in (c)) removes it, the keydown is
   `defaultPrevented`, and an open Dialog's layer stays on the stack (Escape
   did not reach the dialog). With fake timers: 4 s elapses → gone; a second notice,
   `focusin` at 1 s, advance 10 s → still present; `focusout`, advance 3 s →
   gone (remaining time, not a restart). After Enter-dismiss and after
   Escape-dismiss `document.activeElement` is where focus came from — in the
   dialog case the `[role=dialog]` contains it (review 3). `LIVE_TONE` over
   the region is empty; a fixture negative notice under `polite`, and one
   under no live container at all, make it fire (review 2).
4. **`blocks/form.test.ts` — labels resolve.** For a 3-option select the
   `label` has no `for`, the `radiogroup`'s `aria-labelledby` resolves to the
   label text, and clicking the label focuses the checked radio. For a
   checkbox, `accessibleName(input)` includes the caption text, and clicking
   the caption toggles the draft value. `LABEL_MISSING` (widened) over the
   form is empty; a fixture `label[for]` → `div` makes it fire.
5. **`blocks/toolbar.test.ts` — the minimum row.** With `textMeasurer(8)`
   and the README's four actions, mount at a width below `minTitle + gap +
   trigger + gap + primary`: `shown` is `['save']`, the primary button is
   `display: inline-flex`, the title is at `minTitle`, the trigger is shown
   (three actions overflowed), and a `FIT_ROW` report is standing
   (`data-nisli-report="FIT_ROW"` on the host, `reports` from `mount()`). A
   Toolbar with only a primary at that width has no trigger and still
   reports. At 360 the existing test is unchanged.
6. **`engine/fit.test.ts` — pure.** Two items, one rigid non-overflowable
   with `priority 20`, available less than its width: `overflowed` is empty,
   `slack` is negative. Already the solver's contract (`overflowable`
   omitted → must stay); the test names the Toolbar case. And the float
   case: widths `174.993 / 101.643 / 37.421` at 328, the title shrinks by
   the deficit, `slack` is exactly `0` (fails without the snap).
7. **`test/claims.test.ts`** — positive and negative fixtures for
   `SORT_UNREACHABLE`, `POPUP_ARIA`, `LIVE_TONE`, and the widened
   `NAME_MISSING` / `LABEL_MISSING`.
8. **`packages/ledger/src/screens/screens.proof.test.ts`** stays green with
   **zero edits** and its `KNOWN` map stays empty — the widened claims must
   find nothing on nine screens at five widths once the engine fixes land,
   which is the dogfood gate. **It does not exercise the shell:** it proves
   the `screens` factories, not `App` (`main.ts:14` is where App is
   composed), so it never opens the phone menu. The App menu's only gate is
   acceptance 1; the "Shell, every screen" consequence below is asserted by
   the engine proof, not the Ledger proof.

Engine typecheck and the kernel scan green; `pnpm -F ledger typecheck` and
its tests green with no diff under `packages/ledger`.

## Consequences — what Ledger does differently, with no line changing

Shell, every screen below 792 px: **Menu** opens as a floating layer over the
content instead of pushing it down; focus lands on "Overview"; arrows move;
Escape or a tap outside closes it and focus is back on the button; Tab leaves
it. A screen reader hears "Menu, button, collapsed".

| screen | what changes |
|---|---|
| Overview (`overview.ts`) | Shell menu. Two tables' rows are not selectable (no change). `‹ Previous` / `Next ›` / `This month`: no primary, so the toolbar rule changes nothing. |
| Accounts (`accounts.ts`) | Shell menu. "Add account" can never move into "⋯". The add-account dialog's `Type` select is 3+ options (native select) — no change. |
| Account (`account.ts`) | Shell menu. Transactions rows are Tab-reachable with the name "Date · Payee" text of the primary cell; Enter/Space opens the editor. "Add transaction" never leaves. |
| Transactions (`transactions.ts`) | Shell menu. **Date / Payee / Category / Amount headers are buttons**: Tab to them, Enter/Space sorts, `aria-sort` follows. Rows named by the date cell; Enter/Space opens the editor. The filters' "Only uncategorized" caption is a label: clicking it toggles, its name includes the caption. "Add transaction" never leaves. |
| Budgets (`budgets.ts`) | Shell menu. Rows named by the category cell; Enter/Space edits. "Add budget" never leaves. "Budget saved/added/deleted" polite as before. |
| Import (`import.ts`) | Shell menu. The wizard's segmented groups — `Amounts are` (2 options, `import.ts:69`) and `Date format` (3, `import.ts:67`): their labels no longer carry a dangling `for`; clicking one focuses the checked segment. Any checkbox fields (`hasHeader`, `invert`) get a caption that is a label. |
| Rules (`rules.ts`) | Shell menu. Two tables' rows named by "Matches" / "Payee"; Enter/Space acts. "This is income" caption is a label. "Add rule" never leaves; "Apply to uncategorized" and "Add category" overflow first as before. |
| Connections (`connections.ts`) | Shell menu. Rows named by institution. "Connect a bank" never leaves. Sync results stay polite; a failed sync from `busy.run` is now **assertive** (`role=alert`). |
| Settings (`settings.ts`) | Shell menu. `Appearance` (System/Light/Dark) is a segmented group whose label now resolves. Backups rows named by date; Enter/Space restores (after `confirm()`). **"Could not restore that backup." / "Could not read that file." are announced assertively**, can be dismissed with a focused Dismiss button or Escape, and do not vanish while being read. |
| Transaction dialog (`transaction-dialog.ts`) | `Type` (Expense/Income) is a segmented group; its label resolves and focuses the checked segment. Inside the modal, the menu of a Toolbar (none here) and notices behave as 0040 says. |

Three changes the review asked to be recorded, because they are visible
without a line of Ledger changing:

- **Row names depend on width.** The name is the primary `<td>` *including
  its folded values*, so a Transactions row is announced as "Aug 1 REI ·
  Groceries …" at 360 and "Aug 1" at 1280. Arguably better — the folded
  values are what the row shows there — but it is a change.
- **A checkbox heading is a `<span>`.** Clicking "Kind" or "Filed" no longer
  toggles the box; only the caption ("This is income", "Only uncategorized")
  does, because the caption is the `<label for>`.
- **A menu open across a bar→sidebar flip** (a rotation) closes without
  restoring focus to the now-hidden toggle.

Every `notify(…, 'negative')` — including the engine's own from a rejected
action — interrupts; every other tone waits. Every notice can be dismissed
from the keyboard and focus goes back where it came from; hovering or
focusing one holds it.

**Records amended (done with this record's acceptance):** 0040's consumer table gains the App menu
(`popover`, surface: the nav, anchor: the toggle) and its "still open" line
is closed; 0040 §Long-term plan item 2 is marked done for the menu case; 0034
§Decision rules "Toolbar taste" gains "a primary is never overflowable";
README §Overlays and §Blocks (Toolbar, Table, notify) and an §Accessibility
paragraph; the nisli-engine skill regenerated (`block-toolbar`,
`decide-priority-lever` now literally true; `block-table` gains "sortable
headers are buttons; selectable rows are named"); CHANGELOG 0.6.0; issue
0026 → resolved; this ADR → Accepted. 0034's reachability sentences
now point here.

## Non-goals

- **No skip link, no `h1`, no document title, no breadcrumbs.** The panel's
  app-navigation evaluation showed each is a seam with the router (which
  owns `main`, focus-on-navigation and `document.title`) or needs a route
  tree that does not exist. They are recorded there, not here.
- **No third focus implementation.** If the App menu needs something
  `useOverlay` lacks, the answer is to extend `useOverlay` for every
  consumer, not to add a listener in `app.ts` — the kernel scan enforces
  this.
- **No new words.** No `Action.overflowable`, no `Column.selectable`, no
  `notify` options, no `Field.caption`. Where a rule needed an input the
  engine already had one (`priority`, `onSelect`, `tone`, `placeholder`).
- **No `role=menu` on navigation links** (decision (a)); no `role=button` on
  rows (decision (b)).
- **No touch/density axis, no target-size claim, no contrast work** — the
  next candidates in the panel's ranking, each its own record.
- **No Empty/Form/confirm `Action` reconciliation** (`empty.ts` ignoring
  `destructive`): that is the vocabulary round's, and no Ledger site hits
  it.
- **No Ledger edits**, including the `KNOWN` map of the screen proof: if a
  widened claim fires on a screen, the engine is wrong, not the screen.

## Long-term plan

1. **Pointer reachability** (0041 plan 5): a control under a fixed bar or
   off-screen sheet is a browser question; `verify()` gains a
   `POINTER_UNREACHABLE` finding using `elementFromPoint` at the control's
   centre. Not a `prove()` claim.
2. **Focus-visible as a skin concern**: once the row focus treatment exists,
   audit every part for a focus ring the skin owns, so no block ever
   spells `outline`.
3. **The dialog action row** (issue 0023) composes `ctx.fitRow` with the
   primary-never-leaves rule this ADR fixes, so a dialog's "Save" is as
   guaranteed as a toolbar's.
