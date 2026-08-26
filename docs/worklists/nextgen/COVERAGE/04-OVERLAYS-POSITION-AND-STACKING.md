# overlays, positioning and stacking — intent coverage audit
**Date**: 2026-08-25 · **Kind**: coverage audit, measured where marked
**Slice**: overlays, positioning and stacking — the top layer, `popover`,
`<dialog>`, `::backdrop`, CSS anchor positioning in full, `z-index` and
stacking contexts through `display: contents` hosts, focus containment,
declarative invokers, safe-area insets, and whether the context model survives
promotion to the top layer.
**Baseline**: `experiments/c11-appearance` (240/240 clean)

## Coverage in one line

D 21 · T 16 · L 4 · X 1 — of 42 capabilities audited.

The three questions the assignment asked, answered first, with numbers:

1. **Does the top layer still inherit the context axes? YES — completely, and
   including container queries.** A `popover` and a modal `<dialog>` reached
   through two `display: contents` hosts inside a `dense`+`touch`+`dark`,
   600px-wide `container-name: fitbox` both computed `--unit` =
   `calc(2px * 1.25)`, `padding-top` **7.5px**, `background`
   **rgb(24,24,27)**, the size query `@container fitbox (min-width: 500px)`
   **matched** (7px marker), the style query
   `@container fitbox style(--density-name: dense)` **matched** (5px marker),
   and `max-inline-size: 100cqi` resolved to **600px** — the container, not
   the 800px viewport. Byte-identical to the in-flow control on all seven
   readings. `::backdrop` inherits too. **The context model has no portal
   hole.** (P1a–P1i, P1g.)
2. **Can placement be fully derived? YES.** One authored rule, zero authored
   sides, zero authored anchor names, zero ids: four corner triggers plus a
   centre trigger produced four different derived placements, all five inside
   an 800×600 viewport, each with a gap of exactly **4px = one `--unit`**.
   `position-try-order: most-height` is proven non-inert by a discriminating
   fixture: two identical menus at the same 55% block offset resolved to
   **opposite sides** (`most-height` → block-start, `normal` → block-end).
   (P2a–P2e.)
3. **The overflow menu can be completed as pure intent** — one new attribute
   with three values, six CSS rules, and a *net deletion* of ~35 lines of
   authored geometry and ~20 lines of TypeScript from the prototype. The
   browser now supplies open/close, anchored placement, `aria-expanded`,
   Escape-with-focus-return, and light dismiss for free (all measured). It
   does **not** supply focus containment, arrow-key roving, or close-on-focus-
   out; those stay in the engine, authored once. §Proposed vocabulary.

## The leaks, first

Four leaks and one escape. Three of the four are the same defect wearing
different hats, and it is the most important finding in this slice.

### L1 — `z-index` is silently inert on a `display: contents` host

**What breaks.** The framework makes every component host layout-transparent
(`experiments/c11-appearance/src/theme/structure.css:32-51` enumerates
thirteen of them). A boxless host generates no box, so **every declaration
that needs a box is dropped without a diagnostic**. Measured: two absolutely
positioned siblings, the earlier one wrapped in
`<app-host style="z-index: 10; isolation: isolate">`. The later sibling
painted on top — `elementFromPoint` returned `boxA`, not `boxB`. The paired
control (identical markup, host given `display: block`) returned `boxD`, so
the measurement is about the box and not about the hit test. A third fixture
moving the `z-index` onto the child returned `boxF`. (P3a/P3b/P3c.)

**Why intent cannot reach it.** The declaration is *accepted*: computed
`z-index` reads `10` and computed `isolation` reads `isolate` on the boxless
host. Nothing anywhere reports that they will never apply. This is the exact
shape of the c11 README's F4/F8 family — a true measurement attached to a box
that does not exist. It is worse than a missing feature, because the CSS looks
correct and `getComputedStyle` agrees with it.

**Cheapest honest option.** A diagnostic, not a declaration. **N711** below
asserts that no element whose *used* `display` is `contents` carries a
non-`auto` `z-index`, `isolation`, `transform`, `filter`, `contain` or
`container-type`. It is cheap, static, and it is precisely the class of bug a
human with eyes cannot see. The positive half of the rule is already true in
the prototype: stacking must be declared on the element that owns the box, and
for overlays it never needs declaring at all (see D-side, `z-index` row).

### L2 — `isolation` has the same hole, and it has no workaround at the host

Same measurement, same fixture (P3d): computed `isolation: isolate`, computed
`display: contents`, observed effect **none**. `z-index` at least has an
obvious relocation target (the child). `isolation` on a transparent *host* is
usually declared precisely because the author wants the whole component
subtree to be one blend/stacking unit — and the subtree has no single box to
move it to. If the engine ever needs component-level isolation it must either
give that component a real box (contradicting host transparency, and
reopening the F8 crush at exactly the node that produced it —
`structure.css:45-48`) or refuse the capability. **Recommend refusing it and
reporting it**: N711 covers it, and no overlay in this slice needs it, because
the top layer makes isolation unnecessary for the one case that mattered.

### L3 — `container-type` is inert on a `display: contents` host

Measured (P17a): a `.cqTarget` inside `<app-host style="container-type: inline-size">`
read `border-bottom-width: 0` — the `@container cqprobe (min-width: 10px)`
rule never matched. The paired control with a boxed wrapper read **9px**.
Computed `container-type` on the boxless host reads `inline-size` regardless.

