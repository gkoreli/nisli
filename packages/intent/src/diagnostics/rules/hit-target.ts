/**
 * N650 — hit target below the floor THIS CONTEXT declared for itself.
 *
 * The floor is not a constant in this file: it is `--intent-min-target`,
 * resolved from the context the element sits in, so a touch context raises it
 * and a pointer context may not declare one at all. A rule with a hardcoded 44
 * would be wrong in three of the four contexts this prototype ships.
 *
 * THE PRINCIPLE, because it generalises: a check must measure the box its claim
 * is about. A hit target is what a finger presses, so it is the BORDER box. A
 * crush is content against the box that contains it, so it is the PADDING box.
 * One geometry accessor cannot serve claims about different boxes, so there are
 * two: this rule asks `bounds()`, the crush rules ask `box()`, and the two are
 * different TYPES, so a call site can no longer take the wrong one by reflex.
 *
 * TWO ORACLE BUGS have been recorded here, and both belong in the file rather
 * than in a chat log, because each time the checker was wrong and the page was
 * fine.
 *
 * F4 — measuring what is not rendered. The first run produced TEN false
 * failures by measuring collapsed (`display: none`) candidates as 0×0, matching
 * the round-2 corpus finding "the oracle itself was wrong" three times over. An
 * unrendered node is not a small target; it is not a target. The precondition
 * used to be the first line of the loop, one edit away from being dropped again
 * — it is now the SEAM's: `painted()` is the only selector that yields a
 * measurable observation, so this rule cannot reach an unrendered node's
 * geometry even by accident.
 *
 * MEASURING THE WRONG BOX — 710 false failures, every one of them 1 or 2 short.
 * `Box` is backed by clientWidth/clientHeight, padding-box measures that exclude
 * borders, so comparing them against the floor demanded floor PLUS borders while
 * claiming to demand the floor. Controls measuring 45 and 44 on the border box
 * were reported as 43 and 42, and the entire "short by 1 versus short by 2"
 * split was two border widths.
 *
 * The first repair rebuilt the border box in this file — `box.inline` plus four
 * resolved border longhands, behind a local `edgeWidth` helper that existed
 * only to keep one unresolved longhand from poisoning the sum with a NaN.
 * `bounds()` owns that now, and reads `getBoundingClientRect()` rather than
 * re-deriving it. That is safer, not merely shorter: the arithmetic quietly
 * assumed no transform, so a `scale(0.8)` control reported the size it would
 * have had unscaled and passed a floor no finger could reach — a SILENT false
 * pass sitting inside the fix for a noisy false failure. It also depended on
 * four logical longhands resolving in every engine. The rect is the rectangle
 * the compositor actually paints, which is the thing the claim is about.
 *
 * The fix still does NOT live in `box()`, which must keep returning padding-box
 * values, because N660 and N670 compare scrollWidth against clientWidth, which
 * is like-for-like only while both are padding-box. A border-box `box()` would
 * hand every crush check a free border width of slack — including F8's own
 * 32-against-71 wrapper — trading 710 false failures for an unknown number of
 * false PASSES. In an oracle nobody is checking, the false pass is the worse
 * currency: three of the four oracle bugs this experiment produced were silent,
 * not noisy.
 *
 * The graduation-time cleanup recorded here — "a `borderBox` field on `Box` is
 * the cleaner long-term shape" — is DONE, but as a separate `Bounds` type
 * rather than as a field. A field would have been one property access away from
 * every caller already holding a `Box`, which is precisely the reflex that cost
 * 710 false failures here and then cost them again in N690, the rule written to
 * prevent this. A distinct type moves "which box is this claim about?" from
 * review-time vigilance to compile time, and it can also REFUSE the nonsense a
 * field would have had to carry: `Bounds` has no `contentInline`, because what
 * the content wanted is a containment question.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

export function hitTargetRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N650', (lens, out) => {
    for (const el of lens.painted('[data-appearance="action"], [data-appearance="nav-item"]')) {
      const floor = el.px('--intent-min-target');
      if (!(floor > 0)) continue; // no floor declared: this context makes no promise
      const pressable = el.bounds();
      // Half a pixel of slack: a floor derived from a fractional unit lands on
      // fractional values like 44.5, and rounding down is not a defect.
      const shortBlock = pressable.block + 0.5 < floor;
      const shortInline = pressable.inline + 0.5 < floor;
      if (!shortBlock && !shortInline) continue;
      // WHICH axis fails is the diagnosis, not a detail. One axis short while
      // the other is comfortable means the floor was expressed as a SIZE and
      // then defeated by the parent's cross-axis sizing; both axes short means
      // the control genuinely never reached the floor.
      const axis =
        shortBlock && shortInline ? 'both axes' : shortBlock ? 'block axis' : 'inline axis';
      const shortfall = Math.round(floor - Math.min(pressable.block, pressable.inline));
      const intact =
        shortBlock === shortInline
          ? ''
          : shortBlock
            ? `, inline ${Math.round(pressable.inline)} is fine`
            : `, block ${Math.round(pressable.block)} is fine`;
      out.finding(
        el.subject,
        `pressable area ${Math.round(pressable.inline)}×${Math.round(pressable.block)} (border box): ${axis} short of this context's ${floor} floor by ${shortfall}${intact}`,
      );
    }
  });
}
