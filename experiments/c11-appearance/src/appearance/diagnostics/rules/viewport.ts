/**
 * N630 — the document is wider than the viewport.
 *
 * The one ABSOLUTE assertion in the set, and it earns its exception. Every
 * other rule is relational (this box against its content, this colour against
 * its backdrop), and the recorded corpus shows why relational alone is not
 * enough: a 704-wide page inside a 704-wide viewport passed every relative check
 * while scrolling sideways. Some geometry only means something against the
 * one number the author does not control.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N630');

export function viewportRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const { inline, documentInline } = inspector.viewport();
      // One pixel of slack: fractional layout rounds, and a half-pixel of
      // scrollWidth is not a sideways scrollbar.
      if (documentInline <= inline + 1) return [];
      return [
        {
          code: CODE.code,
          severity: CODE.severity,
          subject: 'document',
          detail: `document is ${Math.round(documentInline)}px wide in a ${Math.round(inline)}px viewport — ${Math.round(documentInline - inline)}px scrolls sideways`,
          hint: CODE.hint,
        },
      ];
    },
  };
}