**Why this is load-bearing for my slice.** Answer 1 above — the top layer
keeps its container context — is only true because the query container is a
*boxed* element (`[data-fit]`, `theme/states.css:185-188`). The framework's own
convention of hosting everything on boxless custom elements is one careless
`container-type` away from silently losing the whole context model for a
subtree. The leak is small; the blast radius is not.

**Cheapest honest option.** Same rule, N711. Cross-referenced to the theme
slice under §Belongs to another slice.

### L4 — `position: fixed` under a transformed ancestor

Measured (P4a): a `position: fixed` child declaring `inset-inline-start: 0`
inside an ancestor at `inset-inline-start: 40px` with
`transform: translateX(120px)` landed at **x = 160**, not 0 — the transformed
ancestor became its containing block. This is the oldest quirk in the area and
no intent declaration can express "ignore my ancestor's transform".

**Why it barely matters here, and where it still does.** The top layer is
immune: a promoted popover inside the same transformed ancestor centred at
**x = 400** in an 800px viewport — exactly the viewport centre — while the
non-promoted fixed sibling sat at 160 (P4b). Anchor positioning is also
correct through the transform: the tx-trigger's *visual* rect
(x = 294.3, i.e. 40 + 120 + layout) was what the menu attached to, with the
same 4px derived gap (P4c). So **every overlay in the proposed vocabulary is
already outside this leak.** It survives only for non-promoted fixed
furniture — a sticky bar, a drag ghost, a scroll affordance. Those are not in
my slice, but they are in the framework's future, and the fix is the same
diagnostic family: **N715**, "non-top-layer fixed element with a
containing-block-establishing ancestor".

### X1 — raw `anchor()` for tethering that is not a side

`position-area` covers "which side, which alignment" declaratively and is
what the vocabulary should expose. Tethering that is genuinely *geometric* —
an arrow/caret that must land on the anchor's centre minus its own half-width,
a connector line, a range highlight spanning two anchors — is expressible only
as `anchor()` arithmetic inside `calc()`. That is raw CSS with lengths in it,
so it belongs behind the declared `[data-escaped]` hatch and reports itself as
**N601**. I recommend accepting this one rather than growing vocabulary for
it: it is rare, it is genuinely geometric, and `justify-self: anchor-center`
(supported, measured) already covers the common caret case without arithmetic.

### The near-leak that is worse than a leak, because it is silent and it *looks* right

Not counted as an L because a one-line table rule fixes it completely — but it
is the single most dangerous thing I measured, and it would have shipped.

**A shared `anchor-name` collapses every overlay in the document onto the last
one.** With `anchor-name: --ovf` on every trigger and `position-anchor: --ovf`
on every panel — the obvious "one name for the whole app, zero per-callsite
wiring" design, and the one I set out to prove — all four panels in a
four-instance fixture attached to `d4t`, the last anchor in the document
(decisive fixture: 20×20 panels, one alignment, no fallbacks, triggers 40px
apart, so attribution is a single coordinate). Adding
`anchor-scope: --ovf` repaired it completely: each panel attached to its own
trigger, in both the boxless-host and boxed-wrapper groups, and in the
instance where the panel *precedes* its trigger in the DOM. Paired control on
the same markup with the scope removed: all three collapsed onto the last
trigger again. (P11a/P11b/P11c/P11d, plus the standalone decisive run.)

Three things make this the most valuable paragraph in the audit:

- **The spec says so, in the same words and with the same example.**
  `css-anchor-position-1` §2.1: "the target anchor element will be the nearest
  ancestor (if one exists) or else **the last one in DOM order**", and §2.2's
  own worked example is a list whose items share `anchor-name: --list-item`:
  "Without `anchor-scope`, all of the `li` elements would be visible to all of
  the positioned elements, and so they'd all positioned themselves relative to
  the final `li`, stacking up on top of each other."
  <https://drafts.csswg.org/css-anchor-position-1/#anchor-scope>
- **`anchor-scope` is the one box-dependent-looking property in this slice
  that is NOT box-dependent.** It works on a `display: contents` host
  (computed `anchor-scope: --ovf`, computed `display: contents`, correct
  per-instance resolution). Unlike `z-index`, `isolation` and
  `container-type`, it scopes a *name in the tree*, not a *box in a paint
  order*. That is what makes the fix free for this framework: the transparent
  host can own it. Verified against the spec text — `anchor-scope` limits
  which names are "in scope", with no reference to box generation.
- **It would have passed a demo.** With one instance on screen, the wrong
  design is indistinguishable from the right one. That is exactly the c11
  README's F8: "buttons visibly overlapped while the oracle reported success".

Cost of the fix: **one rule, and it needs no new declaration at all**, because
the framework already marks the right subtree —
`[data-fit] { anchor-scope: --overlay; }`. And per the spec, `anchor-scope`
"has no effect on implicit anchor elements", so the invoker-anchored path
(P2a) was never exposed to the collision in the first place.

## Capability table

