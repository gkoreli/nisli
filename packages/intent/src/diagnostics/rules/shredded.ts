/**
 * N690 — a word broken across lines to satisfy a box that could not hold it.
 *
 * The blind spot this closes was found the hard way. When the grid track
 * contradiction (F9) appeared, the crush check (N660) went silent under BOTH
 * candidate fixes: flooring the track so the box became honest, and letting the
 * text reflow so the content was shredded to fit an impossible box. An agent
 * needed a manual `gridTemplateColumns` probe to tell the two apart, and the
 * sentence that named the problem was: "a green crush column is consistent with
 * both a fixed page and a shredded one."
 *
 * A checker whose silence has two meanings trains people to mute it. So the
 * second meaning gets its own code. N621 already covers the solver's half of
 * this family — a degradation that fits the box and destroys the value; this is
 * the theme's half, where `overflow-wrap` pays for an impossible bound in the
 * reader's prose.
 *
 * THE INFERENCE, and it is exact: n words cannot
 * occupy more than n lines unless a word was broken inside itself. So
 * `lines > words` witnesses an intra-word break, where lines is the number of
 * LINE BOXES the browser produced for this node's own text — `Inspector.lines()`.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * IT USED TO DERIVE THAT COUNT FROM AN ELEMENT BOX, AND THAT WAS THE BUG.
 * ══════════════════════════════════════════════════════════════════════════
 * The derivation was `(box.block - padding-block) / line-height`, and it is the
 * defect this rule's own header spent three paragraphs recording in other
 * rules: A CHECK MUST MEASURE THE BOX ITS CLAIM IS ABOUT. The claim is about
 * TEXT. `Box` is an element geometry. Every term of the derivation failed
 * somewhere, and the accessor sweep measured all three:
 *
 *  - THE PADDING SUBTRACTION WAS READ WITH `px()`, which coerces an unresolved
 *    longhand to zero. happy-dom resolves `padding-block-start` to the EMPTY
 *    STRING, so in this package's own unit environment a padded single-line
 *    heading measured as two lines and reported a shredded word that does not
 *    exist. The bug was LIVE, not doctrinal: it is this rule's recorded
 *    first-run defect — every table header reporting "1 word across 2 lines" —
 *    reopened through the coercion, in the very arithmetic added to close it.
 *  - PADDING IS NOT THE ONLY REASON A BOX IS TALLER THAN ITS TEXT. A stretched
 *    row child, a `min-block-size`, an inline-block sharing a taller line box:
 *    none of those are padding and no padding read subtracts them. The sharpest
 *    case is already in this file below — a control's box is a hit TARGET whose
 *    slack is the floor doing its job, which is why widening this rule to
 *    control labels fired on a clean icon button.
 *  - THE DIVISOR NEEDED `line-height` TO BE A LENGTH, so `normal` cost a
 *    verdict that was in fact available and produced N680 instead. That arm is
 *    gone with the divisor, and the fixture that asserted it now asserts the
 *    verdict: an admission that was an artefact of the arithmetic was never an
 *    honest admission.
 *
 * `lines()` has no divisor, no padding term and no element geometry in it, so
 * there is nothing left to get wrong. contracts.ts states the relationship
 * directly: the derivation was APPROXIMATING this count, and where the two
 * differ the derivation is the one that is wrong. It also predicted exactly
 * this cleanup — "N690's arithmetic, its padding subtraction and its
 * undecidable arm all become deletable the day that rule is moved onto this
 * member" — and deferred it for a falsification, which the fixtures in
 * `shredded.test.ts` now supply.
 *
 * LIMITS, all three load-bearing:
 *  - It assumes WORD-SPACED SCRIPT. Han, Hiragana, Katakana, Hangul and Thai
 *    wrap between characters by design, so a legitimate paragraph reports one
 *    word and many lines. The inference does not hold there, so the rule
 *    declines rather than guessing — silence, not a false accusation.
 *  - `lines()` counts this node's OWN text runs while `text()` returns the
 *    whole subtree's text, so a `[data-text]` node whose words live inside a
 *    nested element reports zero lines against a positive word count and is not
 *    measured. That is an honest zero rather than an unresolvable one — the
 *    distinction `raw()` exists for, applied to a count — so it is a `continue`
 *    and not an admission. It under-reports and never invents a defect, which
 *    is the same bounded residue N710 accepts on a border width and N713 on a
 *    column gap. The old derivation did not cover that case correctly either;
 *    it measured the wrapper's box against the subtree's words.
 *  - Nothing here decides WHY the text took that many lines, and the two-line
 *    heading somebody wanted looks identical to the word that was broken. The
 *    word count is what discriminates them, and it is the only reason this
 *    inference is available without a declaration.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

/** Scripts that wrap between characters, where `lines > words` proves nothing. */
const UNSPACED_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

