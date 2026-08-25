# Bet 01 — Adopt `Node.moveBefore()` in `each()` and `portal()`

**Status**: Draft investment brief (candidate ADR, unnumbered)
**Date**: 2026-08-21
**Depends on**: ADR 0023 (move-resilient lifecycle), ADR 0030.2 §3 (accepted small, pre-review verdict §8)
**Relates to**: ADR 0016 (slot reconciliation), ADR 0022 (`@nisli/ui` registry), ADR 0025 §17 (hydration question), ADR 0029/0030 (agent-native)

## Context — why now

Nisli's identity is "the platform is the framework": light DOM, no VDOM, custom elements as the component boundary. The platform has now shipped the exact primitive nisli's two move sites have been emulating with heuristics: **`moveBefore()`**, an atomic, state-preserving DOM move.

Support status (verified 2026-08):

- **Chrome/Edge 133** (Feb 2025) — shipped, including `connectedMoveCallback`.
- **Firefox 144** (Oct 2025) — shipped, including `connectedMoveCallback`.
- **Safari** — *not shipped* through Safari 27; positive standards position, TP status unknown. **Feature detection is mandatory.**
- Not Baseline; React ships it behind experimental `enableMoveBefore`; htmx uses it opportunistically when available.

Semantics that matter for this bet (per WHATWG/MDN):

- `moveBefore(node, ref)` has `insertBefore`'s signature but **moves without remove+reinsert**. Preserved: iframe document (no reload), focus/`:focus`/`:active`, text selection, running CSS animations/transitions, popover open state, modal `<dialog>` state, fullscreen.
- It is a **move optimization, not an insert replacement**: node and new parent must share a document and their connectedness must match (strictly: the same shadow-including root), else it throws `HierarchyRequestError`. A freshly created node cannot be `moveBefore`'d into place.
- Custom elements: if the class defines **`connectedMoveCallback()`**, the browser calls it **instead of** `disconnectedCallback` + `connectedCallback` — for **every** custom element in the moved subtree. If undefined, the old pair still fires (state is still preserved).

ADR 0023 solved the *framework-lifecycle* half of the move problem (deferred teardown makes same-tick moves a no-op for setup/dispose), but it cannot recover *platform* state: today a keyed reorder in Chrome still reloads iframes, drops focus and selection, restarts animations, and closes popovers, because the move goes through `insertBefore`. ADR 0030.2 §3 already **accepted** this adoption as a small ("~10 lines, feature-detected, completes ADR 0023 on the platform's terms"), and its §8 pre-review verdict ruled: sound; **detection mandatory; 0023's deferred teardown is retained, not replaced; the dev tag-painter exempts `each-item` wrappers**. This brief is the design-gate expansion of that accepted item.

## Current state in nisli (evidence)

**Move site 1 — keyed `each()` reorder.** `packages/core/src/template.ts:1104-1108` creates a stable `<each-item>` wrapper (`display:contents`) per entry; the reorder pass at `template.ts:1120-1130` repositions wrappers with `parent.insertBefore(entry.wrapper, nextSibling)` (line 1127). The same loop also performs the *first* attach of fresh wrappers — the fallback-relevant distinction is `wrapper.parentNode === parent`.

**Lifecycle heuristic being completed.** `packages/core/src/component.ts:611-628` — `disconnectedCallback` defers teardown one microtask and skips it if `isConnected` (ADR 0023). The comment at 612-614 already names the gap: "only moveBefore() preserves state". `connectedCallback` at `component.ts:466-468` keeps the `_mounted` re-entry guard; `_teardownNow` (636-659) and `_remount` (662-666) are the true-removal/HMR paths. The base class where `connectedMoveCallback` belongs is `FrameworkComponent`, `component.ts:399`.

**Move site 2 — `portal()`.** `packages/ui/registry/default/lib/portal.ts:78-88` moves the referenced subtree with `dest.appendChild(el)` on mount (line 85); cleanup removes it (90-93). Its header comment (lines 11-16) leans explicitly on the ADR 0023 heuristic. Ten overlay families consume it: dialog, alert-dialog, sheet, drawer, popover, tooltip, hover-card, dropdown-menu, context-menu, menubar (e.g. `packages/ui/registry/default/ui/dialog.ts:241-292`, which portals a `display:contents` wrapper and runs `focusTrap` + `data-state` CSS animations on the moved subtree).

**Move-compatibility of the surrounding libs (checked):**