| capability | CSS today | verdict | intent declaration | notes |
|---|---|---|---|---|
| top-layer promotion | `popover="auto"` | **D** | `data-collapse="menu"` already implies it | engine emits the attribute; author never types it |
| non-dismissing overlay | `popover="manual"` | **T** | — | one table rule per overlay kind; `menu`/`hint` are `auto`, a busy/progress surface is `manual` |
| hover/focus-intent overlay | `popover="hint"` | **D** | `data-overlay="hint"` | reflects as `"hint"` (measured); derives identically to `auto` (P1h) |
| blocking decision surface | `<dialog>` + `showModal()` | **D** | `data-overlay="dialog"` | modality, `inert`, backdrop and focus containment all arrive together |
| overlay scrim | `::backdrop` | **T** | — | one rule; inherits the context axes from its originator (P1g), so no values per callsite |
| naming an anchor | `anchor-name` | **T** | — | one rule on `[data-overflow]`; **must** be paired with `anchor-scope` |
| scoping an anchor name | `anchor-scope` | **T** | — | one rule on `[data-fit]`; works on a boxless host (P11b) — the exception to L1/L2/L3 |
| default anchor, invoker-linked | `position-anchor` initial | **D** | — | implicit anchor from `command`/`popovertarget`; **no name, no scope, no id** (P2a) |
| default anchor, not invoker-linked | `position-anchor: --name` | **T** | — | needed only when the anchor is not the invoker |
| geometric tethering (carets, connectors) | `anchor()` in `calc()` | **X** | `data-escaped` | reports **N601**; `justify-self: anchor-center` covers the common caret without arithmetic |
| sizing from the anchor | `anchor-size()` | **T** | — | `min-inline-size: anchor-size(self-inline)` replaces the prototype's unit-derived width bound |
| which side, which alignment | `position-area` | **T** | — | one rule per overlay kind; the author declares the *relationship*, never a side |
| what to try when it does not fit | `position-try-fallbacks` | **T** | — | one rule; `flip-block` flips the margin with the axis, so the gap is authored once (P2d) |
| which fallback is best | `position-try-order` | **D** | — | `most-height`; proven to change the outcome vs `normal` (P2c). **The browser owns this half of `data-collapse`.** |
| hide when the anchor leaves | `position-visibility` | **T** | — | `anchors-visible` (also the initial value) hides on anchor clipping; `no-overflow` does not (P13a/b/c) |
| raising an overlay above the page | `z-index` | **D** | — | unnecessary: the top layer beats `z-index: 2147483647` with `z-index: auto` (P8a) |
| stacking through a boxless host | `z-index` on the host | **L** | — | **L1** — accepted, computed, silently inert (P3a) |
| blend/stack isolation through a boxless host | `isolation` | **L** | — | **L2** — same, with no relocation target (P3d) |
| ordering two open overlays | `z-index` between them | **D** | — | invocation order wins: later-shown `z-index: 1` painted over earlier `z-index: 999` (P8b) |
| escaping a clipping/transformed ancestor | portal / `ReactDOM.createPortal` | **D** | — | no portal needed; promotion escapes transforms (P4b) and `overflow` clipping |
| context axes across the overlay boundary | portal + re-provide theme | **D** | — | inheritance is DOM-based and survives promotion (P1a/P1e) — **the whole answer to Q1** |
| size container queries in the top layer | `@container (min-width:)` | **D** | — | matched, identical to the in-flow control (P1b) |
| style container queries in the top layer | `@container style()` | **D** | — | matched (P1c); density/theme survive the portal |
| container-relative units in the top layer | `cqi`/`cqb` | **D** | — | `100cqi` → 600px (the container), not 800px (the viewport) (P1d) |
| `container-type` on a boxless host | `container-type` | **L** | — | **L3** — inert; the paired boxed control works (P17a) |
| making the rest of the page untouchable | `inert` (implicit) | **D** | `data-overlay="dialog"` | `showModal()` blocks outside focus **and** outside hit-testing (P9c) |
| containing focus in a non-modal menu | `inert` (manual) / focus trap | **T** | — | the browser gives **nothing**: outside `focus()` succeeded, outside hit test returned `outside` (P9b). One engine rule. |
| initial focus inside an overlay | `autofocus` | **D** | — | `activeElement` was the `autofocus` item immediately after `showPopover()` (P9a); deletes the prototype's `flush()`+`focus()` dance |
| Escape closes and returns focus | UA behaviour | **D** | — | measured: real `Escape` closed the menu and restored `activeElement` to the invoker. Deletes `overflow-menu.ts:248-251`. |
| click-outside dismiss | UA light dismiss | **D** | — | measured with a real mouse click at (5,300): menu closed. Deletes `overflow-menu.ts:233-237`. |
| Tab reaches the panel | UA sequential focus | **D** | — | Tab from the invoker walked all six `menuitem`s in DOM order |
| Tab leaving an open panel should close it | — | **T** | — | measured: focus left to `order-most` and the menu **stayed open**. One engine rule (`focusout`). |
| arrow-key roving in `role="menu"` | — | **T** | — | measured: `ArrowDown` moved nothing. ARIA roles carry no behaviour; the prototype's handler stays. |
| expanded state on the trigger | implicit ARIA | **D** | — | with **no** authored `aria-expanded`, the AX tree reported `expanded: false` → `true` on open. Deletes `overflow-menu.ts:287-288`. |
| menu role and accessible name | `role`/`aria-label` | **T** | `data-overlay="menu"` | AX tree: `role: menu`, name `"More"`, 6 children, first child `menuitem`. `aria-haspopup` is **not** implicit — author it once in the pattern. |
| hover/dwell intent | `interestfor` | **D** | `data-overlay="hint"` | measured end to end with a real 1.2s pointer dwell: hint opened, `:interest-source` and `:interest-target` both matched, anchored with the same 4px derived gap, closed on pointer-leave |
| declarative open/close | `command`/`commandfor` | **D** | — | `command="toggle-popover"` opened, anchored (`block-start / span-inline-start`) and toggled off, zero JS (P14a) |
| submenu inside a menu | nested `popover="auto"` | **D** | `data-overlay="menu"` nested | DOM-nested child opened **without** closing its ancestor; an unrelated popover closed the whole stack (P15a/P15b) |
| which gestures dismiss a dialog | `closedby` | **T** | — | `closedBy` reflects `"any"`; one rule per overlay kind |
| device safe areas | `env(safe-area-inset-*)` | **T** | — | supported; reads `0px` on this engine, which is correct and says nothing about a notched device |
| `position: fixed` under a transformed ancestor | — | **L** | — | **L4** — x = 160 instead of 0 (P4a); every overlay here is immune via the top layer (P4b) |
| animating top-layer removal | `overlay` | **T** | — | `CSS.supports('overlay','auto')` → true; the exit transition belongs to the motion slice |

