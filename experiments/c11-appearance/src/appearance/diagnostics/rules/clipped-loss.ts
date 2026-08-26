/**
 * N710 — clipped content lost.
 *
 * A box clips, and what it clips carries meaning: text, or something focusable.
 * No scroll affordance exists between that content and the clip edge, and no
 * declared degradation covers it. So the content is not merely hidden — it is
 * gone, and nothing on screen says so.
 *
 * This is the third member of a family. N621 covers the SOLVER destroying a
 * value, N690 covers the TABLE destroying a word, and this covers the BOX
 * destroying content outright. It is the only one of the three that was silent,
 * and it was the loudest defect in the prototype by magnitude: measured on a
 * `DataTable` inside `Surface({flush: true})` at 360 pixels, with the pattern's
 * authored scroll declaration removed, an 835-pixel table in a 358-pixel surface
 * destroyed 33 meaningful nodes, 20 of them entirely, worst overhang 475.58 pixels —
 * three and a half columns deleted with no scrollbar, no affordance and no
 * finding. Every existing check reported the page clean, because every existing
 * check asked a question this defect does not answer to.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY NO EXISTING RULE COULD SEE IT — four independent blindnesses.
 * ══════════════════════════════════════════════════════════════════════════
 *   - The clipper does not overflow. Its `scrollWidth` equals its `clientWidth`
 *     once a descendant absorbs the width, so `overflows()` is false.
 *   - N660 asks whether an element got the space its own content needs. The
 *     clipped `<td>`s each got exactly what they needed; it is their ancestor
 *     that is too narrow, and the box that is too narrow is not crushed.
 *   - N670 needs two siblings to collide. Nothing collides — the content leaves
 *     the building.
 *   - N620 needs a `[data-fit]` container. A table deliberately is not one:
 *     dropping a column is not a degradation the fit engine has standing to
 *     choose.
 * Four correct measurements of the wrong thing, which is this project's
 * signature failure and the reason this rule compares RECTANGLES.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHAT IT MEASURES, and why each part is not negotiable.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 1. A CLIPPER IS `containment() === 'clip'`, NEVER AN OVERFLOW STRING.
 *    Measured: `contain: paint` clips a 471-pixel child inside a 200-pixel box while
 *    `overflow-x` computes to `visible`, and `contain: content` does the same.
 *    Every clip test in this prototype keyed on the overflow value, so paint
 *    containment was a clipper that both tables classified as "content paints
 *    outside its box and lands on a neighbour". Asking the port means this rule
 *    cannot be fooled by a property that is not the question.
 *
 * 2. ALL FOUR EDGES, because the fix for a false PASS produced another one.
 *    The probe that found this defect first measured only the inline-end edge.
 *    Then it focused the last `<th>`: `overflow: hidden` is a scroll container
 *    that merely hides its scrollbar, so the clipper scrolled, the loss moved
 *    from `end: +414` to `start: +414`, and the pass reported ZERO — a false
 *    PASS produced by the fix for a false PASS. Scroll extents are directional;
 *    rectangles are not. Hence `bounds()`, which carries an origin, and four
 *    subtractions rather than one.
 *
 * 3. A NODE WITH A SCROLLER BETWEEN IT AND THE CLIPPER IS REACHABLE.
 *    Without this the rule reports 16 lost columns inside a WORKING scroll
 *    region, which is worse than silence: it fires on the fix. The port exposes
 *    no ancestry, deliberately, so the reachable set is built the other way
 *    round — every scroller inside the clipper is asked for its own painted
 *    descendants, and those are excluded by identity. Same shape as the escaped
 *    subtree exclusion in N660, and it needs no new port method.
 *
 * 4. MEANINGFUL MEANS TEXT OR FOCUS. A clipped decorative gradient is what
 *    clipping is FOR. Measured control: a 900-pixel gradient in a 358-pixel box, zero
 *    findings. The two positive signals are text content and focusability,
 *    because those are the two things a reader loses.
 *
 * 5. UNMEASURABLE IS NOT A PASS. A `content-visibility: auto` subtree measures
 *    `200/200` on its clipper and `0×0` on every skipped child, while
 *    `checkVisibility()` still answers true — so `painted()` filters the whole
 *    subtree out and the rule finds nothing. That is the exact false-PASS shape
 *    this file exists to close, arriving through the door marked "no findings".
 *    A clipper whose subtree contains anything unmeasurable reports N680 and
 *    stops; it does not go on to claim the rest is fine.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE TWO EXEMPTIONS, AND WHY THEY ARE NOT SUPPRESSIONS.
 * ══════════════════════════════════════════════════════════════════════════
 *   - `data-clip="trim"` — the author declared that what overflows this box is
 *     decoration. It is the one thing no measurement can derive: nothing
 *     distinguishes a 900-pixel decorative gradient from a 900-pixel table, and the
 *     honest response to an underdetermined question is to require a
 *     declaration rather than to guess. This is the ONE author-facing attribute
 *     the slice added, and it was paid for by deleting `data-scroll-region`.
 *   - `data-truncate` — the solver already degraded this node and there is an
 *     ellipsis on screen as the receipt. Reporting it again would be the
 *     checker refusing to accept a loss the reader was told about. Measured
 *     control: a truncated 507-pixel string in a 358-pixel box, zero findings.
 * An escaped subtree is excluded because it forfeited the guarantee (N601).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE GEOMETRY IS `bounds()`, AND THE UNDER-REPORT IS DELIBERATE.
 * ══════════════════════════════════════════════════════════════════════════
 * Border box against border box, both from the same frame and the same
 * coordinate system. `Bounds` has no `contentInline`, which is correct: this is
 * a visual-extent claim ("does this paint outside that box"), not a containment
 * claim ("did this box get the space its content wanted"). The residue is that a
 * descendant inside its container's border but outside its padding box is not
 * reported — an under-report of at most one border width, which never invents a
 * defect. The alternative is reconstructing a padding-box origin from resolved
 * border longhands, which is the exact arithmetic that shipped 710 false
 * failures on a run where two of those longhands resolved to the empty string.
 * Loud over-reporting gets an oracle muted; a bounded under-report does not.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

/**
 * Selectors whose subtrees this rule does not judge, and the one it uses to
 * find the reachable set.
 *
 * `TRIMMED` and `DECLARED_LOSS` are exclusions on the CLIPPER and on the
 * CANDIDATE respectively, and they are different questions: the first says
 * "this box is allowed to lose things", the second says "this thing was already
 * lost on purpose".
 */
