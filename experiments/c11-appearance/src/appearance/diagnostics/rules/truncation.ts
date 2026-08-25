/**
 * N621 — a truncation that survived the box and lost the value.
 *
 * This is finding F5 turned into a check. At width 320 the prototype's timestamps
 * truncated to "1…", "Y…", "M": the engine did exactly what it was told and the
 * result was useless, because the author picked `truncate` for a short atomic
 * value. No framework gives that feedback today, and it is derivable — the
 * engine knows which nodes it truncated and how much text is left.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { truncationDegenerate } from '../../fit/strategies.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N621');

export function truncationRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      // Only nodes the solver actually truncated; a declared `data-collapse`
      // that never fired is not a defect.
      for (const node of inspector.all('[data-truncate]')) {
        if (!inspector.rendered(node)) continue;
        const text = inspector.text(node).trim();
        const box = inspector.box(node);
        if (!truncationDegenerate(box, text.length)) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `truncated to ${Math.round(box.inline)}px of the ${Math.round(box.contentInline)}px its ${text.length} characters need — what remains is not readable as a value`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