## Measured probes

**Probe**: `experiments/coverage/04-overlays.html` — plain HTML + CSS + one
inline script, no npm, no dependencies, no build. 38 recorded claims, each
with an explicit paired control.
**Engine**: Chromium **151.0.0.0** (headless, `dpr 1.25`), viewport
**800×600**, loaded over `file://`.
**Result**: every claim now behaves as designed. Remaining `NO` verdicts are
**five genuine findings**, each with a `YES` paired control proving the check
can distinguish: `P17a` (L3), `P11a` (the shared-name collapse), `P3a` (L1),
`P3d` (L2), `P4a` (L4), `P9b` (no popover focus containment).

Headline numbers, all from the run:

| claim | measured | control | verdict |
|---|---|---|---|
| P1a popover inherits the axes | `--unit: calc(2px * 1.25)`, padding 7.5px, bg rgb(24,24,27) | byte-identical in-flow control | YES |
| P1b/P1c/P1d top layer keeps its container | size-CQ 7px, style-CQ 5px, `100cqi` → 600px | 7px / 5px / 600px | YES |
| P1e/P1f modal dialog, same | 7.5px, 7px, 5px, 600px | identical | YES |
| P1g `::backdrop` inherits | `--unit: calc(2px * 1.25)`, `--density-name: dense` | originator's token | YES |
| P1i fixed **without** promotion | identical to control | isolates "promoted" from "out of flow" | YES |
| P2a implicit anchor | 5/5 anchored, gap 4px each, `position-anchor` computed `normal` | 1 authored rule, 0 sides, 0 names, 0 ids | YES |
| P2b derived sides | tl/tr → block-end, bl/br/c → block-start, 5/5 in viewport | 800×600 | YES |
| P2c `position-try-order` is not inert | `most-height` → block-start, `normal` → block-end | same 55% offset, 202px menu, 242px below vs 330px above | YES |
| P2e long menu | 22 items, 328px tall, in viewport, `scrollHeight > clientHeight` | `max-block-size: stretch` supported | YES |
| P11a shared name, no scope | all → the last anchor in the document | — | **NO** |
| P11b/c/d `anchor-scope` repairs it | 3/3 and 3/3 correct, incl. panel-before-trigger | unscoped group collapsed | YES |
| P3a `z-index` on a boxless host | `boxA` painted on top | boxed host → `boxD`; child z-index → `boxF` | **NO** |
| P8a top layer vs `z-index` | `zpop` hit, its own `z-index: auto` | competitor `z-index: 2147483647` | YES |
| P8b order beats `z-index` | later-shown `orderB` (`z-index: 1`) on top | earlier `orderA` (`z-index: 999`) | YES |
| P9b popover focus containment | outside `focus()` succeeded, outside hit test `outside` | modal dialog: blocked, hit test `fdlg` | **NO** |
| P13a `anchors-visible` | stopped painting at its own centre after the anchor was clipped | `always` kept painting; `no-overflow` kept painting | YES |
| driver: implicit `aria-expanded` | AX `expanded: false` → `true` | zero authored ARIA attributes | YES |
| driver: `interestfor` dwell | opened, anchored (gap 4px), closed on leave | `:interest-source`/`:interest-target` matched | YES |

### The failure I did not expect

**Twice, and the second time was worse than the first.**

The first was the design I was most confident in: one `anchor-name` for the
whole application, resolved by tree position, giving genuinely zero
per-callsite wiring. It is wrong, it is wrong *silently*, and the failure mode
is that every overlay in the document lands on the last trigger — which in a
single-instance demo is indistinguishable from correct. The spec had the
answer and the identical worked example the whole time.

