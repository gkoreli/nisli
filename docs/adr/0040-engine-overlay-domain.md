# 0040. Engine Overlay Domain — Layers, One Stack, Native Inert

**Date**: 2026-08-29
**Status**: Accepted
**Depends on**: [0034-engine-typed-blocks-decided-by-an-engine](./0034-engine-typed-blocks-decided-by-an-engine.md), [0038-engine-block-kernel-and-space-domain](./0038-engine-block-kernel-and-space-domain.md)
**Code**: [`packages/engine/src/engine/overlay.ts`](../../packages/engine/src/engine/overlay.ts) (pure), [`blocks/kernel.ts`](../../packages/engine/src/blocks/kernel.ts) (`useOverlay`, `ctx.overlay`, `focusables`, `lockScroll`), consumers [`blocks/dialog.ts`](../../packages/engine/src/blocks/dialog.ts), [`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts), [`blocks/confirm.ts`](../../packages/engine/src/blocks/confirm.ts), [`blocks/notice.ts`](../../packages/engine/src/blocks/notice.ts); proofs [`engine/overlay.test.ts`](../../packages/engine/src/engine/overlay.test.ts), [`blocks/overlay.test.ts`](../../packages/engine/src/blocks/overlay.test.ts)

> Numbering note: 0039 was taken by
> [0039-ledger-bank-connectivity-domain](./0039-ledger-bank-connectivity-domain.md)
> before this record was written, so the overlay domain is 0040.

## Context

0038 re-founded every block on one kernel and moved the width decisions into
a pure Space vocabulary. It left one family of decisions where it found
them: the things that *float*. An inventory of the engine at 0.2.0 (no code
changes, line numbers from that tree) found four overlay implementations,
each deciding alone:

- **Dialog** ([`blocks/dialog.ts`](../../packages/engine/src/blocks/dialog.ts))
  added its own `document.addEventListener('keydown')` per mounted instance
  (L30-32) that closed on `Escape` whenever `props.open` was true, with no
  stack, no `defaultPrevented` check — **every open dialog closed on one
  Escape**, in mount order. Its overlay was `position: fixed; inset: 0;
  zIndex: 100` (L49-51), an outside pointer was a `click` on the backdrop
  (L56), scroll lock was `lockScroll(open)` (L27) writing `body.overflow`
  directly. There was **no focus trap**: no Tab cycling, no `inert`, no
  `aria-hidden` — Tab walked out of a dialog with `aria-modal="true"`
  (L59-61) into the page behind it, so the modal claim was a lie to any
  browser that does not honour `aria-modal`. Initial focus was a hand
  selector (`input, select, textarea, button:not([aria-label="Close"])`,
  L37) that could land on nothing; focus was restored on close but not on
  dispose-while-open (L39, L43).
- **`confirm()`** ([`blocks/confirm.ts`](../../packages/engine/src/blocks/confirm.ts))
  mounted a Dialog on a body-appended host (L40-41) and inherited all of the
  above. Stacked over an in-tree Dialog — the Ledger case in
  `packages/ledger/src/screens/budgets.ts` (Delete budget?) — it painted
  above only because it came later in the DOM at the same `z-index: 100`;
  one Escape answered the confirm **and** closed the dialog under it; and
  its `lockScroll` cleanup wrote `body.overflow = ''` while the outer dialog
  was still open (`kernel.ts` L221-224 was not ref-counted).
- **Toolbar's overflow menu** ([`blocks/toolbar.ts`](../../packages/engine/src/blocks/toolbar.ts))
  had its own `pointerdown` listener (L57-60), a `position: absolute;
  top: 100%` menu inside the toolbar, and **no keyboard model**: no arrow
  keys, no Home/End, no roving tabindex, no ArrowDown on the trigger, no
  focus return. Inside a Dialog it worked by luck — the dialog's fixed
  stacking context at z 100 carried it.
- **`notify()`** ([`blocks/notice.ts`](../../packages/engine/src/blocks/notice.ts))
  was a body-appended region at `zIndex: 200` (L32, L41) that was never on
  any stack: `role=status aria-live=polite` for every tone (L29-30), items
  dismissed by click only (L50), not keyboard reachable.

Three z-index literals (100, 100, 200) plus two chrome literals in App and
Page (`bar` 20, `sticky` 15) were the whole stacking model, and it held
only because nothing was ever portalled outside the dialog's stacking
context. Nothing here was a *decision* in 0034's sense — a choice made from
intent by a rule a test can read — and nothing was provable through
`mount()`: the behaviour lived in four sets of listeners.

## Decision

### Ubiquitous language

| term | meaning | where it lives |
|---|---|---|
| **Layer** | One floating thing that is open right now. `{ id, kind, dismiss, trap, lock, restoreFocus }` — its policy as data. | `engine/overlay.ts` `Layer`, `layer(id, kind)` |
| **Layer kind** (renamed by [0043](./0043-engine-intent-vocabulary-contract.md); `Kind` is a datum's kind) | What a layer is: `modal` (a dialog), `popover` (a menu), `passive` (a notice). The kind fixes the policy; `defaults(kind)` is the whole table. | `LayerKind`, `defaults` |
| **Dismissal policy** | `dismiss: { escape, outside }` — what closes it from outside its own controls. Modal and popover: both. Passive: neither. | `Layer.dismiss` |
| **Stack / top / reach** | The open layers in opening order; the last is the top. **`reach`** is the topmost *non-passive* layer — the only layer an Escape or an outside pointer reaches. One Escape closes one thing; a notice is transparent. | `LayerStack`, `push`, `pop`, `top`, `isTop`, `reach`, `escapeTarget`, `pointerTarget` |
| **Trap** | Focus stays inside the layer's surface while it is open (modal only). Tab from the last visible control wraps to the first; Shift+Tab the reverse. | `Layer.trap`; kernel `onKeydown` + `focusables` |
| **Inert** | Everything beside the topmost trap layer's ancestor chain carries the native `inert` attribute — recomputed from the stack on every open and close. | kernel `applyInert` |
| **Lock** | The document does not scroll while any modal is open. One ref-counted writer of `body.style.overflow`. | `locks(stack)`; kernel `hold`, `lockScroll` |
| **Restore** | On close, focus returns to the anchor (popover) or the opener (modal); when that is gone, to the nearest `main` landmark. | `Layer.restoreFocus`; kernel `restoreTarget` |
| **Placement** | Where an anchored layer goes, in viewport coordinates, as a pure function of three rectangles. | `placeMenu(anchor, menu, viewport, { gap, align, dir })` |
| **Surface (`within`)** | The element that is "inside" for a pointer, the trap root, and the placed element. Default: the block's host. | `OverlaySpec.within` |
| **z** | `ctx.metrics.layer[kind]` plus stack position, so the stack order *is* the paint order. | `zIndexOf`, `metrics.layer` |

### The pure vocabulary: `engine/overlay.ts`

Every function is data in, data out — no DOM, no signals. The stack is
immutable (`push`/`pop` return a new array). Routing is two functions:
`escapeTarget(stack)` is `reach(stack)` iff it dismisses on Escape;
`pointerTarget(stack, inside)` is `reach(stack)` iff it dismisses on an
outside pointer and the pointer was not inside it *or anything above it*.
`zIndexOf(stack, id, kind, base = metrics.layer)` takes its base as a
parameter for the same reason Space decisions take `layout`: a test passes
its own numbers. `placeMenu` prefers below, then above, then below clamped;
aligns the preferred edge (leading/trailing, honouring `dir: 'rtl'`), flips
when it would leave the viewport, then clamps to `[0, viewport − size]`.

### The behaviour: `ctx.overlay(spec)` / `useOverlay`

One document-level manager owns the only `keydown`, `pointerdown`, `scroll`
and `resize` listeners in the engine, installed when the first layer opens
and removed after the last closes. A block declares intent:

```ts
ctx.overlay({ kind, open, onDismiss, within?, anchor?, align?, size?, initialFocus?, restoreFocus? })
```

and renders what comes back — `z` and, for an anchored layer, `placement`.
The manager pushes the layer while `open` is true; routes Escape and
pointers through the pure stack; applies and recomputes the inert set;
holds the scroll lock while `locks(stack)`; focuses `initialFocus` (a modal
defaults to its first *visible* control, else its surface); restores focus
on close; re-places anchored layers on resize and on any scroll (capture).

| block | kind | surface | anchor | notes |
|---|---|---|---|---|
| `Dialog` | `modal` | the `role=dialog` element | — | `initialFocus`: first visible control that is not Close |
| `confirm()` | `modal` (via Dialog) | — | — | body-mounted, so a second modal layer above whatever is open |
| `Toolbar` overflow menu | `popover` | the `role=menu` element | the More-actions trigger | `align: 'trailing'`, `size` from `metrics.layout.menuWidth`; `restoreFocus: () => !leaving` |
| `App` menu (bar mode) | `popover` | the `<nav aria-label="Primary">` | the Menu toggle | full-width sheet by `placement.top`; `restoreFocus: () => !leaving` on Tab/navigation — [0042](./0042-engine-reachability.md) (a) |
| `notify()` region | `passive` | — | — | open while it shows anything; never focused *by the engine* (a person may Tab to a notice's Dismiss while no modal is open — [0042](./0042-engine-reachability.md) (c)), never inert |

## Design principles applied

**Composition — one behaviour, five consumers** (the App menu joined in 0042). As with `ctx.fitRow`
(0038), floating is a `Ctx` method, not an `OverlayBlock` base. Dialog and
the Toolbar menu share nothing but the stack, and `confirm()` and `notify()`
are not even blocks in the app's vocabulary — they get the behaviour by
composing a Dialog or declaring a passive layer. The kernel scan
([`kernel.test.ts`](../../packages/engine/src/blocks/kernel.test.ts), rules
6 and 7) now also forbids a block from adding a document listener or
carrying a z-index literal, so a fifth overlay cannot decide alone.

**Decisions as data.** A `Layer` is its policy; `defaults(kind)` is the
whole behaviour table; routing and z-order and placement are pure functions
over the stack. That is what lets [`engine/overlay.test.ts`](../../packages/engine/src/engine/overlay.test.ts)
prove "Escape reaches the topmost non-passive layer only" with no DOM, and
[`blocks/overlay.test.ts`](../../packages/engine/src/blocks/overlay.test.ts)
prove the same through `mount()` with no browser.

**Native platform first.** The trap is the HTML `inert` attribute on
everything beside the topmost modal's ancestor chain — not `aria-hidden`
juggling, not a cloned focus-sentinel pair. `inert` removes the rest of the
page from focus, hit-testing *and* the accessibility tree in one attribute
the browser owns. **The fallback**: a Tab guard in the manager wraps focus
over the visible controls inside the surface, which keeps browser chrome
out of the cycle and stands in where `inert` is not honoured. The dialog
surface carries `tabindex="-1"` so a dialog with no control still receives
focus.

**Structure from `ctx.metrics`, visuals via `ctx.part()`.** `z` comes from
`ctx.metrics.layer`, `menuWidth` from `ctx.metrics.layout`; App and Page
read their `bar`/`sticky` z from the same table. No block imports the
module constant and no block styles by hand; the migrated `dialog.ts` and
`toolbar.ts` pass the 0038 scan unchanged in kind.

## What the adversarial review changed, and why

The first `useOverlay` was reviewed against every consumer before the API
was frozen. Twelve things changed:

1. **Sibling modals.** The first `inertAround` marked siblings up the
   opener's chain and skipped nodes already inert, so a second modal that
   was a DOM *sibling* of an open one (Ledger's `settings.ts` has two) was
   itself inert and unfocusable. `applyInert()` now recomputes the whole set
   from the stack on every open and close: everything beside the *topmost*
   trap layer's chain, except subtrees holding a passive host. Tested.
2. **Scroll.** Position became `fixed` + `getBoundingClientRect`, measured
   only on `resize`, so a menu in scrolling content floated where its
   trigger had been. Now re-placed on `scroll` (capture, any scroller).
3. **Hidden controls.** `focusables` counted `display:none` nodes —
   Toolbar's overflowed buttons, a closed menu's items — so Tab from the
   last visible control never wrapped. `focusables` now filters disabled,
   `[inert]`, structurally hidden and zero-rect elements; Dialog's
   `initialFocus` uses it instead of its own selector.
4. **One body writer.** `lockScroll` and the manager both wrote
   `body.style.overflow`; a block releasing dropped a modal's lock, and
   `uninstall` cleared unconditionally. `hold()` is one ref count shared by
   both; `mount()` no longer writes `<body>`.
5. **Paint order = stack order.** `popover: 50` sat below `modal: 100` and
   worked only inside the dialog's stacking context. The table is now
   `{ sticky: 10, bar: 20, modal: 100, popover: 150, passive: 200 }`, App
   and Page read it, and a pure test asserts the chain.
6. **Notices are layers.** `notify()` was outside the stack. It is now a
   passive layer whenever it shows anything: on the stack for z, never
   inert, a pointer on a notice is "inside" so the dialog under it stays,
   and Escape passes *through* it (`reach()`). The draft's pure test that
   said a passive top swallows Escape was rewritten.
7. **Menu button keyboard model.** ArrowUp on the trigger opens on the last
   item; Tab and Shift+Tab leave to the tabbable after/before the trigger
   and `restoreFocus: () => !leaving` stops the manager pulling focus back.
8. **First paint.** The menu is `visibility: hidden` until `placement`
   exists; placement runs synchronously at open from `spec.size()` when the
   rect reads 0, then re-measures after layout — never a frame at (0, 0).
9. **RTL.** `PlaceOptions.dir`, read from `getComputedStyle(anchor).direction`.
10. **Opener gone.** Focus restore falls back to `host.closest('main,
    [role=main]')` (given `tabindex=-1`), not the top of the document.
11. **API slimmed.** `Overlay.layer`/`isTop`, `layerDefaults` and `Rect`
    left the public index; Dialog keeps only `aria-labelledby`.
12. **`menuItemBox()`** gained `minHeight: metrics.control.height` so items
    measure with the fallback size.

One diagnostic found during the round: a tracked `measured.value++` inside
the layer effect (N302) and a tracked read of `stack.value` in `uninstall()`
— both now `peek()`.

## WAI-ARIA patterns satisfied

**Dialog (modal)** — the dialog surface is `role="dialog" aria-modal="true"
aria-labelledby="<h2 id>" tabindex="-1"`; the backdrop is
`role="presentation"`. Focus moves into the dialog on open (first visible
control, never Close; the surface when there is none); Tab and Shift+Tab
cycle inside; Escape closes; focus returns to the opener on close; the rest
of the page is `inert`. `confirm()` is the same pattern with two answers
(Cancel first, so the destructive answer is never the default focus).

**Menu button** — the trigger is `<button aria-label="More actions"
aria-haspopup="menu" aria-controls="<menu id>" aria-expanded="true|false">`;
the menu is `role="menu" aria-labelledby="<trigger id>"` with
`role="menuitem"` children under a roving `tabindex`. Enter/Space/ArrowDown
open with focus on the first item, ArrowUp on the last; ArrowDown/ArrowUp
move with wrap, Home/End jump; Enter/Space activate and close; Escape closes
and returns focus to the trigger; Tab closes and leaves forwards (Shift+Tab
backwards); an outside pointer closes.

**Status region** — a passive layer holding a `role="status" aria-live="polite"`
and a `role="alert" aria-live="assertive"` container; tone decides which
and every notice has a Dismiss — closed by [0042](./0042-engine-reachability.md) (c).

## Consequences

Every a11y improvement is a behaviour change. What an app (Ledger) sees
differently, with no edit on its side:

- **One Escape closes one thing.** Delete budget? over the budget dialog:
  Escape answers the confirm and the dialog stays; the next Escape closes
  the dialog. Before, both closed.
- **A modal traps focus and the page behind it is `inert`.** Tab no longer
  leaves the dialog; the page's links and the app bar are unclickable and
  removed from the accessibility tree while a dialog is open.
- **Scroll stays locked across stacked modals** and across a popover
  closing above a modal.
- **Focus lands inside a dialog with no control** (its surface) instead of
  staying on the opener; on close it returns to the opener, or to the main
  landmark when the opener has gone.
- **The overflow menu has a keyboard**: arrows, Home/End, Escape-to-trigger,
  Tab-leaves; it is placed by the engine in viewport coordinates, follows
  scroll, flips at viewport edges, and honours `rtl`.
- **A notice is clickable over a dialog** and never swallows Escape; it
  paints above every modal by rule, not by DOM order.
- **`aria-label` on the dialog was replaced by `aria-labelledby`**; a test
  reading the label reads the title element (three engine tests updated;
  Ledger reads none).
- **Public surface**: `DialogProps`, `ConfirmOptions`, `Toolbar` props,
  `notify()` unchanged; `lockScroll` remains exported but is now one hold
  on a shared count. `layerDefaults` and `Rect` are gone from the index
  (never used outside the engine). z-index literals in App/Page moved to
  `metrics.layer`; `sticky` went from 15 to 10 (still below `bar`).

**Acceptance.** `packages/ledger` needed **zero edits**: it typechecks
against the new engine and its 38 tests pass; every `Dialog`, `Toolbar`,
`confirm()` and `notify()` call site in its nine screens compiles and
behaves as above. Engine: 151/151 tests (from 113 before the domain; +26 in
the first round, +12 in the review round), kernel scan green on every
scanned block. The keyboard proof is
[`blocks/overlay.test.ts`](../../packages/engine/src/blocks/overlay.test.ts):
Escape routing across stacked modals and a menu inside a dialog, Tab wrap
inside a dialog (including one holding a Toolbar with overflowed buttons),
sibling-modal inert, focus on open/close/opener-gone, the menu's full key
set, placement from fallback size, scroll re-placement, one ref-counted
lock, and notices over a modal — all through `mount()` in happy-dom.

**Closed by [0042](./0042-engine-reachability.md) (c)** (was "still open"
here): a `negative` notice is `alert`/assertive, every notice has a
keyboard-reachable Dismiss and Escape, and the countdown pauses while
hovered or focused — notice-block work, as recorded; the stack was not
touched.

## Long-term plan

1. **Actions row for dialogs** ([issue 0023](../issues/0023-actions-block-for-dialogs.md))
   can now be a popover-free row: `ctx.fitRow` over the dialog's actions,
   with overflow to a menu that is *already* a popover layer of this stack.
   Nothing about focus or Escape needs deciding again.
2. **Tooltips and general popovers would reuse the `popover` kind** — an
   anchored, non-trapping, restoring layer is exactly what `useOverlay`
   already provides. **They are not being added**: 0034's rule holds, a
   block arrives only when a Ledger screen needs it. **Done for the App
   menu** ([0042](./0042-engine-reachability.md) (a)): the second real
   popover, and it needed nothing `useOverlay` lacked — only the manager
   learned that a layer's anchor counts as inside on `pointerdown`.
3. **`prove()` over screens** (0038 plan 2) gains the stack for free: a
   screen mounted at width can assert its layers' z, placement and Escape
   routing from `__layers`, the manager's test seam.
4. **Density and input axes** change `ctx.metrics.layout.menuWidth` and
   `control.height`, which `size()` and `menuItemBox()` already read; the
   overlay domain is not touched.
