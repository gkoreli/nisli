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
 * The fit test, and the whole of finding F8.
 *
 * `overflows` alone is not enough. Flex children default to `flex-shrink: 1`,
 * so the browser can satisfy an overflowing row by squeezing children below
 * their content width: the row then reports `scrollWidth === clientWidth` and
 * the container-only predicate calls it `settled`, while the children's content
 * paints outside their boxes and over each other. Measured at the narrowest
 * demo width, the row was 318/318 — "settled" — with a Reply wrapper at
 * `clientWidth 32` against `scrollWidth 71`, and the buttons visibly overlapped.
 *
 * A crushed child is therefore just as unfit as an overflowing container, and
 * both must be re-measured on every pass: degrading one candidate can relieve
 * the overflow while leaving a neighbour crushed, and can equally un-crush a
 * child without relieving the overflow.
 */
function unfit<TNode>(container: TNode, metrics: Metrics<TNode>): boolean {
  return metrics.overflows(container) || metrics.crushed(container);
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
