/**
 * runner.ts — run the rule set over one inspector.
 *
 * Two decisions carry this file.
 *
 * A rule may NOT kill the run. Geometry is genuinely undecidable in places, and
 * a checker that dies halfway reports "no findings" for everything it never
 * reached — a false pass, which is the one failure mode that gets a checker
 * deleted. So every rule is isolated: a throw becomes an N680 `incomplete`
 * naming the rule and the message, and the remaining rules still run.
 *
 * Three-valued severity is the point, not a hedge. `fail` means the geometry is
 * wrong, `warn` means it is legal but the author probably meant something else,
 * `incomplete` means nobody knows and a human has to look. Collapsing that to a
 * boolean is how axe-core's own geometric checks would have become useless.
 */

import type { Finding, Inspector, Rule } from '../contracts.js';
import { codeEntry, DOCS_BASE } from './codes.js';
import {
  contrastRule,
  crushedRule,
  escapedRule,
  fitStateRule,
  hitTargetRule,
  overlapRule,
  truncationRule,
  viewportRule,
  vocabularyRule,
} from './rules/index.js';

const UNDECIDABLE = codeEntry('N680');

/** Every shipped rule, in code order. Fresh instances per call: rules are values. */
export function DEFAULT_RULES<TNode>(): readonly Rule<TNode>[] {
  return [
    escapedRule<TNode>(),
    vocabularyRule<TNode>(),
    fitStateRule<TNode>(),
    truncationRule<TNode>(),
    viewportRule<TNode>(),
    contrastRule<TNode>(),
    hitTargetRule<TNode>(),
    crushedRule<TNode>(),
    overlapRule<TNode>(),
  ];
}

export function check<T>(
  inspector: Inspector<T>,
  rules: readonly Rule<T>[] = DEFAULT_RULES<T>(),
): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    try {
      for (const finding of rule.run(inspector)) {
        // The docs anchor is derived from the code, so no rule can emit a
        // finding the reader cannot look up.
        findings.push(
          finding.docs
            ? finding
            : { ...finding, docs: `${DOCS_BASE}${finding.code.toLowerCase()}` },
        );
      }
    } catch (error) {
      findings.push({
        code: UNDECIDABLE.code,
        severity: UNDECIDABLE.severity,
        subject: `${rule.code} ${rule.title}`,
        detail: `rule threw: ${error instanceof Error ? error.message : String(error)}`,
        hint: UNDECIDABLE.hint,
        docs: `${DOCS_BASE}n680`,
      });
    }
  }
  return findings;
}
