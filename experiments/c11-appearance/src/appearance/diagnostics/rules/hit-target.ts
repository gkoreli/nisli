/**
 * N650 — hit target below the floor THIS CONTEXT declared for itself.
 *
 * The floor is not a constant in this file: it is `--min-target`, resolved from
 * the context the element sits in, so a touch context raises it and a pointer
 * context may not declare one at all. A rule with a hardcoded 44 would be wrong
 * in three of the four contexts this prototype ships.
 *
 * THE PRINCIPLE, because it generalises: a check must measure the box its claim
 * is about. A hit target is what a finger presses, so it is the BORDER box. A
 * crush is content against the box that contains it, so it is the PADDING box.
 * One geometry accessor cannot serve claims about different boxes, and the
 * frozen `Box` is a content/padding geometry by construction — so a rule
 * asserting something about pressability, outline or visual bounds derives what
 * it needs through `style()` instead of pretending `Box` answers it.
 *
 * TWO ORACLE BUGS have been recorded here, and both belong in the file rather
 * than in a chat log, because each time the checker was wrong and the page was
 * fine.
 *
 * F4 — measuring what is not rendered. The first run produced TEN false
 * failures by measuring collapsed (`display: none`) candidates as 0×0, matching
 * the round-2 corpus finding "the oracle itself was wrong" three times over. So
 * rendered-ness is asserted FIRST, before the floor is read and before anything
 * is measured. An unrendered node is not a small target; it is not a target.
 *
 * MEASURING THE WRONG BOX — 710 false failures, every one of them 1 or 2 short.
 * `Box` is backed by clientWidth/clientHeight, padding-box measures that exclude
 * borders, so comparing them against the floor demanded floor PLUS borders while
 * claiming to demand the floor. Controls measuring 45 and 44 on the border box
 * were reported as 43 and 42, and the entire "short by 1 versus short by 2"
 * split was two border widths. The fix lives here and NOT in the adapter:
 * `box()` must keep returning padding-box values, because N660 and N670 compare
 * scrollWidth against clientWidth, which is like-for-like only while both are
 * padding-box. A border-box `box()` would hand every crush check a free border
 * width of slack — including F8's own 32-against-71 wrapper — trading 710 false
 * failures for an unknown number of false PASSES. In an oracle nobody is
 * checking, the false pass is the worse currency: three of the four oracle bugs
 * this experiment produced were silent, not noisy.
 *
 * A `borderBox` field on `Box` is the cleaner long-term shape and is recorded as
 * a graduation-time cleanup; contracts.ts stays frozen mid-flight for a
 * rule-local problem that `style()` already solves.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N650');

/**
 * One resolved edge width in px. Four call sites need identical NaN handling: an
 * engine that does not resolve a logical border longhand returns the empty
 * string, and a single NaN would poison the sum and silence the rule entirely.
 */
function edgeWidth<TNode>(inspector: Inspector<TNode>, node: TNode, property: string): number {
  return Number.parseFloat(inspector.style(node, property)) || 0;
}

export function hitTargetRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      for (const node of inspector.all('[data-appearance="action"], [data-appearance="nav-item"]')) {
        if (!inspector.rendered(node)) continue;
        const floor = Number.parseFloat(inspector.style(node, '--min-target'));
        if (!(floor > 0)) continue; // no floor declared: this context makes no promise
        const box = inspector.box(node);
        const pressableInline =
          box.inline +
          edgeWidth(inspector, node, 'border-inline-start-width') +
          edgeWidth(inspector, node, 'border-inline-end-width');
        const pressableBlock =
          box.block +
          edgeWidth(inspector, node, 'border-block-start-width') +
          edgeWidth(inspector, node, 'border-block-end-width');
        // Half a pixel of slack: a floor derived from a fractional unit lands on
        // fractional values like 44.5, and rounding down is not a defect.
        const shortBlock = pressableBlock + 0.5 < floor;
        const shortInline = pressableInline + 0.5 < floor;
        if (!shortBlock && !shortInline) continue;
        // WHICH axis fails is the diagnosis, not a detail. One axis short while
        // the other is comfortable means the floor was expressed as a SIZE and
        // then defeated by the parent's cross-axis sizing; both axes short means
        // the control genuinely never reached the floor.
        const axis =
          shortBlock && shortInline ? 'both axes' : shortBlock ? 'block axis' : 'inline axis';
        const shortfall = Math.round(floor - Math.min(pressableBlock, pressableInline));
        const intact =
          shortBlock === shortInline
            ? ''
            : shortBlock
              ? `, inline ${Math.round(pressableInline)} is fine`
              : `, block ${Math.round(pressableBlock)} is fine`;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `pressable area ${Math.round(pressableInline)}×${Math.round(pressableBlock)} (border box): ${axis} short of this context's ${floor} floor by ${shortfall}${intact}`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
