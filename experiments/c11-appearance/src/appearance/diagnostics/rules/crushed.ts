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
 *   - a real scroll container (`overflow-x: auto | scroll`): content
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
 *
 * `box()` — the padding box — is the only geometry this rule may use:
 * `contentInline > inline` is a like-for-like comparison exactly because both
 * are padding-box measures. A border-box geometry would hand every element a
 * free border width of slack and turn this check's loud failures into silent
 * passes, which is the failure direction that gets an oracle deleted.
 */

import type { Rule } from '../../contracts.js';
import { isAdmittedFailure } from '../admitted.js';
import { rule } from '../rule.js';

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
// `overlay` is absent by measurement, not oversight: css-overflow-3 computes it
// to `auto`, so it never appears as a computed value and a branch for it reads
// as coverage while being unreachable.
const SCROLLABLE: Readonly<Record<string, true>> = { auto: true, scroll: true };

export function crushedRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N660', (lens, out) => {
    // Ancestry is not on the port, so subtree exclusion is expressed as a
    // second query and an identity set.
    const excluded = new Set(
      lens
        .declared(
          'html, head, body, script, style, template, meta, link, title, [data-escaped], [data-escaped] *',
        )
        .map((el) => el.node),
    );
    // `painted()` owns the rendered precondition this loop used to restate by
    // hand — measuring an unpainted node is how an oracle invents defects (F4).
    for (const el of lens.painted('*')) {
      if (excluded.has(el.node)) continue;
      if (el.attr('data-truncate') !== null) continue;
      if (el.attr('data-appearance') === 'field') continue;
      const box = el.box();
      if (box.contentInline <= box.inline + 1) continue;
      // One root cause, one primary finding: a container that already reported
      // N620 does not report its own overflow a second time here. Its
      // descendants and ancestors are NOT exempt — see admitted.ts.
      if (isAdmittedFailure(el)) continue;
      if (SCROLLABLE[el.raw('overflow-x')]) continue;
      out.finding(
        el.subject,
        `crushed: content needs ${Math.round(box.contentInline)}px but the box got ${Math.round(box.inline)}px — ${Math.round(box.contentInline - box.inline)}px paints outside it`,
      );
    }
  });
}
