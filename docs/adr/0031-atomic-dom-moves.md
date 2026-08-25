# 0031. Atomic DOM Moves — `moveBefore()` Grounded in the Spec, the Engines, and Measurement

**Date**: 2026-08-25
**Status**: Proposed
**Depends on**: [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0023-move-resilient-component-lifecycle](./0023-move-resilient-component-lifecycle.md)

## Context

`moveBefore()` is already in nisli. It landed at two sites — the keyed `each()`
reorder and `portal()` — on the strength of an investment brief, and the brief
was wrong about several things. This ADR is the grounding that should have come
first: what the standard actually requires, what the three engines actually do,
what we measured ourselves, and which of the guarantees we have been repeating
are real.

It exists because the initial adoption produced four documented corrections, and
because a keyed-list reconciler is exactly the use case where the difference
between "specified", "convergent", and "happens to work in Chrome" decides
whether users see a bug.

### Why nisli cares more than most frameworks

nisli renders to light DOM with no VDOM and no compiler ([ADR 0019](./0019-minimal-runtime-and-native-platform-alignment.md)).
A keyed list reorder is therefore a *real DOM operation on real elements*, not a
diff against a shadow tree. When `each()` moves a row, it moves the user's actual
`<input>`, the actual `<iframe>`, the actual open popover. There is no
intermediate representation to replay state from — the node either keeps its
state or the state is gone.

This makes nisli one of the frameworks with the most to gain from atomic moves,
and the most exposed to their sharp edges.

## What the specification actually requires

### The whole feature is one sentence

