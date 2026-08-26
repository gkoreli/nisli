/**
 * N740 — text reflowed inside a container that declared a single line.
 *
 * THE NINTH ORACLE BUG, AND THE FIRST IN THE SOLVER RATHER THAN IN A RULE. The
 * fit predicate was `overflows(container) || crushed(container)`, and both of
 * those are inline-axis tests. Content that cannot fit horizontally has a second
 * way out that neither can see: it WRAPS. A reflowed run makes itself exactly as
 * wide as the box it was given, so the box does not overflow and nothing is
 * crushed, and the space it could not have is taken out of the block axis
 * instead — where the container simply GROWS to accommodate it and reports
 * success.
 *
 * Measured at a 346-unit column: a grow region collapsed to the width of the
 * single word "appearance", the title inside it rendered ten words down a
 * column, the row stood over ten times the height it was declared for, and the
 * container reported `data-fit="settled"`, `data-collapsed-count="0"`,
 * `scrollWidth 346 === clientWidth 346`, and a clean run from every rule in this
 * directory. N660 could not see it — the box got exactly the min-content it
 * asked for, so there is no crush. N690 could not see it — ten words on ten
 * lines is a wrap and not a shred. N620 could not see it — the row settled.
 * N715 could not see it either, and that one is worth stating twice: scroll
 * extents are directional, but here they are blind for a second and simpler
 * reason, which is that NOTHING OVERFLOWED. A container that absorbs growth into
 * its own height has no scrollable overflow region to report.
 *
 * THE DECLARED INTENT, stated before the measurement because the measurement
 * means nothing without it. `data-layout="row"` resolves to `flex-flow: row
 * nowrap`: one line of children, and `wrap` sits beside it in the same closed
 * vocabulary as the value an author writes when a second line is what they
 * want. So a row's block extent is a consequence of how tall its children
 * intrinsically are; it is not a reservoir for content that would not fit
 * inline. Every other layout value declares the opposite — a `stack` flows down
 * the block axis and a `grid` places rows in it — and for those, the identical
 * geometry is the declaration working exactly as written. That is why this rule
 * has no threshold anywhere in it: a pixel count or a height ratio would be a
 * hand-picked number standing in for a declaration the author already made, and
 * hand-picked numbers are the thing this package exists to delete.
 *
 * WHY IT IS A LINE-BOX COUNT AND NOT A HEIGHT. Three measurements were
 * available and two of them are already recorded as wrong:
 *   - a child's block size divided by its line height is N690's arithmetic, and
 *     N690's own header records what it costs outside prose — a padded box
 *     counts its padding as extra lines, and a control's box is a hit TARGET
 *     whose slack is the target floor doing its job, so the widening fired on a
 *     clean icon button. `line-height: normal` is not a length either, so a
 *     third of the surface would be undecidable rather than counted.
 *   - the container's block size against its tallest child's single-line height
 *     needs that same line height, and additionally cannot tell a row that is
 *     tall because its content reflowed from a row that is tall because it holds
 *     something genuinely tall, which is most rows.
 *   - `scrollHeight` against `clientHeight` sees nothing at all here, for both
 *     reasons above.
 * `Inspector.lines()` counts the line boxes the browser produced. There is no
 * divisor, so there is nothing to get wrong, and it measures the TEXT rather
 * than the element — which is the principle the first run paid five defects for:
 * A CHECK MUST MEASURE THE BOX ITS CLAIM IS ABOUT.
 *
 * SOLVER AND CHECKER, AND WHICH DOES WHAT. `Metrics.wrapped()` puts this same
 * test inside `unfit()`, because the declared strategies genuinely pay out on
 * it: truncation resolves to `nowrap` plus an ellipsis and collapses a reflowed
 * run to one line by construction, and `hide` and `menu` take it out of the flow
 * entirely. So a row that CAN be degraded is degraded, and this rule is silent
 * about it — the better outcome, because it fixes the page instead of reporting
 * it. This rule is what speaks for the rows the solver cannot fix: one with no
 * candidate left to spend, and one the solver never ran on at all, which is
 * every statically rendered container before hydration.
 *
 * SCOPE IS `[data-fit]` ROWS, DELIBERATELY NARROWER THAN THE ARGUMENT ABOVE.
 * The claim under audit is the one `data-fit` makes — that the DECLARED layout
 * was achieved, not that one axis of it was — and that is also the only shape
 * the defect has been measured in. A plain `[data-layout="row"]` makes the same
 * single-line declaration and is not covered here, for one honest reason: the
 * table hands `overflow-wrap: anywhere` and `min-inline-size: 0` to every
 * `[data-text]` DESCENDANT of a grid, nested rows included, so a row inside a
 * grid cell can reflow under a licence the table granted on purpose one level
 * up. Whether that leak is a defect in the selector or intended coverage has not
 * been measured, and a rule that fires on an unmeasured shape is how an oracle
 * gets muted. Recorded as a limit rather than closed by guessing.
 *
 * TWO EXEMPTIONS, and neither is discretionary:
 *   - a node the solver actually truncated. `[data-truncate]` resolves to one
 *     clamped line, so a rectangle claiming otherwise is stale;
 *   - the open overflow panel AND EVERYTHING INSIDE IT. The panel is out of
 *     flow, so its height is not the row's, and its items are MEANT to reflow —
 *     measured wrapping to two lines in a 320-unit container with the panel
 *     open. Exempting the panel element and then walking into its children is
 *     precisely the defect N715 shipped, and it is the second time that shape
 *     would have been introduced by analogy, so the exemption is spelled as a
 *     subtree from the first line.
 * A node whose own containment is not `visible` is exempt too: a scroller keeps
 * the growth reachable inside itself and a clipper deletes it, which is N710's
 * claim. The residue is an INTERVENING scroller between the text and the row,
 * which ancestry-free selectors cannot express; it under-exempts rather than
 * under-reports, and it has not been observed.
 *
 * NOT EXEMPT: a reflowed node inside a row that already admitted
 * `data-fit="unsatisfiable"`. `admitted.ts` states the boundary and this is on
 * the far side of it — the exemption is local to the node that admitted, and its
 * descendants stay in scope because a defect inside an unsatisfiable row is a
 * different defect from the row's own shortfall. N620 names the container and
 * the degradations it spent; this names the element that reflowed and how far.
 *
 * THE FOURTH DECLARATION-TRIGGERED RULE, and the one whose omission was named
 * in advance. Both halves of `SINGLE_LINE` are attributes — `data-fit` from the
 * mutator, `data-layout` from the author — so the trigger is a source fact
 * while the claim is a line count, which only exists once text has been laid
 * out. This rule shipped with the right accessor and the right claim and
 * NEITHER guard, one file after N715's header wrote down that "a fix applied to
 * one rule and not to the rule beside it is its own defect class". The
 * prediction was recorded and the next instance happened anyway, which is why
 * the guards are now in the constructor rather than in a sentence. Two verdicts
 * move: a row declared to hold one line whose text reflowed inside content
 * skipped by `content-visibility: auto` is N680 rather than silence, and a
 * reflow inside an escaped subtree stops being reported at all, because the
 * rhythm guarantee is the first one N601 says an escape forfeits.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

/**
 * The containers whose claim this is. Both halves are load-bearing: `data-fit`
 * is the claim that the declared layout was achieved, and `data-layout="row"` is
 * the declaration that says achieving it means one line.
 */
const SINGLE_LINE = '[data-fit][data-layout="row"]';

/** The overflow panel and its contents, out of flow and meant to reflow. */
const PROMOTED = '[data-overflow-menu], [data-overflow-menu] *';

export function reflowedRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N740', (lens, out) => {
    for (const row of lens.painted(SINGLE_LINE).items) {
      // Ancestry is not on the port, so subtree exclusion is a second query and
      // an identity set — the same shape N660 uses for document furniture. The
      // escaped subtrees this idiom used to be copied for are the seam's now.
      const promoted = new Set(row.declared(PROMOTED).map((el) => el.node));
      for (const el of row.painted('*').items) {
        if (promoted.has(el.node)) continue;
        if (el.attr('data-truncate') !== null) continue;
        const lines = el.lines();
        if (lines < 2) continue;
        if (el.containment() !== 'visible') continue;
        out.finding(
          el.subject,
          `reflowed onto ${lines} line boxes in a ${Math.round(el.box().inline)}px box, inside a row declared to hold one line — the inline space this text did not get was taken out of the block axis, where no overflow and no crush can see it`,
        );
      }
    }
  });
}
