/**
 * N660 — element crushed: content wider than its box.
 *
 * THIS is the check that would have caught F8 automatically, and it did not
 * exist. The recorded measurement at width 320: the row reported
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
 * Three exemptions, all principled:
 *   - a node the solver truncated: clamping to one ellipsised line is a
 *     DECLARED loss, and its clipped content is not painting on anything;
 *   - a real scroll container (`overflow-x: auto | scroll | overlay`): content
 *     larger than the box is the point of a scroller;
 *   - `data-appearance="field"`: a text control scrolls its own value, so a
 *     value wider than the box is the field WORKING. This is the only
 *     role-keyed exemption in the set, and it is documented at its source in
 *     theme/roles.css; anything else would be a role buying itself an excuse.
 * Escaped subtrees are excluded because they forfeited the guarantee (N601).
 * A `contain: inline-size` truncator reports zero intrinsic width; that is not
 * an undecidable measurement (never N680), it is a node already exempt above.
 *
 * The exemption deliberately NOT here is the overflow menu panel, which is the
 * one a reader would add by analogy: the solver exempts it, because a clipped
 * popover must never make a row degrade its own content in response. This rule
 * does not, because the theme makes the panel structurally uncrushable instead
 * — out of flow, `max-inline-size` bounded, and its items reflow rather than
 * clip. Measured with the panel open in a 320-wide container: a long menu item
 * wraps to two lines and scrollWidth stays within clientWidth. An exemption
 * that only hides a defect the theme already prevents buys nothing and costs
 * the one finding that would tell us the theme stopped preventing it.
 */

import type { Finding, Inspector, Rule } from '../../contracts.js';
import { admittedFailures } from '../admitted.js';
import { codeEntry } from '../codes.js';

const CODE = codeEntry('N660');

/**
 * Computed `overflow-x` values that make an oversized content box legitimate.
 *
 * The polarity is deliberate and load-bearing: this ENUMERATES what is exempt
 * rather than testing `overflow-x !== 'visible'`. happy-dom does not expand the
 * `overflow` shorthand and does not default the longhand, so the computed value
 * is the empty string there — the negative spelling would silently exempt every
 * element and this rule would go vacuously quiet in unit tests while still
 * working in Chromium. An unknown value must fail safe INTO the check.
 *
 * `hidden` and `clip` are deliberately absent, though the theme does use them
 * (avatar, and a flush surface). The solver exempts them, because a clipped
 * table can never be relieved by degrading its enclosing row; this rule must
 * not, because clipped content is unreadable content. Same split as the
 * overflow panel above: the solver asks whether a container can settle, this
 * rule asks whether anything is unreadable.
 */
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
      // One root cause, one primary finding: a container that already reported
      // N620 does not report its own overflow a second time here. Its
      // descendants and ancestors are NOT exempt — see admitted.ts.
      const admitted = admittedFailures(inspector);
      for (const node of inspector.all('*')) {
        if (excluded.has(node)) continue;
        if (inspector.attr(node, 'data-truncate') !== null) continue;
        if (inspector.attr(node, 'data-appearance') === 'field') continue;
        if (!inspector.rendered(node)) continue;
        const box = inspector.box(node);
        if (box.contentInline <= box.inline + 1) continue;
        if (admitted.has(node)) continue;
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
