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
 * DERIVATION, through the frozen port with no new members: n words cannot
 * occupy more than n lines unless a word was broken inside itself. So
 * `lines > words` witnesses an intra-word break, where lines is the rendered
 * block size over the computed line height.
 *
 * LIMITS, both load-bearing:
 *  - It assumes WORD-SPACED SCRIPT. Han, Hiragana, Katakana, Hangul and Thai
 *    wrap between characters by design, so a legitimate paragraph reports one
 *    word and many lines. The inference does not hold there, so the rule
 *    declines rather than guessing — silence, not a false accusation.
 *  - `line-height: normal` is not a length, so the line count is undecidable.
 *    That is reported as N680 `incomplete` rather than skipped, because "I could
 *    not tell" and "there is nothing wrong" are different answers and this rule
 *    exists precisely because they were being conflated. `out.undecidable()` in
 *    rule.ts is where that admission now lives; it stamps this rule's code into
 *    the message, so the message no longer names N690 itself.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

/** Scripts that wrap between characters, where `lines > words` proves nothing. */
const UNSPACED_SCRIPT =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

export function shreddedRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N690', (lens, out) => {
    for (const el of lens.painted('[data-text]')) {
      const text = el.text().trim();
      if (text.length === 0) continue;
      if (UNSPACED_SCRIPT.test(text)) continue;

      // `raw()`, not `px()`: this is the one read where "zero" and
      // "unresolvable" must stay distinguishable, because `normal` is the whole
      // reason the undecidable arm below exists.
      const lineHeight = Number.parseFloat(el.raw('line-height'));
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        out.undecidable(
          el.subject,
          'line-height is not a length, so the rendered line count cannot be derived here',
        );
        continue;
      }

      // `box.block` is a padding-box measure (clientHeight), so dividing it
      // by the line height counts a padded element's padding as extra lines.
      // That is what this rule did on its first run: every table header
      // reported "1 word across 2 lines" because a two-line-tall padding box
      // holds one line of text. It is the same mistake N650 made with
      // borders, in the rule written to close N660's ambiguity — the fifth
      // oracle bug this experiment produced, and the reason the principle is
      // stated as a rule rather than a war story: A CHECK MUST MEASURE THE
      // BOX ITS CLAIM IS ABOUT. The claim here is about rendered text, so the
      // padding comes off before the lines are counted.
      const box = el.box();
      const paddingBlock = el.px('padding-block-start') + el.px('padding-block-end');
      const textBlock = box.block - paddingBlock;
      if (textBlock < lineHeight) continue;

      const lines = Math.round(textBlock / lineHeight);
      const words = text.split(/\s+/).length;
      if (lines <= words) continue;

      out.finding(
        el.subject,
        `${words} word(s) rendered across ${lines} lines in ${Math.round(textBlock)}px of text height, so a word was broken inside itself to fit a ${Math.round(box.inline)}px box`,
      );
    }
  });
}