The second was that **`position-anchor` computes to `normal`, not `auto`, and
`element.showPopover()` establishes no implicit anchor at all.** My first P2
run opened every popover programmatically; all seven landed at the same static
position (x 0, y 4, 81×202) and I read it as "implicit anchors are not
implemented". They are — the implicit anchor is established by *invoker
activation*. Switching from `showPopover()` to `trigger.click()` turned seven
identical wrong rectangles into seven correct, differently-derived ones with
no CSS change. The lesson for the engine is concrete and not obvious: **an
overlay opened by engine code rather than by a real invoker loses its anchor**,
so the engine must either route every open through `command`/`commandfor` (the
proposal below does) or fall back to the named+scoped path.

### Five oracle bugs, zero page bugs — the c11 pattern held exactly

The c11 README's sharpest cost signal was "five of the defects found were in
the oracle, not the page". This probe reproduced the ratio, and every one was
the same root cause the README names: *a check must measure the box its claim
is about.*

- **O1 — hit-testing below the fold.** `elementFromPoint` returned `null` for
  two of three stacking fixtures because the page had grown taller than the
  viewport. Read as "the `z-index` did not apply". Fixed by `bring()`, which
  scrolls a fixture into view before any hit test.
- **O2 — a two-sided claim checked on one side.** The anchor-attribution check
  required the panel's inline-**end** edge to align, i.e. it recognised only
  `span-inline-start`. A 90px panel on a 26px trigger cannot fit the start
  side, so the engine correctly applied `flip-inline` and the check reported
  `not-anchored` for a perfectly anchored panel. Widening it to accept both
  alignments produced a *worse* bug: with triggers 29px apart and a 4px gap,
  "own trigger below" and "a neighbour above" are the same coordinate within
  tolerance, so the check reported two attributions and silently took the
  first. **Both readings were noise.** Fixed by rebuilding the fixture so
  attribution is a single unambiguous coordinate — 20×20 panels, one
  alignment, no fallbacks, triggers 40px apart.
- **O3 — a check that could not fail.** `position-visibility` was read in the
  same synchronous turn as the scroll that was supposed to trigger it. Anchor
  visibility resolves post-layout, so all three values returned identical
  pre-scroll readings. Fixed by awaiting two frames.
- **O4 — the wrong box again, in the rule written to test hiding.**
  `hitTestAtOwnCentre === null` was the test for "strongly hidden". A strongly
  hidden element **keeps its box**, so the point hits whatever is behind it and
  the reading came back as some `div` — never `null`. The claim is "is *this
  menu* painted at its own centre", so the check has to name the menu. This is
  N650 and N690's mistake, made a third time, by someone who had just read
  about it.
- **O5 — a check that produced nothing.** Making the probe async introduced a
  `requestAnimationFrame` await; a hidden/background tab never fires it, so the
  probe hung forever with `running…` on screen and no results. Fixed with a
  `setTimeout` race so the harness always terminates, plus `bringToFront()`.

Both O2 and O4 are recorded as comments in the probe next to the code they
fixed, so the file carries its own history.

## Proposed vocabulary

**One new attribute. Three values.** Everything else is derived or comes from
declarations that already exist.

```
data-overlay = "menu" | "dialog" | "hint"
```

- `menu` — a list of actions tethered to the control that revealed them.
  Light-dismiss, Escape, roving arrow keys, `role="menu"`.
- `dialog` — a decision that blocks. Modal, backdrop, inert rest-of-page,
  centred rather than tethered.
- `hint` — non-essential explanation, revealed by interest rather than
  invocation. `popover="hint"`, `interestfor`, never focus-stealing.

**What pays for it.** Two existing ad-hoc attributes are deleted
(`data-overflow-anchor`, `data-overflow-menu`) plus one state attribute on the
panel (`data-shown` on the panel; it stays on the trigger) and three authored
ARIA attributes. **Net: −1 attribute, and the vocabulary gets an enumerable
axis where it had two markers with implicit behaviour.** `data-overflow` stays
as the trigger marker. `data-collapse="menu"` stays and is unchanged: it says
*what to do when space runs out*, and `data-overlay` says *what kind of
surface the result is*.

The three values also give the vocabulary check (N610) an axis it can police,
which two bespoke boolean attributes never could.

**Table addition needed, one line.** The touch-to-sheet derivation below reads
`--input-name` in a style query; `theme/tokens.css` currently exposes only
`--density-name` (`theme/states.css:190-198` is the existing precedent). Add
`--input-name: pointer|touch` alongside the existing axis declarations at
`tokens.css:166-176`.

### The complete authored placement table

This is the whole thing. Six rules, no side, no offset, no anchor name at a
callsite, no pixel outside the `--unit` derivation.