- Context is resolved by a `parentElement` walk **at setup only** (`packages/core/src/element-context.ts:32-39, 108-113`); the file already documents the portal case ("resolution happens at setup … a later walk from the portaled host would find nothing"). Nothing is position-dependent → an **empty** `connectedMoveCallback` is correct, not a placeholder.
- `dismissable-layer.ts:62` hit-tests with `root.contains(event.target)` — indifferent to how the subtree got where it is.
- `focus.ts` captures `document.activeElement` at activate for restore; `moveBefore` *reduces* churn (a reorder inside an active trap no longer blurs → no pull-back cycle).
- Slot/array reconciliation (`template.ts:554-613`) detaches old nodes and inserts *fresh or detached* nodes — not a move site today (nodes are disconnected at insert time); out of scope.

**Environment facts that shape the plan:** unit suites run in happy-dom (`packages/core/vitest.config.ts:6`, same for ui); installed happy-dom 20.8.9 has **no** `moveBefore` (verified against `node_modules`), so the fallback path is what vitest exercises natively. Installed TypeScript 5.9.3's `lib.dom.d.ts` has **no** `moveBefore` typings (verified) — a local interface cast is needed. A real-browser Playwright harness precedent exists at `packages/www/scripts/preview-sweep.mjs` (and `animation-proof.mjs` for state proofs).

## Proposed design

Three edits, all semantics of existing exports — **zero new API surface** (0030.2 §7 counts this at zero barrel statements).

**1. Local typing + per-call detection (core).** Detection is per-parent, not a module-level const: it costs one property lookup per reconcile and keeps the path testable (a happy-dom prototype shim installed by a test is seen immediately; a module-scope const frozen at import time would not be).

```ts
// template.ts (module scope) — TS 5.9 lib.dom has no moveBefore typing yet
interface MoveCapableParent extends ParentNode {
  moveBefore(node: Node, child: Node | null): void;
}
const canMoveWithin = (parent: ParentNode): parent is MoveCapableParent =>
  typeof (parent as Partial<MoveCapableParent>).moveBefore === 'function';
```

**2. `each()` reorder** (`template.ts:1120-1130` replacement):

```ts
let cursor: Node = startMarker;
for (const entry of newEntries) {
  const nextSibling = cursor.nextSibling;
  if (nextSibling !== entry.wrapper) {
    if (entry.wrapper.parentNode === parent && canMoveWithin(parent)) {
      // Reposition of an already-attached wrapper: atomic, state-preserving.
      // parentNode === parent guarantees same tree/document and matching
      // connectedness, so moveBefore cannot throw here.
      parent.moveBefore(entry.wrapper, nextSibling);
    } else {
      // First attach of a fresh wrapper, or an engine without moveBefore.
      parent.insertBefore(entry.wrapper, nextSibling);
    }
  }
  cursor = entry.wrapper;
}
```

The guard `wrapper.parentNode === parent` is the whole safety argument: it is precisely the "this is a move, not an insert" discriminator, and it makes the throwing preconditions unreachable (each-wrappers only ever live under this parent).

**3. Base-class `connectedMoveCallback`** (`component.ts`, beside `disconnectedCallback` ~line 628):

```ts
/**
 * Declared (empty) so a moveBefore() by ANY actor — each(), portal(),
 * user code, htmx — is a spec-level lifecycle no-op: the browser calls
 * this INSTEAD of disconnected+connected for every nisli component in
 * the moved subtree. Bindings track nodes by reference and context
 * resolves at setup (element-context.ts), so nothing is position-
 * dependent. ADR 0023's deferred teardown is RETAINED — it remains the
 * correctness layer for append-based moves (Safari, third-party code).
 */
connectedMoveCallback(): void {}
```

Under `moveBefore`, `_teardownScheduled` is never set and the `_mounted` guard is never consulted — the move is invisible to the framework, by spec rather than by microtask heuristic.

**4. `portal()`** (`packages/ui/registry/default/lib/portal.ts:84-86`; the registry file is a copy-in — it may only use public `@nisli/core` API, so it inlines its own 3-line detection rather than importing a core internal):

```ts
if (dest && dest !== el.parentNode) {
  const movable =
    typeof (dest as Partial<MoveCapableParent>).moveBefore === 'function' &&
    el.isConnected && dest.isConnected &&
    el.ownerDocument === dest.ownerDocument;
  if (movable) dest.moveBefore(el, null); // append position, like appendChild
  else dest.appendChild(el);              // detached mount, cross-doc, Safari
}
```

Portal gates on *both connected* (not merely matching states): two detached fragments are different shadow-including roots and would throw, and a detached move has no observable state to preserve anyway. `moveBefore(el, null)` appends at the end, preserving the documented sibling-stacking-order contract (portal.ts:30-33). Cleanup stays `removeChild` — a true removal.

