/**
 * N610 — a declared value outside the vocabulary.
 *
 * This check is only possible because the vocabulary is CLOSED: every axis is
 * one enumerable list in `contracts.ts`, so "is this value legal" is a lookup
 * rather than an opinion. An open `className` channel makes this rule
 * unwritable, which is the whole argument for not having one.
 *
 * `declared`, never `painted`: an illegal value is illegal as written, with no
 * appeal to layout. Nothing here reads geometry, so there is no measurement to
 * guard — and a `painted()` selector would drop every `display: contents`
 * component host, which the DOM adapter reports as not rendered. Those hosts
 * are precisely where the vocabulary attributes are authored, so filtering them
 * out would turn this rule into a silent pass over most of the app.
 */

import type { Rule } from '../../contracts.js';
import { VOCABULARY } from '../../contracts.js';
import { rule } from '../rule.js';

/**
 * Markup spellings that differ from their vocabulary axis. `emphasis` is
 * authored as `data-role` — the axis name belongs to the vocabulary, the
 * attribute name belongs to the author — so both spellings are validated
 * against the same list and neither can slip through unchecked.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = { emphasis: ['data-role'] };

export function vocabularyRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N610', (lens, out) => {
    const axes = Object.entries(VOCABULARY) as [string, readonly string[]][];
    for (const [axis, legal] of axes) {
      for (const attribute of [`data-${axis}`, ...(ALIASES[axis] ?? [])]) {
        for (const el of lens.declared(`[${attribute}]`)) {
          const value = el.attr(attribute);
          if (value === null || legal.includes(value)) continue;
          out.finding(
            el.subject,
            `${attribute}="${value}" is not in the vocabulary (${legal.join(' | ')})`,
          );
        }
      }
    }
  });
}