```css
/* 1. Scope. The fit container is ALREADY the overflow scope, so scoping the
      anchor name costs no new declaration — and anchor-scope is the one
      box-dependent-looking property that works on a boxless host (P11b). */
[data-fit] { anchor-scope: --overlay; }

/* 2. The trigger. `data-overflow` already exists (theme/states.css:60-65). */
[data-overflow] { anchor-name: --overlay; }

/* 3. Every overlay, regardless of kind. */
[data-overlay] {
  position: fixed;
  position-anchor: --overlay;
  inset: auto;
  margin: 0;
  position-try-order: most-height;   /* the browser derives the best side */
  max-block-size: stretch;           /* fills the position-area box, so the
                                        bound is derived, not chosen (P2e) */
  overflow: auto;
  padding: var(--unit);
  background: var(--s1);
  color: var(--fg);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 calc(var(--unit) * 0.5) calc(var(--unit) * 3) rgb(0 0 0 / 0.14);
}

/* 4. The RELATIONSHIP, per kind. Three rules for the whole application. */
[data-overlay='menu'] {
  position-area: block-end span-inline-start;
  margin-block-start: var(--unit);
  position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
  min-inline-size: anchor-size(self-inline);
  position-visibility: anchors-visible;
}
[data-overlay='hint'] {
  position-area: block-start center;
  justify-self: anchor-center;
  margin-block-end: var(--unit);
  position-try-fallbacks: flip-block;
  position-visibility: anchors-visible;
}
[data-overlay='dialog'] {
  position-anchor: normal;           /* a decision is not tethered to a control */
  inset: 0;
  margin: auto;
  max-inline-size: min(calc(var(--unit) * 120), calc(100dvi - var(--unit) * 8));
}
[data-overlay='dialog']::backdrop { background: rgb(0 0 0 / 0.4); }

/* 5. Touch: a tethered menu becomes a bottom sheet. Derived from a context
      axis, not a breakpoint, and no new vocabulary — this is the same claim
      as theme/states.css:190-198, applied to placement. */
@container fitbox style(--input-name: touch) {
  [data-overlay='menu'] {
    position-anchor: normal;
    position-area: none;
    inset: auto 0 0 0;
    max-block-size: 60dvb;
    padding-block-end: max(var(--unit), env(safe-area-inset-bottom));
  }
}
```

### What the pattern renders

Values: none. Sides: none. Ids: one, and only because `commandfor` needs a
target (the prototype already mints it — `overflow-menu.ts:178,186`).

```html
<button data-appearance="action" data-role="quiet" data-overflow
        type="button"
        command="toggle-popover" commandfor="${panelId}"
        aria-haspopup="menu" aria-label="${name}">⋯</button>

<div id="${panelId}" popover="auto" data-overlay="menu" role="menu"
     data-layout="stack" aria-label="${name}">
  <!-- first item only -->
  <button role="menuitem" tabindex="-1" autofocus
          data-appearance="action" data-role="quiet" type="button">…</button>
  <button role="menuitem" tabindex="-1"
          data-appearance="action" data-role="quiet" type="button">…</button>
</div>
```

### What this deletes from the prototype

Measured-free, not assumed-free. Every deletion below is backed by a probe.

| deleted | lines | why it is safe |
|---|---|---|
| `[data-overflow-anchor] { position: relative }` | `theme/states.css:77-79` | the top layer needs no positioned ancestor |
| `position: absolute; z-index: 1; inset-inline-end: 0; inset-block-start: calc(100% + var(--unit))` | `theme/states.css:89-107` | `position-area` + `margin-block-start`, and the gap survives a flip (P2d) |
| `max-inline-size: min(max(calc(var(--unit) * 60), var(--min-track)), 100cqi)` | `theme/states.css:110` | **this is an F9-class hazard** — a container bound derived from `--unit` with a floor bolted on, and the file's own comment says "it happens to fit today". Replaced by `min-inline-size: anchor-size(self-inline)` plus the browser's overflow-driven fallback: the bound stops being unit-derived at all. |
| `display: none` / `[data-shown] { display: block }` on the panel | `theme/states.css:89-90,120-122` | `popover` owns showing; `:popover-open` is the state selector |
| `document` `pointerdown` listener | `overflow-menu.ts:233-237` | UA light dismiss, measured with a real outside click |
| Escape branch | `overflow-menu.ts:248-251` | UA closes **and** restores focus to the invoker, measured |
| `aria-expanded` + `aria-controls` + their `computed()` wrappers | `overflow-menu.ts:287-288` | implicit from `commandfor`; AX tree measured `expanded: false → true` with zero authored ARIA |
| `flush()` + `menuItems()[0]?.focus()` on open | `overflow-menu.ts:212-215` | declarative `autofocus`, measured (P9a) |

### What stays in the engine, and must

Not leaks — one rule each, authored once, never per callsite — but honest
costs, all four measured as *not* provided by the browser:

1. **Focus containment** for `data-overlay="menu"`. P9b: outside `focus()`
   succeeded and the outside hit test returned `outside`. The browser gives
   this only for `showModal()`.
2. **Close on focus leaving the panel.** Measured: Tab walked out to
   `order-most` and the menu stayed open. Prefer `focusout` with an outside
   `relatedTarget` over the prototype's `Tab` key branch
   (`overflow-menu.ts:270-273`), which misses Shift+Tab and focus moved by
   script.
3. **Arrow/Home/End roving.** Measured: `ArrowDown` inside `role="menu"` moved
   nothing. ARIA roles carry no behaviour. `overflow-menu.ts:245-277` stays.
4. **`aria-haspopup`.** The AX tree exposed `expanded` implicitly but not
   `haspopup`. One attribute in the pattern.

The `window` `resize` close (`overflow-menu.ts:243`) also stays, and for the
reason the file already gives: a resize re-solves *which groups are
collapsed*, so an open panel is showing a stale answer. That is a fit concern,
not a placement one, and anchor positioning does not fix it.

## Proposed diagnostics

Codes start at **N710**: N700 is taken by the competing-primary-actions rule
landing in parallel, and `codes.ts` is append-only forever
(`diagnostics/codes.ts:4-12`).

Every entry names the fixture that proves it can fail, per the house rule.

