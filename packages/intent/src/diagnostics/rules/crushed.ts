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
 * Four exemptions, all principled:
 *   - a node the solver truncated: clamping to one ellipsised line is a
 *     DECLARED loss, and its clipped content is not painting on anything;
 *   - a real scroll container: content larger than the box is the point of a
 *     scroller;
 *   - a CLIPPER: content larger than the box is not painting on a neighbour, it
 *     is deleted, and N710 owns that claim. This exemption is new and it is a
 *     narrowing of this rule — see `EXEMPT_CONTAINMENT` below for why the
 *     narrowing is the honest direction;
 *   - `data-appearance="field"`: a text control scrolls its own value, so a
 *     value wider than the box is the field WORKING. This is the only
 *     role-keyed exemption in the set, and it is documented at its source in
 *     theme/roles.css; anything else would be a role buying itself an excuse.
 * Escaped subtrees are excluded because they forfeited the guarantee (N601),
 * and the seam excludes them now, so the sentence stays and the selector does
 * not.
 * A `contain: inline-size` truncator reports zero intrinsic width; that is not
 * an undecidable measurement (never N680), it is a node already exempt above.
 * Measured, correcting the note this comment used to carry: `contain:
 * inline-size` does NOT blind the measurement — the audit read 362/120 through
 * it — so the exemption stands on the truncation, not on the containment.
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
 *
 * ONE VERDICT MOVES, and this rule had four of the five exemptions already. It
 * had the escaped exemption, spelled out in its own selector; that half now
 * comes from the constructor and the selector below keeps only the document
 * furniture, which is this rule's alone. What it did not have was an admission
 * for content it cannot measure: the injection harness seeded a crush inside
 * content skipped by `content-visibility: auto` and this rule reported a clean
 * page, because `content-visibility` does not change computed `contain`, so
 * such a box is not a clipper and N710 never sees it either. That case is now
 * N680. It names the document rather than the crushed element, which is the
 * honest subject: this rule scans every painted box, so what it lost was the
 * ability to assess part of the page rather than a verdict about one node.
 */

import type { Containment, Rule } from '../../contracts.js';
import { isAdmittedFailure } from '../admitted.js';
import { measuringRule } from '../rule.js';

/**
 * A box whose content is legitimately larger than itself, keyed on CONTAINMENT
 * rather than on the `overflow-x` string this rule used to read.
 *
 * That change is a measured fix and a transfer of ownership, both worth
 * recording. Measured, Chromium 151: `contain: paint` and `contain: content`
 * clip a 471-pixel child inside a 200-pixel box while `overflow-x` and `overflow-y` BOTH
 * compute to `visible` (523/200 and 540/200 in the audit's fixture). Reading the
 * property therefore classified two real clippers as "content paints outside its
 * box and lands on a neighbour" — the right location with a false claim.
 *
 * OWNERSHIP, so nobody re-adds the branch: `clip` is EXEMPT here and N710 owns
 * clipped loss. This rule previously failed clipped content deliberately, on the
 * argument that clipped content is unreadable content, and that argument was
 * right about the defect and wrong about the claim. N660 says "this box did not
 * get the inline space its content needs, so the overflow lands on a neighbour";
 * for a clipper nothing lands anywhere, the content is simply deleted, and N710
 * says that with the numbers that matter (measured worst case: a 772-pixel table in
 * a 358-pixel flush surface, 414 pixels and 30 nodes gone). Keeping both would report one
 * node twice with contradictory claims, and "one defect reported N times" is a
 * recorded muting cause in the round-2 corpus, not a hypothetical.
 *
 * The polarity of the old table is preserved for the reason it was written down:
 * it ENUMERATED what is exempt rather than testing `overflow-x !== 'visible'`,
 * because happy-dom does not expand the `overflow` shorthand and does not
 * default the longhand, so the negative spelling would exempt every element and
 * this rule would go vacuously quiet in unit tests while still working in
 * Chromium. `containment()` keeps that: it returns `visible` for a value it
 * cannot read, and an unknown value must fail safe INTO the check.
 */
const EXEMPT_CONTAINMENT: Readonly<Record<Containment, boolean>> = {
  visible: false,
  scroll: true,
  clip: true,
};

/**
 * Document furniture, which is not appearance and has no rhythm to break. The
 * escaped subtrees this selector used to name as well are gone from it, not
 * from the rule: `painted()` never hands one over now.
 */
const FURNITURE = 'html, head, body, script, style, template, meta, link, title';

export function crushedRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N660', (lens, out) => {
    // A tag-name exclusion, and an identity set rather than a per-node check
    // because the port answers selectors and not element names.
    const excluded = new Set(lens.declared(FURNITURE).map((el) => el.node));
    // `painted()` owns the rendered precondition this loop used to restate by
    // hand — measuring an unpainted node is how an oracle invents defects (F4).
    for (const el of lens.painted('*').items) {
      if (excluded.has(el.node)) continue;
      if (el.attr('data-truncate') !== null) continue;
      if (el.attr('data-appearance') === 'field') continue;
      const box = el.box();
      if (box.contentInline <= box.inline + 1) continue;
      // One root cause, one primary finding: a container that already reported
      // N620 does not report its own overflow a second time here. Its
      // descendants and ancestors are NOT exempt — see admitted.ts.
      if (isAdmittedFailure(el)) continue;
      if (EXEMPT_CONTAINMENT[el.containment()]) continue;
      out.finding(
        el.subject,
        `crushed: content needs ${Math.round(box.contentInline)}px but the box got ${Math.round(box.inline)}px — ${Math.round(box.contentInline - box.inline)}px paints outside it`,
      );
    }
  });
}