`moveBefore()` is defined on the `ParentNode` mixin ([DOM §4.2.6](https://dom.spec.whatwg.org/#interface-parentnode))
and delegates everything to a new [move](https://dom.spec.whatwg.org/#move)
primitive. The guarantee is a single note inside it:

> Because the **move** algorithm is a separate primitive from **insert** and
> **remove**, it does not invoke the **insertion steps** or **removing steps**
> for *inclusiveDescendant*.

That is the entire mechanism. Everything people describe as "preservation" is a
consequence of teardown code never running, not of anything being saved and
restored.

Concretely, the move algorithm never calls pre-insert, insert, pre-remove, or
remove; it has **no adopt step**, so the node document is invariant and
`adoptedCallback` cannot fire; and it runs a new [moving steps](https://dom.spec.whatwg.org/#concept-node-move-ext)
hook instead. HTML's [moving steps](https://html.spec.whatwg.org/multipage/infrastructure.html#html-element-moving-steps)
do only two things — per-element moving steps, and form-owner reset when the
element and its form owner end up in different trees.

The preservation everyone talks about comes from what HTML's [removing steps](https://html.spec.whatwg.org/multipage/infrastructure.html#html-element-removing-steps)
do that the moving steps *omit*: resetting the document's focused area, and
running the hide-popover algorithm. `iframe`, `dialog`, and
[Fullscreen](https://fullscreen.spec.whatwg.org/#removing-steps) define removing
steps and no moving steps, which is precisely why a moved iframe does not reload.

### The precondition is root identity, not connectedness

This is the correction that matters most, because we got it wrong and built a
mental model on it.

> If *newParent*'s **shadow-including root** is not the same as *node*'s
> shadow-including root, then throw a `HierarchyRequestError`.

Root identity is **strictly stronger** than "both connected or both
disconnected". Two *different* detached subtrees are both disconnected but have
different roots, so moving between them throws. The spec author confirmed the
reading directly in [whatwg/dom#1255](https://github.com/whatwg/dom/issues/1255):

> "Yea, you can move between disconnected parents. It would only throw when you
> can't move without side-effects — as in, across documents or when the move
> would connect/disconnect the element."

Measured, both engines: a reorder inside one detached tree succeeds; a move
between two different detached trees throws `HierarchyRequestError`.

**Do not cite Blink's source comment on this.** It reads *"Only perform a
state-preserving atomic move if the new parent and the child are ALREADY
connected"*, which is not what the code below it does.

### Exceptions

In evaluation order, first match wins:

| Condition | Throws |
|---|---|
| `newParent`'s shadow-including root ≠ `node`'s | `HierarchyRequestError` |
| `node` is a host-including inclusive ancestor of `newParent` | `HierarchyRequestError` |
| `child` non-null and `child`'s parent is not `newParent` | `NotFoundError` |
| `node` is neither `Element` nor `CharacterData` | `HierarchyRequestError` |
| `node` is `Text` and `newParent` is a `Document` | `HierarchyRequestError` |
| `newParent` is a `Document` and the element/doctype rules are violated | `HierarchyRequestError` |

A parentless node always throws at check 1 or 2, never `NotFoundError`. Cross-document
always throws, since there is no adopt step. `Element` and all `CharacterData`
(including `Text` and `Comment`) are movable; `DocumentFragment` is not. The
*reference* child may be any node — comment markers work fine, which matters for
marker-based engines like ours.

**The spec's own prose summary is defective** and should not be quoted: its
`domintro` block says "after child" where the algorithm says before, carries a
copy-pasted "NotFoundError is impossible" comment that is false, and documents a
throw for "state that cannot be preserved" that exists nowhere in the algorithm.
Cite the algorithm.

### Custom element reactions, and why our empty callback is load-bearing

`moveBefore()` enqueues `connectedMoveCallback` for the moved node and every
shadow-including inclusive descendant — but **only when `newParent` is
connected**. A reorder inside a detached tree enqueues nothing at all (measured:
`move: 0, conn: 0, disc: 0`).

When the definition has **no** `connectedMoveCallback`, the platform does not
stay silent. [HTML §4.13.4](https://html.spec.whatwg.org/multipage/custom-elements.html#enqueue-a-custom-element-callback-reaction)
synthesizes a `disconnectedCallback()` + `connectedCallback()` pair, in that
order, for backwards compatibility:

> "This means that by default, custom elements reset their state as if they were
> removed and re-inserted. … To opt in to a state-preserving behavior while
> moving, the author can implement a `connectedMoveCallback`. **The existence of
> this callback, even if empty, would supersede the default behavior.**"

This is why the empty `connectedMoveCallback` in `component.ts` is not
decorative — deleting it would silently restore teardown-on-move. Note the
synthesized pair is not a real disconnect: `isConnected` stays `true` throughout,
which broke htmx's focus-restore heuristic (it checked `isConnected` and had to
switch to `:focus`).

**Reactions are captured by value at `define()` time.** `define()` reads all five
callbacks off the prototype and stores them in the definition's lifecycle-callbacks
map; `enqueue a custom element callback reaction` reads that map and never touches
the prototype again. Patching a prototype after `define()` therefore cannot work —
which is exactly the bug that made our first proof harness assert vacuously (see
Consequences).

## What the engines actually do

| | Ships | Mechanism |
|---|---|---|
| **Chromium** | 133, 2025-02-04 (flagged `AtomicMoveAPI` from Apr 2024) | Document-wide `StatePreservingAtomicMoveInProgress()` flag; `moveBefore()` calls ordinary `insertBefore()` and every teardown site is individually conditioned on the flag. A skip list, not a move algorithm. |
| **Firefox** | 144, 2025-10-14 (pref removed in 150) | Threads old-parent/new-parent pointers through `RemoveChildNode`/`InsertChildBefore`, deriving a per-node `BindContext::IsMove()`. Cleaner: the state is scoped to the operation, not the document. |
| **WebKit** | **Not shipped — but actively implemented** | Full implementation in trunk behind `MoveBeforeEnabled` (`default: false`, `status: unstable`), Igalia-assigned, commits landing through Aug 2026. ~7 of 12 tracked sub-bugs closed; the two carrying the actual state-preservation semantics are still open. |

WebKit's *standards position is support* and has been since 2024. The gap is
implementation, not disagreement. **Treat the WebKit fallback as temporary
scaffolding, not a permanent branch** — but do not plan around a date, because
Apple has published none.

Blink skips `ChildFrameDisconnector` (iframes), layout-tree detach, post-insertion
steps, top-layer/fullscreen teardown, and animation cancellation; it then manually
repairs `:focus-within` because the normal set/clear was skipped. Gecko skips
`mFrameLoader->Destroy()`, `ExitFullscreenInDocTree()`, `ClearServoData`,
`ClearAllAnimationCollections()`, popover hiding, and script execution. Different
architectures, convergent behaviour — with one exception documented below.

## What is actually preserved

The distinction that matters is **why** something survives, because it predicts
how much you can rely on it.

| State | Survives | Basis |
|---|---|---|
| iframe document, load state, JS context | yes | **Normative** — `iframe` has removing steps, no moving steps |
| Focus / `document.activeElement` | yes | **Normative** — focus reset is a removing step only |
| Popover open, modal `dialog`, fullscreen | yes | **Normative** — same omission |
| `adoptedCallback` never fires | yes | **Normative** — no adopt step |
| Running animations, `currentTime` | mostly | **Emergent only** — see below |
| Input `value`, `selectionStart/End/Direction` | yes | **Observed**, and preserved by plain reinsertion too |
| Document `Selection` / live `Range` | **no** | **Normative the other way** — the move algorithm deliberately runs the live-range pre-remove steps |
| Undo history | **no**, in Chromium | **Unspecified** — see below |
| Form owner | recomputed | **Normative** — HTML moving steps step 2 |
| Accessibility tree identity | unknown | Raised in [whatwg/dom#1255](https://github.com/whatwg/dom/issues/1255), no spec text added |

### Animations are not guaranteed, and Firefox is wrong here

No specification hooks animation cancellation to removal. Preservation is
emergent: a moved element never loses its computed style, so nothing cancels it.
The WebKit reviewer flagged "handling animations" as an unresolved design aspect
in 2024 and **no follow-up spec text exists**.

The rule that *was* agreed, proposed by rniwa and confirmed by the spec editor:
animation state should survive only if the element "continues to have the same
style which initiated animation applied."

We measured a divergence neither published source records. With
`#host > div:nth-child(1) .anim { animation: … }`, moving the first row to the end:

| | `moveBefore()` | `insertBefore()` (control) |
|---|---|---|
| Chromium | cancelled | cancelled |
| Firefox | **survives, same object, still running** | cancelled |

The control is what makes this a finding rather than ordinary CSS re-matching.
Chromium is correct; Gecko's move path skips `ClearAllAnimationCollections()`
without Blink's compensating `kSubtreeStyleChange` invalidation.

**Consequence:** treat position-dependent animation as unpreserved. Prefer keyed
classes over `:nth-child`, `:first-child`, and sibling combinators in animated
lists.

### Undo is destroyed while focus is preserved

Chromium clears a text control's undo stack when its editing host is moved —
including a bare reorder within the same parent, i.e. exactly `each()`'s case.
It is element-keyed (siblings are unaffected), redo dies with it, and it
originates in a 2021 Chrome change unrelated to `moveBefore`.

This is the nastiest failure mode in this ADR, because **the control still looks
live**: `activeElement` is still the input, the caret is still where the user left
it, and Ctrl-Z is dead. The `insertBefore` fallback at least signals the reset by
visibly losing focus.

Undo-across-move is unspecified, absent from WPT, absent from Blink's own tests,
and unmentioned in every design document — verified by enumeration, not assumed.

### Selection is out of scope by design

The explainer is explicit: *"Selection is currently not preserved… moving is
constrained to 'intrinsic' state of the node, and not to state that relates to
other nodes, like ranges."* Blink's Intent to Ship lists live Range state as
deliberately not preserved.

The collapse target is `(oldParent, index-of-node)`, not offset 0 — a distinction
invisible unless the moved node sits at a non-zero index, which is how we
initially recorded it wrongly.

## What the ecosystem concluded

This is the part that should temper enthusiasm.

- **React shipped it to experimental and then disabled it** (May 2025), and their
  reasoning targets us directly: *"since you can't really rely on this function
  existing across browsers, it's hard to depend on its behavior anyway. In fact,
  you now have a source of inconsistent behaviors across browsers to deal with."*
  Still off today.
- **Svelte declined on principle.** Rich Harris: *"It will make bugs more likely,
  not less, because it means that people will see stuff working in Chrome and
  assume it works everywhere."*
- **The spec author agrees with the shape of that concern**, arguing developers
  should design so they *always* move rather than "try to move but fall back",
  which otherwise yields *"a user experience where iframes are sometimes reloaded
  and focus is sometimes lost."*
- **The morphing libraries adopted it** — idiomorph, htmx (since 2.0.3, before
  Chrome shipped), Datastar, morphlex, Phoenix LiveView. Preact shipped it in an
  11.0 prerelease. Vue has an open Teleport-only PR; Lit's is a stalled draft.
- **Nobody measured a performance win.** Lit's benchmarks were inconclusive;
  Preact measured 1–9% *slower* on one path; idiomorph traded 10–20% for
  correctness.
- **React's crash in shipped products** (React Aria, Next.js) came from detecting
  on the *global* `Element.prototype` and then calling into a foreign realm's DOM.
  Their instance-check fix was rejected on performance grounds.

### Answering the objection

Harris's objection is the serious one and this ADR should not dodge it: adopting
`moveBefore` means Chrome and Firefox users get behaviour Safari users do not.

Three things make nisli's position different from Svelte's, and one concession:

1. **The fallback is not silent.** ADR 0023's deferred teardown means component
   *setup* never re-runs on any engine — measured `setup: 0` on all three,
   including WebKit's `insertBefore` path. The divergence is confined to
   platform-owned state (iframes, focus, popovers), not to framework state.
2. **The divergence is temporary and directional.** WebKit has an implementation
   in trunk and a support position. Svelte's 2025 decision predates that.
3. **For the animation use case, the fallback is visually identical.** View
   transitions pair elements *by name*, not node identity, so `insertBefore`
   animates a reorder exactly as well as `moveBefore` does — Safari ships view
   transitions and `match-element` but not `moveBefore`, so its users get the
   same animation and lose only live state.
4. **The concession:** Harris is right that this produces browser-dependent
   behaviour, and we accept that cost knowingly rather than claiming it away. The
   mitigation is documentation and honest test coverage of *both* paths, not a
   pretence of uniformity.

## Decision

1. **Keep `moveBefore()` at both existing sites** — `each()` reorder and
   `portal()` — with feature detection on the **instance**, never on the global
   `Element.prototype`. React's production crashes came from exactly that mistake;
   our `canMoveWithin(parent)` already does the right thing and must stay that way.

2. **Do not adopt it in `projection.ts`.** Measured: light-DOM projection's
   remove-then-append costs one spurious disconnect/reconnect cycle and nothing
   observable — no iframe reload, no focus loss, no `setup` re-run, because the
   cycle closes inside one microtask and ADR 0023 covers the rest. The theory is
   persuasive and the measurement says no.

3. **Guard by precondition, not by `try`/`catch`.** Check same-parent and
   capability before calling, the way `morphlex` does. This is not style: a throw
   inside a view-transition update callback abandons the transition *and* leaves
   the DOM half-mutated.

4. **Keep the empty `connectedMoveCallback`.** It is the documented opt-in;
   without it the platform synthesizes teardown.

5. **Document the guarantees by tier.** Normative (iframes, focus, popovers,
   dialogs, fullscreen) may be relied on. Emergent (animations) may not.
   Unpreserved (Selection, undo, position-dependent animation) must be designed
   around.

6. **Pair with `viewTransition()` using `view-transition-name: match-element`**,
   not derived names. A transient duplicate name silently aborts the whole
   transition; `match-element` cannot collide.

## Consequences

**We have to say what our own proof does not cover.** `each()`'s proof asserts
animation preservation with a *static-attribute* animation — the easy case both
engines pass. It says nothing about the positional-selector case, where the
engines disagree.

**Two documented sharp edges have no test yet**: undo destruction and
position-dependent animation. Both should become reported (not asserted)
measurements, since engines legitimately differ.

**The instrument lesson generalizes.** Our first harness patched prototypes after
`define()`, so its lifecycle counters never incremented and `connected: 0` /
`disconnected: 0` passed vacuously — it would have passed just as happily if every
row had been destroyed and rebuilt. Any assertion that a callback did *not* fire
is worthless without a positive control proving the counter can move. WebKit's
fallback path now serves as that control.

**WPT gaps we should not assume are covered**: no scroll-position test, no media
test, no programmatic-Selection test, no `IntersectionObserver`/`ResizeObserver`
coverage. `selection-preserve.html` carries the comment *"This test seems to rely
on Chromium internal behavior!"*

**Two upstream reports are worth filing** on nisli's account: the Firefox
animation-invalidation divergence, and a question to Chromium about whether the
missing `StatePreservingAtomicMoveInProgress()` guard around the undo block is
deliberate.

**When WebKit ships**, the fallback branch stays — it is still needed for older
Safari — but the divergence section of this ADR should be revisited, and the
"pretend `moveBefore` doesn't exist" test lane becomes the only coverage of the
fallback (idiomorph lost that coverage silently when Chrome shipped).

## References

**Specification** — [`moveBefore()`](https://dom.spec.whatwg.org/#dom-parentnode-movebefore)
· [move algorithm](https://dom.spec.whatwg.org/#move) · [moving steps](https://dom.spec.whatwg.org/#concept-node-move-ext)
· [live range pre-remove steps](https://dom.spec.whatwg.org/#live-range-pre-remove-steps)
· [HTML moving steps](https://html.spec.whatwg.org/multipage/infrastructure.html#html-element-moving-steps)
· [HTML removing steps](https://html.spec.whatwg.org/multipage/infrastructure.html#html-element-removing-steps)
· [enqueue a custom element callback reaction](https://html.spec.whatwg.org/multipage/custom-elements.html#enqueue-a-custom-element-callback-reaction)
· [preserving custom element state when moved](https://html.spec.whatwg.org/multipage/custom-elements.html#preserving-custom-element-state-when-moved)

**Design history** — [explainer](https://github.com/noamr/dom/blob/spm-explainer/moveBefore-explainer.md)
· [whatwg/dom#1255](https://github.com/whatwg/dom/issues/1255) · [whatwg/dom#1307](https://github.com/whatwg/dom/pull/1307)
· [WebKit standards position #375](https://github.com/WebKit/standards-positions/issues/375)
· [Mozilla standards position #1053](https://github.com/mozilla/standards-positions/issues/1053)

**Implementations** — [Blink `node.cc`](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/dom/node.cc)
· [Gecko `nsINode.cpp`](https://searchfox.org/mozilla-central/source/dom/base/nsINode.cpp)
· [Bugzilla 1923880](https://bugzilla.mozilla.org/show_bug.cgi?id=1923880)
· [WebKit meta bug 281223](https://bugs.webkit.org/show_bug.cgi?id=281223)
· [WPT `dom/nodes/moveBefore`](https://github.com/web-platform-tests/wpt/tree/master/dom/nodes/moveBefore)

**Ecosystem** — [React disable PR #33348](https://github.com/facebook/react/pull/33348)
· [Svelte PR #15512](https://github.com/sveltejs/svelte/pull/15512) · [idiomorph](https://github.com/bigskysoftware/idiomorph)
· [htmx move-before example](https://htmx.org/examples/move-before/)

**Our measurements** — `packages/www/scripts/movebefore-proof.mjs`,
`packages/www/scripts/projection-cost.mjs`, and
`docs/research/2026-08-platform-sweep/README.md`.
