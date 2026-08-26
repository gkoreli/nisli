/**
 * N621 — a truncation that survived the box and lost the value.
 *
 * This is finding F5 turned into a check. At width 320 the prototype's timestamps
 * truncated to "1…", "Y…", "M": the engine did exactly what it was told and the
 * result was useless, because the author picked `truncate` for a short atomic
 * value. No framework gives that feedback today, and it is derivable — the
 * engine knows which nodes it truncated and how much text is left.
 *
 * The claim pairs TEXT with BOX and cannot be made from either alone: "1…" is
 * only a defect relative to the width it was clamped to, and a narrow box is
 * only a defect relative to how little text survived it. So both are read for
 * the same node and handed to `truncationDegenerate` together. The geometry is
 * `box()` — the padding box — because this is a containment claim about content
 * against the space it was given.
 */

import type { Rule } from '../../contracts.js';
import { truncationDegenerate } from '../../fit/strategies.js';
import { rule } from '../rule.js';

export function truncationRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N621', (lens, out) => {
    // Only nodes the solver actually truncated; a declared `data-collapse`
    // that never fired is not a defect. The `rendered` precondition this loop
    // used to restate by hand is now owned by `painted()`.
    for (const el of lens.painted('[data-truncate]')) {
      const text = el.text().trim();
      const box = el.box();
      if (!truncationDegenerate(box, text.length)) continue;
      out.finding(
        el.subject,
        `truncated to ${Math.round(box.inline)}px of the ${Math.round(box.contentInline)}px its ${text.length} characters need — what remains is not readable as a value`,
      );
    }
  });
}
