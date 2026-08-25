/**
 * N650 — hit target below the floor THIS CONTEXT declared for itself.
 *
 * The floor is not a constant in this file: it is `--min-target`, resolved from
 * the context the element sits in, so a touch context raises it and a pointer
 * context may not declare one at all. A rule with a hardcoded 44 would be
 * wrong in three of the four contexts this prototype ships.
 *
 * F4 lives here. The first run produced TEN false failures by measuring
 * collapsed (`display: none`) candidates as 0×0, which matches the round-2
 * corpus finding "the oracle itself was wrong" three times over. So
 * rendered-ness is asserted FIRST — before the floor is read, before the box is
 * measured. An unrendered node is not a small target; it is not a target.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N650');

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
        // Half a pixel of slack: a floor derived from a fractional unit lands
        // on fractional values like 44.5, and rounding down is not a defect.
        const shortBlock = box.block + 0.5 < floor;
        const shortInline = box.inline + 0.5 < floor;
        if (!shortBlock && !shortInline) continue;
        // WHICH axis fails is the diagnosis, not a detail. One axis short while
        // the other is comfortable means the floor was expressed as a SIZE and
        // then defeated by the parent's cross-axis sizing; both axes short means
        // the control genuinely never reached the floor. A corpus of 718 of
        // these findings had to be measured by hand before that distinction was
        // visible, so the finding now carries it.
        const axis = shortBlock && shortInline ? 'both axes' : shortBlock ? 'block axis' : 'inline axis';
        const shortfall = Math.round(floor - Math.min(box.block, box.inline));
        const intact = shortBlock === shortInline ? '' : shortBlock ? `, inline ${Math.round(box.inline)} is fine` : `, block ${Math.round(box.block)} is fine`;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `hit target ${Math.round(box.inline)}×${Math.round(box.block)}: ${axis} short of this context's ${floor} floor by ${shortfall}${intact}`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
