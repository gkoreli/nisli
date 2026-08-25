/**
 * admitted.ts — the ONE definition of "this container already reported itself".
 *
 * One root cause must produce one primary finding. This is the rustc and Biome
 * discipline: the primary diagnostic names the cause and its consequences ride
 * along as notes, never as peers competing for the reader's attention. It is
 * also this bet's documented kill criterion — a noisy oracle gets muted, and
 * muting starts the first time one fact costs four findings.
 *
 * The measured case: at width 360 in a touch context a message row genuinely
 * could not fit. It collapsed everything it was allowed to collapse, stamped
 * `data-fit="unsatisfiable"`, and reported clientWidth 358 against scrollWidth
 * 360. N620 said exactly that, with the best numbers anyone has — the shortfall
 * AND the degradations already spent. Then N660 reported the same two units as a
 * crush and N670 reported them a third time as a collision. Nothing actionable
 * was added after the first finding.
 *
 * So the node carrying `data-fit="unsatisfiable"` is exempt from N660 and N670.
 * EXACTLY that node, and nothing else:
 *   - its descendants stay in scope. A crushed child inside an unsatisfiable row
 *     is a different defect — it means the theme's no-crush rules stopped
 *     holding inside a row that was refusing to crush anything — and it is the
 *     F8 shape precisely, so it must still fire.
 *   - its ancestors stay in scope too, which means the enclosing surface still
 *     reports its own echo of the same overflow. That duplicate is ACCEPTED
 *     deliberately: suppressing it needs an inheritance analysis, and a
 *     suppression rule nobody can predict is how a checker starts hiding real
 *     defects. One predictable echo costs a reader a second of triage; an
 *     unpredictable exemption costs them their trust in the tool.
 *
 * The rule is local, testable, and states its own blind spot.
 */

import type { Inspector } from '../contracts.js';

/**
 * Containers that have admitted they cannot fit. Built once per check pass and
 * consulted by every rule that would otherwise re-report their geometry.
 */
export function admittedFailures<TNode>(inspector: Inspector<TNode>): ReadonlySet<TNode> {
  return new Set<TNode>(inspector.all('[data-fit="unsatisfiable"]'));
}
