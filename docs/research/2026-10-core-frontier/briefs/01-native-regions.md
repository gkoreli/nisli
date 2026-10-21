# Bet 01 — Native rendering regions and fewer keyed moves

**Revised verdict:** defer the rendering-region replacement. The problems are
measured, but their application impact and the replacement's capability costs
are not. The original investigate-first priority is withdrawn. Treat move
selection separately and require representative workload evidence before adopting
even that optimization. See the [reassessment](../reviews/risk-value-reassessment.md).

**Evidence:** `template.ts:1317` inserts `each-item`; the
[three-browser experiment](../experiments/native-semantics/RESULT.md) finds native
table/fieldset failures in every browser, select failures in Firefox, and 99 moves
for a left rotation of 100 keys. The reverse takes one.

**Small change:** evaluate head/tail matching before allocating maps. See
[Lit repeat](https://github.com/lit/lit/blob/main/packages/lit-html/src/directives/repeat.ts).
Require one move for either rotation and unchanged keyed node identity.

**Larger change:** represent owned DOM regions without requiring an element
wrapper. Keep native single roots directly under native parents. Preserve bounds
for empty/multiple roots and reactive subtree swaps. Use `moveBefore` when its
preconditions hold; do not extract live ranges into disconnected fragments.

**Adversarial acceptance:** reproduce each failing semantic probe as a permanent
test; then test prepend/append/delete/swap/reverse/shuffle, duplicate-key recovery,
multi-root and empty entries, changing branches, custom-element setup counts,
disposal, context, HMR, focused inputs and native controls across three engines.
Run the existing move proof. Preserve WebKit fallback behavior without claiming
native atomic move support. ARIA naming is insufficient to pass native API checks.

**Compatibility risk:** consumers may select `each-item`; component factories
still create custom hosts even after list wrappers disappear. A hostless component
model is a separate proposal. No 99× timing claim follows from the move count.