| code | severity | asserts | fixture that proves it can fail |
|---|---|---|---|
| **N710** | fail | every `[data-overlay]` that is rendered is in the top layer — `:popover-open`, or an `open` modal `<dialog>` | an element carrying `data-overlay="menu"` with no `popover` attribute: it renders in flow, is measured by the fit solver, and the rule must fire |
| **N711** | fail | no element whose **used** `display` is `contents` carries a non-initial `z-index`, `isolation`, `transform`, `filter`, `contain` or `container-type` | `<app-host style="z-index:10; isolation:isolate">` around an absolutely positioned child, with a later un-z-indexed sibling — the exact P3a/P3d/P17a fixture, where the later sibling paints on top and the boxed control does not. **This is L1+L2+L3 in one static rule.** |
| **N712** | fail | every `[data-overlay]` resolving a *named* anchor is attached to a trigger inside its own overlay scope — measured as "the panel's border box is aligned to a `[data-overflow]` that is a descendant of the panel's nearest `[data-fit]`" | two `[data-fit]` subtrees each containing a trigger and a panel, with `anchor-scope` removed: the first panel attaches to the second subtree's trigger and the rule must fire. This is P11a, promoted from a probe to a standing check. |
| **N713** | fail | a rendered `[data-overlay]`'s **own border box** is inside the viewport | the bottom-edge trigger with a 22-item menu and `position-try-fallbacks: none`: the panel hangs below the fold. Measures the overlay's box, not its container's — N670's deleted first version failed exactly by measuring the container. |
| **N714** | fail | for a rendered `data-overlay="menu"`: `document.activeElement` is inside the panel, and every `[role="menuitem"]` is focusable and rendered | a menu whose items are `tabindex="-1"` with neither `autofocus` nor a roving handler: the panel opens with focus outside it and no key reaches the items. This is F6's guarantee ("a degradation strategy is only honest if the thing it degrades is still available") extended from *painted and reachable* to *operable*. |
| **N715** | warn | no `position: fixed` element outside the top layer has an ancestor that establishes a containing block for fixed descendants (`transform`, `filter`, `perspective`, `backdrop-filter`, `contain: layout/paint`, `container-type`) | the P4a fixture: `inset-inline-start: 0` inside `transform: translateX(120px)` resolves to x = 160. Warn, not fail: it is sometimes intended. |

**Opportunity noted, not taken.** N712 and N714 are naturally *subtree*
assertions — "one overlay scope" and "one menu" — and the `obs.declared(selector)`
subtree scoping just added to the lens for N700 fits them better than a global
selector plus a filter. I am not changing any existing rule's decision; N712
and N714 are new and should be written against subtree scoping from the start.

## Against Apple

| capability | what Apple does | verdict |
|---|---|---|
| overlay placement | `UIMenu`/SwiftUI `Menu` place themselves; the author picks nothing. `NSPopover`/`UIPopoverPresentationController` take `permittedArrowDirections` — an author-chosen *set*, from which the system picks | **matches, and Apple got there a decade earlier.** `position-try-fallbacks` is `permittedArrowDirections` with better spelling. |
| choosing among candidate placements | the system picks; the objective is undocumented and not selectable | **beats.** `position-try-order: most-height` makes the *objective* declarable, and P2c proves it changes the outcome. Apple gives you "the system knows best" with no way to say what best means. |
| verifying that placement worked | not machine-checkable. You look at it. | **beats, decisively.** N713 measures the overlay's own border box against the viewport in CI. Apple's equivalent is a designer with a device. This is the honest angle on the whole slice: Apple's system is authored by humans with eyes; ours is *falsifiable*. |
| priority-ordered degradation | Auto Layout constraint priorities (1–1000) with a documented solver | **falls short on the solver, matches on the shape.** Auto Layout is a real linear solver over the whole hierarchy; `data-priority` + `position-try-fallbacks` is a greedy ordered walk. F11 already admits this ("priority orders WHEN a strategy is spent, never WHETHER"). What we gain is that the browser now owns the placement half natively, which Auto Layout never did — `position-try-order` *is* a shipped declared-priority solver, and it is the same shape as `data-collapse`. |
| modality semantics | HIG enumerates sheet, full-screen cover, alert, action sheet, popover, menu, with prose rules about when each is right | **falls short on richness, beats on enforceability.** Apple has ~6 presentations; I propose 3. But HIG is prose — nothing stops an app from using an alert as a menu. `data-overlay="menu|dialog|hint"` is an enumerated axis N610 can police. |
| making the rest of the UI untouchable | every modal presentation is inert automatically, for every presentation kind | **falls short.** The web gives it for `<dialog>` only; P9b measured that `popover` gives nothing — not focus blocking, not hit-test blocking. We must build it. The compensation is that once built it is checkable (N714) and Apple's is not. |
| overlay materials | `UIBlurEffect`, `.regularMaterial`, vibrancy — a curated, context-adaptive material vocabulary | **falls short, clearly.** We have `--s1`, `--line` and one shadow, and the prototype's own comment calls that shadow "the only shadow in the system". `backdrop-filter` exists; the *curation* is the value, and curation is exactly what a resolution table has to author. This is the same gap the c11 README names as "nothing about beauty". |
| safe areas | `safeAreaInsets` propagate down the view hierarchy; layout guides consume them with no author code, and per-view | **falls short.** `env(safe-area-inset-*)` is a single viewport-level global with no per-container propagation, and it reads `0px` on any non-notched engine (P10a). A sheet nested in a container cannot ask "how much of the notch is mine". |
| context adaptation across an overlay boundary | trait collections propagate to presented view controllers, including `userInterfaceStyle` and `preferredContentSizeCategory` | **matches — and this is the surprise.** I expected the top layer to be our portal problem and Apple's solved problem. Measured, CSS inheritance *and* size *and* style container queries *and* `cqi` units all cross the boundary unchanged (P1a–P1f). One inherited custom property does what a trait collection does, with no propagation code, and `createContext`'s documented portal-safety is not even needed for appearance. |
| stacking | view hierarchy order, `zPosition`; no equivalent of a boxless host, so no equivalent of L1/L2 | **falls short.** L1/L2 are self-inflicted: they exist because we chose `display: contents` hosts. Apple has no such hole. N711 converts it from a silent hazard to a reported one, which is the best available answer, not a win. |

