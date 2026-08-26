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
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE THIRD ORACLE BUG IN THIS FILE, AND THE ONLY ONE THAT WAS SILENT.
 * ══════════════════════════════════════════════════════════════════════════
 * Found by the accessor sweep rather than by a failure, which is the point: the
 * two above were noisy and this one could not be. The floor was read with
 * `px()`, and `px()` coerces an unresolvable property to zero. The next line
 * was `if (!(floor > 0)) continue`. So a floor that did not resolve — for ANY
 * reason — made this rule skip every control it selected and report a clean
 * page FOREVER. No error, no finding, nothing to notice, and no fixture that
 * could notice either, because silence is what a healthy document looks like.
 *
 * `namespace.test.ts` records this hazard in prose and guards it by asserting
 * that `--intent-min-target` is declared somewhere in `theme/`. That is a fact
 * about THIS REPOSITORY and it says nothing about a consumer's document: a page
 * carrying intent markup with no resolution table included resolves the token
 * to the empty string on every node, and this rule went quiet across all of it.
 * That is precisely the fourth case N640 enumerates and REFUSES — "no floor
 * declared, so the theme that owns the threshold is not loaded" — and N650 was
 * the rule beside it that did not refuse. A fix applied to one rule and not to
 * the rule next to it is this project's own recorded defect class, and this is
 * the third instance of it.
 *
 * THE FIX IS `raw()` AND A THREE-WAY SPLIT, not "treat zero as undecidable",
 * because a declared zero is a real and different answer. The table declares
 * this floor twice: zero in the pointer context, a length in the touch context.
 * An explicit zero is a context saying it makes no promise about target size,
 * which must stay silent. An empty string is nobody having declared anything.
 * `px()` maps both onto the same number and `raw()` is the accessor that keeps
 * them apart — which is the entire content of `raw()`'s doc comment, applied.
 *
 * AND THE FLOOR IS NOT NECESSARILY A LENGTH, which is why the parse is checked
 * rather than trusted. An unregistered custom property computes to its
 * SUBSTITUTED TOKEN STREAM, not to a resolved length, so a floor derived from
 * the inherited unit the way every other value in this table is derived
 * computes to `calc(…)` and no parse of it is a number. The shipped table
 * declares this one token as a plain length, which is the only reason the
 * deployed rule ever worked. Under `px()` that near-miss was a silent pass;
 * here it is N680.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

export function hitTargetRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N650', (lens, out) => {
    for (const el of lens.painted('[data-appearance="action"], [data-appearance="nav-item"]')) {
      // `raw()`, never `px()`: the whole argument is in the header, and the
      // short version is that `px()` turns "nobody declared a floor" into the
      // number zero, every rectangle clears zero, and this rule then reports a
      // clean page forever.
      const declared = el.raw('--intent-min-target');
      const floor = Number.parseFloat(declared);
      if (!Number.isFinite(floor)) {
        out.undecidable(
          el.subject,
          `--intent-min-target resolves to ${declared || '<empty>'}, so this context declares no readable target floor and no verdict about this control is supportable`,
        );
        continue;
      }
      // A DECLARED zero is a context refusing to promise, which is a real
      // answer and stays silent. This is the line `px()` could not express.
      if (floor <= 0) continue;
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
