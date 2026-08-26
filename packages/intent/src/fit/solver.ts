/**
 * solver.ts — the measured tier, as a pure function of the ports.
 *
 * This file never touches a document: every geometry read goes through
 * `Metrics` and every write through `Mutator`, which is what makes the
 * algorithm testable with a fake in-memory box model and what would let it
 * graduate into @nisli/core unchanged.
 *
 * It is not a constraint solver. It degrades declared candidates, least
 * important first, until the container is no longer broken.
 */

import type {
  Candidate,
  Degradation,
  FitOutcome,
  FitState,
  Metrics,
  Mutator,
} from '../contracts.js';
import { orderCandidates } from './candidates.js';
import { allowsShrink, needsAffordance } from './strategies.js';

/**
 * The fit test. Three questions, one per way a declared layout can be broken,
 * and each one was added because the set before it reported a visibly destroyed
 * container as `settled`.
 *
 * `overflows` alone is not enough, and that is the whole of finding F8. Flex
 * children default to `flex-shrink: 1`, so the browser can satisfy an
 * overflowing row by squeezing children below their content width: the row then
 * reports `scrollWidth === clientWidth` and the container-only predicate calls
 * it `settled`, while the children's content paints outside their boxes and
 * over each other. Measured at the narrowest demo width, the row was 318/318 —
 * "settled" — with a Reply wrapper at `clientWidth 32` against `scrollWidth 71`,
 * and the buttons visibly overlapped.
 *
 * `overflows || crushed` IS STILL NOT ENOUGH, AND THE REASON IS AN AXIS. Both
 * of those are inline-axis tests, and content that cannot fit horizontally has
 * a second way out: it WRAPS. A text run that reflows satisfies the inline
 * measurement by construction — it made itself exactly as wide as the box it
 * was given — and spends what it could not fit in the block axis, where neither
 * predicate is looking. Measured at a 346-unit column: a grow region collapsed
 * to the width of one word, the title inside it reflowed to ten line boxes, the
 * row stood over ten times its declared height, and the container reported
 * `scrollWidth 346 === clientWidth 346`, `settled`, nothing collapsed, and a
 * clean run from every rule. F8's exact shape one axis over, which is why the
 * third question is `wrapped` and why the principle the first two were bought
 * with covers it unchanged: A CHECK MUST MEASURE THE BOX ITS CLAIM IS ABOUT,
 * and `data-fit` claims the DECLARED LAYOUT was achieved, not one axis of it.
 *
 * `wrapped` is the only one of the three that is gated on a declaration, and it
 * has to be: block growth is legitimate almost everywhere. A stack flowing down
 * the block axis is a stack working. The gate is therefore `data-layout`, which
 * is where the author already said which axis is a flow axis — no threshold, no
 * ratio and no pixel count decides it, because a magnitude here would be a
 * hand-picked number standing in for a declaration that already exists.
 *
 * All three are re-measured on every pass. Degrading one candidate can relieve
 * the overflow while leaving a neighbour crushed, can un-crush a child without
 * relieving the overflow, and — now — can unwrap a text run without doing
 * either.
 */
function unfit<TNode>(container: TNode, metrics: Metrics<TNode>): boolean {
  return metrics.overflows(container) || metrics.crushed(container) || metrics.wrapped(container);
}

/**
 * Solve one container. Idempotent: it always restores the undegraded state
 * first, so re-solving at a new width can *undo* degradations, not only add
 * them.
 */
export function solveFit<TNode>(
  container: TNode,
  candidates: readonly Candidate<TNode>[],
  metrics: Metrics<TNode>,
  mutator: Mutator<TNode>,
): FitOutcome<TNode> {
  const ordered = orderCandidates(candidates);

  // Reset before measuring anything. The affordance is part of the geometry —
  // a trigger left visible from the previous solve occupies inline space and
  // would make the container look fuller than it is.
  for (const candidate of ordered) mutator.clear(candidate.node);
  mutator.revealOverflow(container, false);

  const applied: Degradation<TNode>[] = [];
  let affordance = false;
  let passes = 0;

  // Each pass consumes exactly one candidate and never revisits it, so the loop
  // is bounded by `ordered.length` by construction: a strategy that fails to
  // change the geometry (hiding an already-collapsed node, truncating a value
  // with nothing to clamp) costs one pass and is dropped, never retried.
  //
  // THAT BOUND IS WHAT MADE `wrapped` SAFE TO ADD TO THE PREDICATE, and the
  // hazard it had to survive is recorded rather than theoretical: sweeping a
  // row's required width across the 15-unit window a classic scrollbar opens
  // and closes, 79 of 91 widths were PERMANENTLY BISTABLE — degrade, lose the
  // scrollbar, un-degrade, regain it, forever. So a predicate that can flip as
  // a consequence of its own degradation is a real way to hang this loop.
  //
  // It cannot hang THIS loop, on the same argument the bound above already
  // makes: `next` strictly increases every pass and no candidate is ever
  // reconsidered, so the loop's progress does not depend on the predicate
  // becoming false, only on the candidate list running out. Widening the
  // predicate can only make the loop spend MORE of a finite list.
  //
  // Across solves the argument is different and has to be made separately,
  // because the observer re-solves whenever the container's box changes and
  // unwrapping a text run changes the container's BLOCK size by construction.
  // A solve resets first and is otherwise a pure function of the container's
  // INLINE size, and every strategy here reduces inline demand; nothing in the
  // set makes a container inline-wider in a way a later pass could undo. So the
  // second solve reaches the same fixed point, reports the size it already
  // reported, and the observer stops. The one path from a block-axis change
  // back into an inline size is an ancestor scroll container whose classic
  // scrollbar comes and goes — which is the recorded hazard above, is not
  // reachable from inside a solver at all, and is answered where it was
  // measured: `scrollbar-gutter: stable` in the table took that sweep from 79
  // of 91 to 0 of 91.
  //
  // The affordance is revealed the moment the first `menu` degradation lands,
  // not after the loop, because the trigger occupies inline space and every
  // later pass must measure the geometry the reader will actually get.
  // Revealing afterwards let the loop stop while the container fit WITHOUT the
  // trigger, then hand back `unsatisfiable` once the trigger was painted — with
  // candidates still unspent, which is the solver giving up on a container it
  // could still have degraded.
  let next = 0;
  while (next < ordered.length && unfit(container, metrics)) {
    const candidate = ordered[next++]!;
    mutator.apply(candidate.node, candidate.strategy);
    applied.push({ node: candidate.node, strategy: candidate.strategy });
    passes += 1;
    if (affordance || !needsAffordance(candidate.strategy)) continue;
    affordance = true;
    mutator.revealOverflow(container, true);
  }

  const state: FitState = unfit(container, metrics) ? 'unsatisfiable' : 'settled';
  // Only degradations that removed the node from the flow are "collapsed"; a
  // truncated node is still there, still readable, still counted as present.
  const collapsed = applied.reduce(
    (total, degradation) => (allowsShrink(degradation.strategy) ? total : total + 1),
    0,
  );
  mutator.markFit(container, state, collapsed);

  return { state, applied, passes };
}