Net: derivation **beats** Apple on declared placement objectives, on
verifiability, and on context crossing an overlay boundary. It **matches** on
placement itself and on modality vocabulary shape. It **loses** on materials,
on safe-area propagation, on the strength of the constraint solver, and on
not having invented the boxless-host stacking hole in the first place.

## Open questions for the maintainer

1. **Does `data-overlay` belong on the panel, or should it be derived from
   `data-collapse="menu"` alone?** The overflow menu is fully derivable — the
   solver already knows it created a menu. `dialog` and `hint` are not: nothing
   in the current vocabulary says "this decision blocks". If you want to hold
   the vocabulary at zero new attributes, `menu` can be implicit and only
   `dialog`/`hint` need declaring — at the cost of an axis with a hole in it.
2. **Should the engine route every overlay open through `command`/`commandfor`?**
   It must, or lose the implicit anchor (the second unexpected failure above).
   That forecloses "open this menu from a keyboard shortcut with no button",
   which then needs the named+scoped path as a documented fallback. Is one
   mechanism with a fallback acceptable, or should the engine always use the
   named path for uniformity and give up the zero-wiring win?
3. **`anchors-visible` is the initial value of `position-visibility`, and it
   hides an overlay whose anchor scrolls away.** Measured and correct — but it
   means an overflow menu inside a scrolling table silently vanishes mid-
   interaction. Is vanishing right, or should a menu pin itself and outlive its
   trigger? Apple pins. I lean to pinning for `menu` (`always`) and vanishing
   for `hint` (`anchors-visible`), which is one more line in the table.
4. **Is refusing `isolation` acceptable (L2)?** The alternative is giving some
   hosts a box, which reopens the F8 crush at the node that produced it.
5. **Safe-area propagation is a genuine Apple win we cannot copy.** Do you want
   a `--safe-block-end` token computed once at the root and inherited, so
   nested surfaces can consume a *token* rather than an `env()` they cannot
   scope? That would make it a T rather than a permanent shortfall — at the
   cost of the root having to know something no other token knows.
6. **The probe is Chromium-only, like the baseline.** `interestfor` is
   [opposed by WebKit](https://groups.google.com/a/chromium.org/g/blink-dev/c/bX1G_yDt6W4)
   and deferred by Gecko, so `data-overlay="hint"` is the one value in the
   proposed vocabulary whose *mechanism* may never be cross-engine. Should
   `hint` ship with a scripted fallback, or wait?

## Belongs to another slice

- **`container-type` on a `display: contents` host is inert** (P17a: 0px vs
  the boxed control's 9px, computed `container-type: inline-size` regardless).
  I audited it because it decides whether the top layer keeps its context, but
  the fix lives in the theme/context slice. **The whole "top layer keeps its
  container" result depends on `[data-fit]` being a boxed element** — one
  `container-type` moved onto a transparent host and the context model loses a
  subtree silently. N711 covers it.
- **`max-inline-size: min(max(calc(var(--unit) * 60), var(--min-track)), 100cqi)`
  at `theme/states.css:110` is a second live F9.** A container bound derived
  from `--unit`, with a floor bolted on, and the file's own comment concedes
  "it happens to fit today". My proposal removes it for the overflow menu, but
  the F9 static-consistency check the README asks for should treat
  *unit-derived container bounds* as a category, not fix them one at a time.
- **`overlay` property and top-layer exit transitions** — supported here
  (`CSS.supports('overlay','auto')` → true), but animating removal from the top
  layer is the motion slice's problem.
- **`reading-flow: source-order` is supported** (measured). Relevant to the
  layout slice: it is the property that lets a visually reordered flex/grid
  container keep a sane focus order, which interacts with N714's "every
  menuitem is reachable".
- **`field-sizing: content` is supported** (measured) — controls/forms slice.

## Probe reproduction

```sh
# no install, no build, no dependencies
open experiments/coverage/04-overlays.html
# results are rendered into #report and left on window.__probe
```

The file is self-contained: the resolution table it uses is a ~40-line
reduction of `experiments/c11-appearance/src/theme/` carrying only the parts
under test, and the only pixel literals in it are probe markers (7px, 5px, 9px
— chosen to be unmistakable in a computed-style read) and fixture coordinates.
Nothing under `experiments/c11-appearance/**` was modified.
