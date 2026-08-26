/**
 * N620 — a container promised to fit and could not.
 *
 * The solver records its own verdict on the container, so this rule reads a
 * decision rather than re-deriving it: the checker and the engine cannot
 * disagree about whether a fit was satisfiable. What the rule adds is the
 * numbers a reader needs — how much inline space the content still wants
 * against how much the container has — because "unsatisfiable" alone tells the
 * author nothing about how far off they are.
 *
 * `painted`, because those numbers are a MEASUREMENT of the container. The F4
 * precondition this rule used to spell out by hand — a collapsed container
 * measures 0×0, and reporting "needs zero inline space in a zero-wide box" is
 * worse than saying nothing — is now owned by the lens: `painted()` is the only
 * route to geometry, so the unrendered container cannot reach the comparison.
 * `box()` and not `bounds()`, because "does the content fit in its container"
 * is a containment question, and `contentInline` against `inline` is only a
 * like-for-like comparison inside the padding box.
 *
 * DECLARATION-TRIGGERED AND STILL A MEASURING RULE, which is the interesting
 * half of this file. The trigger is `data-fit`, written by the mutator, so the
 * defect is present in the source whether or not anything rendered — and that
 * made `painted()` look like the wrong selector. It is the right one, because
 * the FINDING is a pair of numbers and the numbers are the whole value: the
 * author already knows the solver gave up, and what they do not know is by how
 * much. What changes with the measuring constructor is the case that used to
 * fall between the two readings. An `unsatisfiable` container inside content
 * skipped by `content-visibility: auto` is a real defect that the checker
 * cannot put numbers to, and `painted()` used to drop it in silence; the
 * injection harness seeded exactly that and watched this rule report a clean
 * page. It is now N680, naming the container. A container that is merely
 * `display: none` still stays silent, and that difference is the reason the
 * seam distinguishes unrendered from unmeasurable at all: a collapsed box
 * reports zero honestly, and a skipped box reports zero while a defect sits
 * inside it.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

export function fitStateRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N620', (lens, out) => {
    for (const el of lens.painted('[data-fit]').items) {
      if (el.attr('data-fit') !== 'unsatisfiable') continue;
      const box = el.box();
      const collapsed = el.attr('data-collapsed-count') ?? '0';
      out.finding(
        el.subject,
        `unsatisfiable: content needs ${Math.round(box.contentInline)}px of inline space in a ${Math.round(box.inline)}px container after ${collapsed} declared degradation(s)`,
      );
    }
  });
}
