/**
 * N601 — escaped subtree.
 *
 * The escape hatch exists so the vocabulary never has to be a prison. This rule
 * is not an accusation: it is the accounting entry that keeps an escape honest.
 * An escaped subtree styles itself, therefore no guarantee this checker makes
 * applies inside it, and that has to be said out loud once per escape.
 *
 * `declared`, never `painted`: an escape is a fact about what the author WROTE,
 * and it is true whether or not the subtree is on screen. It also HAS to be
 * `declared`, because the DOM adapter answers `rendered() === false` for every
 * `display: contents` component host — selecting through `painted()` here would
 * silently stop counting the escapes on exactly the nodes most likely to hold
 * one, which is the false-PASS shape this experiment exists to prevent.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

export function escapedRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N601', (lens, out) => {
    for (const el of lens.declared('[data-escaped]')) {
      const reason = el.attr('data-escaped');
      out.finding(
        el.subject,
        `escaped appearance${reason ? `: ${reason}` : ''} — this subtree forfeits the rhythm, fit, contrast and hit-target guarantees`,
      );
    }
  });
}