## Implementation plan (phased, file-level)

- **Phase 0 — design gate** (this document, 0025 process). Assign ADR number; record the §8 rulings it inherits.
- **Phase 1 — core**: `packages/core/src/template.ts` (reorder loop + typing, ~12 lines), `packages/core/src/component.ts` (empty `connectedMoveCallback`, ~4 lines + comment). Tests: `each.test.ts`, `component.test.ts` (below). No barrel change.
- **Phase 2 — ui registry**: `packages/ui/registry/default/lib/portal.ts` (~8 lines) + `portal.test.ts`. No changes to the 10 overlay consumers. Note for the changelog: copy-in model means existing user copies keep `appendChild` until re-synced — acceptable, it is a progressive enhancement.
- **Phase 3 — real-browser proof**: new `packages/www/scripts/movebefore-proof.mjs` following the `animation-proof.mjs` precedent, run on **chromium + firefox + webkit** — webkit certifies the fallback in a real engine, not just happy-dom. Harness ships with the pre-review cleanup-checklist attestation (instrument-truth gate).
- **Phase 4 — docs**: pointer added to ADR 0023 ("completed on the platform's terms"); 0030.2 §3 item marked landed. `llms-core` docs unchanged (no API surface).

## Feature detection & fallback

- Detection is **presence of `moveBefore` on the actual parent node**, per call — no UA sniffing, no module-scope freeze, shim-friendly in tests.
- Fallback is the **exact current code path** (`insertBefore` / `appendChild`), and ADR 0023's deferred teardown remains in place unconditionally, so Safari and happy-dom keep today's behavior bit-for-bit. The upgrade is *only* platform-state preservation; framework correctness is identical on both paths. This dual-path posture is permanent until Safari ships.
- Throw-safety is by construction (guards above), not try/catch: `each()` requires `parentNode === parent`; portal requires both-connected + same document.
- happy-dom 20.8.9 lacks the API → vitest exercises the fallback by default; the move path is unit-tested via a prototype shim and truth-tested in Phase 3 browsers.

## Interactions with other ADRs & bets

- **ADR 0023** — completed, not replaced. The relationship inverts: `moveBefore` becomes the primary path in capable engines and the microtask heuristic becomes the fallback correctness layer. The 0023 edge case ("a remove+reinsert spanning a microtask boundary still tears down") remains only on the fallback path. No interaction hazard with pending teardowns: a third party cannot `moveBefore` a disconnected node into a connected parent (throws), so the deferred-teardown microtask can never race a spec-level move.
- **ADR 0030.2** — this is the design gate for the §3 accepted small; honors all §8 rulings (detection mandatory; teardown retained; the factory-in-tag-position dev painter exempts `each-item` so the undefined-dash-tag red box never flags the wrapper). §7's accounting holds: zero new exports.
- **ADR 0025 §17 (hydration/islands)** — 0030.2 §5 names this item an enabler: spec-level moves remove the upgrade-order and platform-state hazards an adopt-in-place design would surface. Landing it first de-risks that disposition.
- **UI-30 attribute-as-truth** — an open `[popover]` or animated `data-state` overlay inside a reordered `each()` row now keeps its platform state in Chrome/Firefox; attribute truth and platform truth stop diverging mid-move.
- **Agent-native (0029/0030)** — reorders stop perturbing focus/selection/animation, so agent verification loops (screenshots, aria snapshots, `settle()`-gated assertions) see deterministic state across moves.
- **Not converted**: slot/array reconciliation (`template.ts:554-613`) and `children()` projection re-mounts — their nodes are detached at insert time; converting them means restructuring to keep nodes attached during reorder. Explicit non-goal; revisit only with a second consumer.

## Risks & open questions

- **Safari divergence** (risk, accepted): state preservation is Chrome/Firefox-only for now; Safari degrades to today's behavior. Cross-engine visual divergence (e.g. animations restarting only in Safari) may surface in snapshot-style tests.
- **Behavioral flip** (risk, small): an author *relying* on a reorder restarting a CSS animation loses that in capable engines. Document: restart animations explicitly (`el.getAnimations().forEach(a => a.cancel())` or class toggling).
- **Test-environment blind spot** (risk, mitigated): happy-dom cannot exercise lifecycle suppression; the shim can only prove call-site selection. Phase 3's three-engine run is therefore mandatory, not optional — per the instrument-truth discipline.
- **Open**: should `connectedMoveCallback` be exposed to component authors (an `onMove()` lifecycle hook)? Deferred — zero in-repo consumers; second-consumer rule.
- **Open**: happy-dom may ship `moveBefore` in a future minor; when it does, the unit shim becomes redundant and vitest starts exercising the move path natively — the suite must not pin fallback-only behavior (assert *outcomes*, not which DOM method ran, outside the dedicated shim tests).
- **Open**: portal target inside a same-document shadow root — both-connected guard permits `moveBefore` across shadow boundaries (same shadow-including root); confirm in Phase 3 rather than assuming.

