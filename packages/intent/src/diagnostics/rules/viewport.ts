/**
 * N630 — the document is wider than the viewport.
 *
 * The one ABSOLUTE assertion in the set, and it earns its exception. Every
 * other rule is relational (this box against its content, this colour against
 * its backdrop), and the recorded corpus shows why relational alone is not
 * enough: a 704-wide page inside a 704-wide viewport passed every relative check
 * while scrolling sideways. Some geometry only means something against the
 * one number the author does not control.
 *
 * The only rule with no selector at all: its subject is the document, so it
 * reads `lens.viewport()` and never observes a node. There is nothing to filter
 * for paintedness because there is nothing selected — the two numbers are the
 * measurement.
 *
 * `measuringRule` all the same, and the reason is the point of the split rather
 * than a formality: the two numbers ARE a measurement, and `viewport()` lives on
 * the measuring lens so that the statement stays total — every geometry in this
 * package, including the document's own width, is reachable from one constructor
 * only. None of the three obligations has anything to bite on here, because
 * nothing was selected: there is no node to be skipped, unrendered, or escaped.
 * A document is not inside a subtree.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

export function viewportRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N630', (lens, out) => {
    const { inline, documentInline } = lens.viewport();
    // One pixel of slack: fractional layout rounds, and a half-pixel of
    // scrollWidth is not a sideways scrollbar.
    if (documentInline <= inline + 1) return;
    out.finding(
      'document',
      `document is ${Math.round(documentInline)}px wide in a ${Math.round(inline)}px viewport — ${Math.round(documentInline - inline)}px scrolls sideways`,
    );
  });
}
