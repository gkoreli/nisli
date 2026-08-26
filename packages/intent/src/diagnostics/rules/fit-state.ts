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
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

export function fitStateRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N620', (lens, out) => {
    for (const el of lens.painted('[data-fit]')) {
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
