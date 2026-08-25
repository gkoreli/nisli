/**
 * N610 — a declared value outside the vocabulary.
 *
 * This check is only possible because the vocabulary is CLOSED: every axis is
 * one enumerable list in `contracts.ts`, so "is this value legal" is a lookup
 * rather than an opinion. An open `className` channel makes this rule
 * unwritable, which is the whole argument for not having one.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { VOCABULARY } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N610');

/**
 * Markup spellings that differ from their vocabulary axis. `emphasis` is
 * authored as `data-role` — the axis name belongs to the vocabulary, the
 * attribute name belongs to the author — so both spellings are validated
 * against the same list and neither can slip through unchecked.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = { emphasis: ['data-role'] };

export function vocabularyRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      const axes = Object.entries(VOCABULARY) as [string, readonly string[]][];
      for (const [axis, legal] of axes) {
        for (const attribute of [`data-${axis}`, ...(ALIASES[axis] ?? [])]) {
          for (const node of inspector.all(`[${attribute}]`)) {
            const value = inspector.attr(node, attribute);
            if (value === null || legal.includes(value)) continue;
            findings.push({
              code: CODE.code,
              severity: CODE.severity,
              subject: inspector.describe(node),
              detail: `${attribute}="${value}" is not in the vocabulary (${legal.join(' | ')})`,
              hint: CODE.hint,
            });
          }
        }
      }
      return findings;
    },
  };
}