/**
 * A REAL HOLE, AND A REVERTED FIX. Recorded together because the attempt is
 * more instructive than the hole.
 *
 * The hole: a control's LABEL is not `[data-text]`. A menu item is
 * `[data-appearance="action"]`, a navigation entry is `nav-item`. So no rule in
 * this set measures line breaking on any label in the system, open or closed,
 * and the overlays audit measured the defect that hides there — because
 * `position-try-fallbacks` is an overflow test, a shrink-to-fit popover never
 * triggers a fallback and wraps its labels instead ("Reply all" and "Archive"
 * each broken across two line boxes, in a panel the browser considered fitted).
 * F8's shape reappearing inside the platform's own solver.
 *
 * The fix that does not work: widening this selector to include controls. It
 * fired on a CLEAN 44-pixel icon button — one word, one line of text, a box
 * 44 tall, so `box.block / lineHeight` rounded to two lines and the rule
 * reported a shredded word that does not exist. Caught immediately by the
 * silent-on-clean fixture, which is the seventh oracle bug this experiment has
 * produced and the second in this exact family: **a control's box is a hit
 * TARGET, not a text box.** The slack is the target floor doing its job. It is
 * N650's mistake wearing different clothes, and the fact that it was written by
 * the author of the rule that records N650's mistake is the argument for
 * keeping these paragraphs.
 *
 * WHAT CLOSING IT NEEDED HAS SINCE SHIPPED, AND THE HOLE IS STILL OPEN. This
 * paragraph used to say the fix required "the number of line boxes the TEXT
 * occupies, which is `Range.getClientRects().length` or an equivalent — a
 * text-box measurement the port does not expose". The port exposes it now:
 * `Inspector.lines()`, which this rule reads. So the precondition is met, and
 * the reason the widening failed is gone with the divisor — that same clean
 * icon button reports ONE line box against one word and is silent.
 *
 * IT IS STILL NOT DONE HERE, and the reason is a rule about rules rather than
 * about typography. Widening the selector is a NEW CLAIM over a shape nobody
 * has measured with this accessor, and a rule that fires on an unmeasured shape
 * is how an oracle gets muted — the argument N740's header makes for its own
 * narrower scope. The accessor sweep that migrated this rule reports the
 * widening as unblocked, with the evidence, and does not ship it: three correct
 * measurements in this experiment have already produced three wrong
 * explanations, so a confident rewrite on a plausible causal story is its own
 * defect class. Until it is measured, the proof asserts label wrapping
 * directly, where rectangles exist.
 *
 * TWO VERDICTS MOVE with the measuring constructor, both in the direction this
 * rule already argued for elsewhere. A word broken inside itself in content
 * skipped by `content-visibility: auto` was a silent pass — the injection
 * harness seeded it and this rule reported a clean page — and is now N680. A
 * word broken inside an escaped subtree is no longer reported, because rhythm
 * is the first guarantee N601 says an escape forfeits, and a rule that judged
 * typography the author explicitly took back was contradicting the registry
 * entry beside it.
 */
export function shreddedRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N690', (lens, out) => {
    for (const el of lens.painted('[data-text]').items) {
      const text = el.text().trim();
      if (text.length === 0) continue;
      if (UNSPACED_SCRIPT.test(text)) continue;

      // `lines()`, and nothing else. The claim is about TEXT, so it is measured
      // on text: the line boxes the browser actually produced for this node's
      // own runs. What this replaces was an element geometry — a padding box
      // minus two resolved padding longhands, divided by a computed line
      // height — and the header records what each of those three terms cost.
      const lines = el.lines();
      const words = text.split(/\s+/).length;
      if (lines <= words) continue;

      out.finding(
        el.subject,
        `${words} word(s) rendered across ${lines} line boxes, so a word was broken inside itself to fit a ${Math.round(el.box().inline)}px box`,
      );
    }
  });
}
