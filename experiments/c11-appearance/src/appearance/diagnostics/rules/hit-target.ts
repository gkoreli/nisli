/**
 * N650 — hit target below the floor THIS CONTEXT declared for itself.
 *
 * The floor is not a constant in this file: it is `--min-target`, resolved from
 * the context the element sits in, so a touch context raises it and a pointer
 * context may not declare one at all. A rule with a hardcoded 44px would be
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
        // on values like 44.5px, and rounding down is not a defect.
        if (box.block + 0.5 >= floor && box.inline + 0.5 >= floor) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `hit target ${Math.round(box.inline)}×${Math.round(box.block)} below the ${floor}px floor this context declared`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
