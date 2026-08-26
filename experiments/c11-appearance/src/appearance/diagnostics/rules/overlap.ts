/**
 * N670 — sibling boxes overlap.
 *
 * The visible half of F8: at width 320 two buttons painted on top of each other
 * while the row reported itself settled. Overlap is what a user SEES; a crush
 * (N660) is what causes it. Both are reported, because a reader who is told
 * "these two controls collide" does not have to infer it from a width.
 *
 * WHAT THIS RULE CAN SEE, precisely — the port is frozen and `Box` has no
 * origin, so there are no rectangles to intersect and no traversal to a
 * sibling. ONE inference is available, and it is exact:
 *
 *   Crushed non-final child. In a single-line row the next sibling's box begins
 *   where this one's box ends, so a child whose content exceeds its own box
 *   paints into the following sibling. `:last-child` is exempt: its overflow
 *   lands on the row's padding, not on a neighbour.
 *
 * A SECOND inference was implemented here and then REMOVED on evidence, which
 * is worth recording so nobody adds it back. It compared a row's own
 * `contentInline` (the sum of its children's boxes plus gaps) against its
 * `inline`. That test turns out to be anti-correlated with the thing this code
 * exists to catch:
 *   - when children refuse to shrink, as the post-F8 theme requires, they
 *     extend PAST the row and it fires — but nothing collides, the content
 *     escapes, and N620 or N660 already describe that with better numbers;
 *   - when children are crushed to fit, which is the actual collision, the row
 *     measures 318 against 318 and it stays SILENT. That is the recorded F8
 *     row, the exact case it was supposed to catch;
 *   - when some children shrink and the sum still exceeds, it fires with a
 *     vaguer duplicate of what the child pass below reports precisely.
 * The 240-cell matrix corroborated it: real box intersection in Chromium was
 * clean in every cell while this pass produced fourteen findings. A container
 * measurement cannot see a collision between its children; only the children
 * can.
 *
 * WHAT IT CANNOT SEE, and deliberately does not guess at:
 *   - overlap in `wrap`, `grid` and `stack` containers: the sibling that
 *     follows in the DOM may be on another line or another axis, and the port
 *     exposes no line box;
 *   - block-axis collisions, negative margins, transforms and z-stacked
 *     surfaces: all of those need an origin the port does not expose;
 *   - anything about an OUT-OF-FLOW child, which the sibling pass therefore
 *     skips outright: the overflow menu panel is `position: absolute` inside
 *     the row, so the flow premise above ("the next sibling's box begins where
 *     this one's ends") is simply false for it. A clipped panel is still a real
 *     defect and is still reported, as a crush (N660), which is the accurate
 *     description of it;
 *   - the row's `gap` when judging a child, since gap is a property of the
 *     parent and the port offers no way to reach it from the child. A crush
 *     smaller than the gap may therefore be reported as overlap; the box was
 *     violated either way, which is why the severity stands.
 * Real inline-axis intersection is asserted in the playwright proof, where
 * rectangles exist.
 *
 * THE GEOMETRY IS `box()`, NEVER `bounds()`, and this rule is where the reason
 * is written down for the family. The inference is a CONTAINMENT claim:
 * `contentInline` against `inline`, scrollWidth against clientWidth, both
 * padding-box measures, which is the only thing that makes the comparison
 * like-for-like. Swapping in the border box would give every child a free
 * border width of slack — the crush would have to exceed the border before this
 * rule spoke, so the loud false failures of a bad geometry become silent false
 * passes. That is the direction of error that gets a checker deleted, and it is
 * the same confusion that cost five of the first run's nine defects.
 */

import type { Rule } from '../../contracts.js';
import { isAdmittedFailure } from '../admitted.js';
import { rule } from '../rule.js';

export function overlapRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N670', (lens, out) => {
    const escaped = new Set(lens.declared('[data-escaped], [data-escaped] *').map((el) => el.node));

    const final = new Set(lens.declared('[data-layout="row"] > *:last-child').map((el) => el.node));
    // `painted()` owns the rendered precondition this loop used to restate by
    // hand: an unpainted child has no box to paint past anything (F4).
    for (const el of lens.painted('[data-layout="row"] > *')) {
      if (final.has(el.node) || escaped.has(el.node)) continue;
      // One root cause, one primary finding: a row that already reported N620
      // does not also get told it collides with its neighbour.
      if (isAdmittedFailure(el)) continue;
      // A declared truncation clips its own overflow; it lands on nobody. So
      // does a field, which scrolls its own value rather than painting it on
      // the neighbour (see the exemption note in crushed.ts).
      if (el.attr('data-truncate') !== null) continue;
      if (el.attr('data-appearance') === 'field') continue;
      const box = el.box();
      if (box.contentInline <= box.inline + 1) continue;
      // An out-of-flow child has no following sibling in the flow sense: the
      // overflow menu panel is absolutely positioned inside the row, so it
      // cannot displace anything. Its clipping is N660's finding, not this
      // rule's.
      const position = el.raw('position');
      if (position === 'absolute' || position === 'fixed') continue;
      out.finding(
        el.subject,
        `${Math.round(box.contentInline - box.inline)}px of content paints past this ${Math.round(box.inline)}px box into the following sibling in a single-line row`,
      );
    }
  });
}
