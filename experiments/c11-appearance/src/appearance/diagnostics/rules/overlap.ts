/**
 * N670 — sibling boxes overlap.
 *
 * The visible half of F8: at 320px two buttons painted on top of each other
 * while the row reported itself settled. Overlap is what a user SEES; a crush
 * (N660) is what causes it. Both are reported, because a reader who is told
 * "these two controls collide" does not have to infer it from a width.
 *
 * WHAT THIS RULE CAN SEE, precisely — the port is frozen and `Box` has no
 * origin, so there are no rectangles to intersect and no traversal to a
 * sibling. Two inferences are available, and both are exact:
 *
 *   1. Row sum. A single-line row's own `contentInline` IS the sum of its
 *      children's boxes plus the gaps between them. When that exceeds the row's
 *      `inline`, the children's boxes cannot all be laid out inside the row:
 *      whatever the browser does next (crush them, or push them out), painted
 *      content collides or escapes.
 *   2. Crushed non-final child. In a single-line row the next sibling's box
 *      begins where this one's box ends, so a child whose content exceeds its
 *      own box paints into the following sibling. `:last-child` is exempt:
 *      its overflow lands on the row's padding, not on a neighbour.
 *
 * WHAT IT CANNOT SEE, and deliberately does not guess at:
 *   - overlap in `wrap`, `grid` and `stack` containers: the sibling that
 *     follows in the DOM may be on another line or another axis, and the port
 *     exposes no line box;
 *   - block-axis collisions, negative margins, absolute positioning,
 *     transforms and z-stacked surfaces: all of those need an origin;
 *   - the row's `gap` when judging a child, since gap is a property of the
 *     parent and the port offers no way to reach it from the child. A crush
 *     smaller than the gap may therefore be reported as overlap; the box was
 *     violated either way, which is why the severity stands.
 * Real inline-axis intersection is asserted in the playwright proof, where
 * rectangles exist.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N670');

export function overlapRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      const escaped = new Set<TNode>(inspector.all('[data-escaped], [data-escaped] *'));

      for (const container of inspector.all('[data-layout="row"]')) {
        if (escaped.has(container) || !inspector.rendered(container)) continue;
        const box = inspector.box(container);
        if (box.contentInline <= box.inline + 1) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(container),
          detail: `children need ${Math.round(box.contentInline)}px of inline space (boxes plus gaps) in a ${Math.round(box.inline)}px row — the boxes cannot all fit, so their content collides`,
          hint: CODE.hint,
        });
      }

      const final = new Set<TNode>(inspector.all('[data-layout="row"] > *:last-child'));
      for (const child of inspector.all('[data-layout="row"] > *')) {
        if (final.has(child) || escaped.has(child)) continue;
        // A declared truncation clips its own overflow; it lands on nobody.
        if (inspector.attr(child, 'data-truncate') !== null) continue;
        if (!inspector.rendered(child)) continue;
        const box = inspector.box(child);
        if (box.contentInline <= box.inline + 1) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(child),
          detail: `${Math.round(box.contentInline - box.inline)}px of content paints past this ${Math.round(box.inline)}px box into the following sibling in a single-line row`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