const TRIMMED = '[data-clip="trim"]';
const DECLARED_LOSS = '[data-truncate], [data-truncate] *';
const ESCAPED = '[data-escaped], [data-escaped] *';

/**
 * Elements that are reachable without text: a focusable node carries meaning
 * even when it is empty, because a keyboard user can land on it and a clipped
 * one silently cannot be landed on.
 *
 * `[tabindex]` rather than `[tabindex="0"]`: a negative tabindex is still
 * programmatically focusable, and a focused node that cannot be scrolled into
 * view is WCAG 2.4.11 whether or not it is in the tab order.
 */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

export function clippedLossRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N710', (lens, out) => {
    for (const clipper of lens.painted('*')) {
      if (clipper.containment() !== 'clip') continue;
      if (clipper.attr('data-clip') === 'trim') continue;

      /* Undecidability first, and it must be asked through `declared()`:
         `painted()` drops a skipped subtree, which is the silence this rule
         exists to break. One admission per clipper, then move on — enumerating
         every skipped descendant would bury the finding it belongs to. */
      const unmeasurable = clipper.declared('*').filter((node) => !node.measurable());
      if (unmeasurable.length > 0) {
        out.undecidable(
          clipper.subject,
          `this box clips and ${unmeasurable.length} descendant(s) are skipped by content-visibility, so their geometry does not mean what it says — a clip over unmeasurable content cannot be cleared`,
        );
        continue;
      }

      /* The reachable set: everything inside a scroller that is itself inside
         this clipper. Built by identity because the port exposes no ancestry —
         and asking each scroller for its own descendants is the same shape as
         N660's escaped-subtree exclusion. */
      const reachable = new Set<TNode>();
      for (const candidate of clipper.painted('*')) {
        if (candidate.containment() !== 'scroll') continue;
        for (const inside of candidate.painted('*')) reachable.add(inside.node);
      }

      const exempt = new Set(
        [
          ...clipper.declared(DECLARED_LOSS),
          ...clipper.declared(ESCAPED),
          ...clipper.declared(`${TRIMMED}, ${TRIMMED} *`),
        ].map((node) => node.node),
      );

      const focusable = new Set(clipper.painted(FOCUSABLE).map((node) => node.node));

      const edges = clipper.bounds();
      const clipEnd = edges.inlineStart + edges.inline;
      const clipBottom = edges.blockStart + edges.block;

      let lost = 0;
      let wholly = 0;
      let worst = 0;
      for (const node of clipper.painted('*')) {
        if (reachable.has(node.node)) continue;
        if (exempt.has(node.node)) continue;
        if (node.text().trim() === '' && !focusable.has(node.node)) continue;

        const rect = node.bounds();
        /* Four edges, one comparison each. A single `Math.max` rather than four
           branches because the CLAIM is one thing — "this paints outside that
           box" — and the direction only matters to the number reported. */
        const overhang = Math.max(
          rect.inlineStart + rect.inline - clipEnd,
          edges.inlineStart - rect.inlineStart,
          rect.blockStart + rect.block - clipBottom,
          edges.blockStart - rect.blockStart,
        );
        if (overhang <= 1) continue;
        lost += 1;
        /* Wholly outside: nothing of this node is inside the clip on either
           axis. Reported separately because "clipped" and "deleted" read very
           differently to whoever has to fix it. */
        if (
          rect.inlineStart >= clipEnd - 1 ||
          rect.inlineStart + rect.inline <= edges.inlineStart + 1 ||
          rect.blockStart >= clipBottom - 1 ||
          rect.blockStart + rect.block <= edges.blockStart + 1
        ) {
          wholly += 1;
        }
        if (overhang > worst) worst = overhang;
      }

      if (lost === 0) continue;
      out.finding(
        clipper.subject,
        `this box clips and destroys ${lost} meaningful node(s) (${wholly} entirely, worst overhang ${worst.toFixed(2)}px) — nothing scrolls and no degradation was declared`,
      );
    }
  });
}
