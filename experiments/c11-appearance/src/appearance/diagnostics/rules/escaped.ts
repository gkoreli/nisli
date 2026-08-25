/**
 * N601 — escaped subtree.
 *
 * The escape hatch exists so the vocabulary never has to be a prison. This rule
 * is not an accusation: it is the accounting entry that keeps an escape honest.
 * An escaped subtree styles itself, therefore no guarantee this checker makes
 * applies inside it, and that has to be said out loud once per escape.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N601');

export function escapedRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      for (const node of inspector.all('[data-escaped]')) {
        const reason = inspector.attr(node, 'data-escaped');
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `escaped appearance${reason ? `: ${reason}` : ''} — this subtree forfeits the rhythm, fit, contrast and hit-target guarantees`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
