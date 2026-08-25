/**
 * N660 — element crushed: content wider than its box.
 *
 * THIS is the check that would have caught F8 automatically, and it did not
 * exist. The recorded measurement at 320px: the row reported
 * `scrollWidth 318 === clientWidth 318`, so the container-only overflow
 * predicate said `settled` — while inside it a Reply wrapper had
 * `clientWidth 32` against `scrollWidth 71` and painted straight over its
 * neighbour. Buttons visibly overlapped in a UI the checker called clean.
 *
 * The lesson is that a container's own overflow is the wrong question. Flex
 * children default to `flex-shrink: 1`, so the browser will always "satisfy" an
 * overflowing row by crushing children below their content width; the overflow
 * disappears from the container and reappears as paint outside the children.
 * The right question is per element: did this box get the inline space its
 * content needs?
 *
 * Two exemptions, both principled:
 *   - a node the solver truncated: clamping to one ellipsised line is a
 *     DECLARED loss, and its clipped content is not painting on anything;
 *   - a real scroll container (`overflow-x: auto | scroll | overlay`): content
 *     larger than the box is the point of a scroller.
 * Escaped subtrees are excluded because they forfeited the guarantee (N601).
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N660');

/** Computed `overflow-x` values that make an oversized content box legitimate. */
const SCROLLABLE: Readonly<Record<string, true>> = { auto: true, scroll: true, overlay: true };

export function crushedRule<TNode>(): Rule<TNode> {
  return {
    code: CODE.code,
    title: CODE.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      // Ancestry is not on the port, so subtree exclusion is expressed as a
      // second query and an identity set.
      const excluded = new Set<TNode>(
        inspector.all(
          'html, head, body, script, style, template, meta, link, title, [data-escaped], [data-escaped] *',
        ),
      );
      for (const node of inspector.all('*')) {
        if (excluded.has(node)) continue;
        if (inspector.attr(node, 'data-truncate') !== null) continue;
        if (!inspector.rendered(node)) continue;
        const box = inspector.box(node);
        if (box.contentInline <= box.inline + 1) continue;
        if (SCROLLABLE[inspector.style(node, 'overflow-x')]) continue;
        findings.push({
          code: CODE.code,
          severity: CODE.severity,
          subject: inspector.describe(node),
          detail: `crushed: content needs ${Math.round(box.contentInline)}px but the box got ${Math.round(box.inline)}px — ${Math.round(box.contentInline - box.inline)}px paints outside it`,
          hint: CODE.hint,
        });
      }
      return findings;
    },
  };
}