## Verification plan

**Unit (happy-dom, vitest):**

- `packages/core/src/each.test.ts` — with a scoped prototype shim (`Object.defineProperty(Element.prototype, 'moveBefore', …)` delegating to `insertBefore`, removed in `afterEach`): (a) repositions of attached wrappers call `moveBefore`; (b) first attach of fresh wrappers uses `insertBefore` even when the shim is present; (c) removals never route through `moveBefore`; (d) the full existing suite green *without* the shim certifies the fallback path unchanged.
- `packages/core/src/component.test.ts` — every defined component class has a `connectedMoveCallback` that is a no-op (no state mutation, no scheduling); `_remount()` and HMR paths unaffected.
- `packages/ui/registry/default/lib/portal.test.ts` — shim variant: connected mount moves via `moveBefore(el, null)` and lands as last child (stacking-order contract); mount into a detached fragment falls back to `appendChild` (no throw); cleanup removes the moved node on both paths.

**Real browser (`packages/www/scripts/movebefore-proof.mjs`, chromium + firefox + webkit):** render a keyed `each()` list and an overlay via the built preview pages, then for each engine assert:

1. **Focus**: focus an `<input>` in row 3, reorder rows; `document.activeElement` is still that input and a `blur` listener counter reads 0 (chromium/firefox). Webkit: activeElement may reset — assert the ADR 0023 invariant instead (setup ran exactly once).
2. **Selection**: select text inside a row, reorder; `getSelection()` anchorNode/anchorOffset unchanged.
3. **Iframe**: row containing `<iframe srcdoc>` that increments `window.__loads` on load; after 5 reorders the count is 1 (chromium/firefox); webkit documents the reload count as fallback baseline.
4. **CSS animation**: element with a running animation; the `Animation` object from `getAnimations()[0]` is the same instance after the move and `currentTime` never reset toward 0.
5. **Popover**: open `[popover]` inside a row; after reorder it still matches `:popover-open`.
6. **Lifecycle suppression**: instrumented counter component inside a row asserts 0 `disconnectedCallback`/`connectedCallback` and ≥1 `connectedMoveCallback` per reorder (chromium/firefox); webkit asserts the deferred-teardown no-op (0 re-setups).
7. **Portal**: dialog whose content holds the iframe counter; open it (portal move to `document.body`) — load count 1, focus trap lands correctly.

## Size estimate

| Phase | Work | Person-days |
|---|---|---|
| 1 | core: each() + base class + unit tests | 0.5–1.0 |
| 2 | ui: portal + tests | 0.5 |
| 3 | three-engine proof harness + attestation | 1.0–1.5 |
| 4 | ADR/doc updates, gate paperwork | 0.5 |
| **Total** | ~10 lines of production code, mostly verification | **2.5–3.5** |

The cost profile is the inverse of most bets: trivial code, meaningful proof obligations. Given the item is already accepted in 0030.2 and the payoff (platform-state fidelity + spec-level lifecycle instead of a heuristic) lands on every keyed list and all ten overlay families at once, this is a high-conviction, low-regret investment.

## References

In-tree: `template.ts:1104-1130`, `component.ts:399/466-468/611-666`, `element-context.ts:32-39`, `portal.ts:78-93`, `dialog.ts:241-292`, `dismissable-layer.ts:62`, `focus.ts`; ADRs 0016, 0022, 0023, 0025 (§17), 0029, 0030, 0030.2 (§3, §5, §7, §8).
Platform: [MDN `Element.moveBefore`](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore) · [Chrome blog: moveBefore API](https://developer.chrome.com/blog/movebefore-api) · [Firefox 144 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/144) · [caniuse: Element.moveBefore](https://caniuse.com/mdn-api_element_movebefore) · [MDN: Using custom elements (`connectedMoveCallback`)](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) · [web-features: moveBefore](https://web-platform-dx.github.io/web-features-explorer/features/move-before/) · [htmx moveBefore example](https://htmx.org/examples/move-before/)
