/**
 * N620 — a container promised to fit and could not.
 *
 * The solver records its own verdict on the container, so this rule reads a
 * decision rather than re-deriving it: the checker and the engine cannot
 * disagree about whether a fit was satisfiable. What the rule adds is the
 * numbers a reader needs — how much inline space the content still wants
 * against how much the container has — because "unsatisfiable" alone tells the
 * author nothing about how far off they are.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N620');

export function fitStateRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      for (const node of inspector.all('[data-fit]')) {
        if (inspector.attr(node, 'data-fit') !== 'unsatisfiable') continue;
        // F4: a collapsed container measures 0×0, and reporting "needs 0px in
        // 0px" is worse than saying nothing.
        if (!inspector.rendered(node)) continue;
        const box = inspector.box(node);
        const collapsed = inspector.attr(node, 'data-collapsed-count') ?? '0';
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `unsatisfiable: content needs ${Math.round(box.contentInline)}px of inline space in a ${Math.round(box.inline)}px container after ${collapsed} declared degradation(s)`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
