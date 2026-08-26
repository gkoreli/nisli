/**
 * N730 — a declared degradation was spent and bought nothing.
 *
 * THE DEFECT, measured on a hostile-content sweep. A message row carrying a
 * fifty-eight-character unbreakable token reported `data-fit="unsatisfiable"`
 * at 433 pixels needed in a 318 pixel container, after applying FOUR declared
 * degradations. One of them was `truncate` on the author name. The truncated
 * element measured 375 wide with a content width of 375 — it had not shrunk by
 * a single pixel.
 *
 * The cause is in the resolution table, not in the solver or the author's
 * declaration. `truncate` resolves to `white-space: nowrap` plus
 * `text-overflow: ellipsis`, and for a single unbreakable token `nowrap` makes
 * the element's MINIMUM content width equal the whole text width. An ellipsis
 * can only clamp text that was already permitted to be narrower than itself.
 * So the strategy is spent, the pass moves on, and the container honestly
 * reports that it still does not fit.
 *
 * WHY THIS IS A LIMIT ON THE THESIS RATHER THAN A PAGE BUG, and why it earns
 * its own code instead of being filed under the clip it causes downstream:
 *
 *   - F9 was the table stating an IMPOSSIBLE constraint — a track minimum that
 *     shrank with density while the content floors inside it did not.
 *   - F11 established that priority orders WHEN a strategy is spent, never
 *     WHETHER: `unsatisfiable` means every declared strategy is spent and it
 *     still does not fit, and nothing weaker.
 *   - This is the third direction: a strategy whose IMPLEMENTATION cannot pay
 *     out on the content it was applied to. The author declared the right
 *     intent. The solver executed it faithfully. The table implemented it in a
 *     way that returns zero on this input, and there was no channel through
 *     which either of them could have discovered that.
 *
 * It is therefore the same argument as "the framework has to check the table",
 * arriving from a third direction — and unlike the other two it is detectable
 * from the finished document, with no instrumentation inside the solver.
 *
 * WHAT MAKES THE CLAIM SOUND. A truncated element that is doing its job has a
 * content width LARGER than its box: the box clamps, the content wants more,
 * and the ellipsis is the receipt. An element whose content width equals its
 * box width was never clamped at all. That is a contradiction between a
 * declaration and a measurement, which is the cheapest kind of defect to be
 * certain about — no origin, no ancestor walk, no colour space.
 *
 * WHY IT IS GATED ON AN UNSATISFIABLE CONTAINER. A truncated element that
 * happens to fit is not a defect; there was simply nothing to remove, and
 * saying so on every healthy page would be noise, which is how an oracle gets
 * muted. Gated this way the rule speaks only where the spend actually mattered:
 * the container came up short, so every strategy that returned nothing is part
 * of the reason.
 *
 * BOTH SELECTORS ARE MUTATOR-WRITTEN, so this is the third of the four
 * declaration-triggered rules that measure, and the most clearly right of them:
 * the finding is literally a comparison of two numbers, so there is no version
 * of this claim that survives without geometry. What the measuring constructor
 * adds is the admission for the case the injection harness seeded — an
 * exhausted container inside content skipped by `content-visibility: auto`,
 * where the whole gated pass used to evaporate without a word — and the escape
 * exemption N601 already promises for the fit family.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

/** Containers the solver gave up on. Nothing else can host this defect. */
const EXHAUSTED = '[data-fit="unsatisfiable"]';

/**
 * Elements the solver truncated. `data-truncate` is written by the mutator, so
 * its presence is evidence that a strategy WAS spent here rather than a guess
 * about intent.
 */
const TRUNCATED = '[data-truncate]';

export function spentForNothingRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N730', (lens, out) => {
    for (const container of lens.painted(EXHAUSTED).items) {
      for (const el of container.painted(TRUNCATED).items) {
        const box = el.box();
        // Half a pixel of slack: subpixel layout puts a genuinely clamped box a
        // fraction under its content, and calling that "bought nothing" would
        // be the false-failure direction.
        if (box.contentInline > box.inline + 0.5) continue;
        out.finding(
          el.subject,
          `truncation was applied and the element did not get smaller: content ${Math.round(box.contentInline)} in a box of ${Math.round(box.inline)}, inside a container that still reports unsatisfiable`,
        );
      }
    }
  });
}
