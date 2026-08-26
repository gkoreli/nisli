/**
 * N715 — overflow before the box: content painted above, or to the logical start
 * of, the container that was supposed to hold it.
 *
 * THE DEFECT IS IN THE MEASUREMENT, not in a missing rule, and that is what
 * makes this the fourth member of the family the README tallies. `scrollHeight`
 * and `scrollWidth` are DIRECTIONAL: the scrollable overflow region extends only
 * in the end direction, so a box can report `scrollHeight 36 === clientHeight 36`
 * — perfectly settled, nothing to see — while a 45-pixel control sits outside it.
 * That is the recorded measurement: a `16/9` box with `min-block-size: 0` whose
 * control was pinned by `align-content: end`, so the overflow went towards
 * block-START, where no scroll extent can see it. `Metrics.overflows()` is
 * structurally blind on that axis and always was.
 *
 * So this rule does not measure extents at all. It compares RECTANGLES, which is
 * why `Bounds` grew an origin, and it is the same lesson as the other five in a
 * new direction: *a check must measure the box its claim is about* — here, in the
 * direction the claim is about.
 *
 * WHICH BOXES IT ASKS ABOUT. `[data-layout]` and `[data-fit]`: the containers
 * the resolution table SIZED, and therefore the only boxes whose containment the
 * table actually promises. A rule over every element would be a rule about the
 * browser rather than about the table.
 *
 * DEEPEST CONTAINER WINS. Containers are visited in reverse document order and
 * each claims the descendants no deeper container has taken, so a node that
 * escapes a nested row is reported against that row and not also against its
 * grandparent. One root cause, one primary finding — the same principle
 * `admitted.ts` states for N620, arrived at here without needing ancestry on the
 * port.
 *
 * THREE CONTAINER-LEVEL EXEMPTIONS, and the third is the interesting one:
 *   - a SCROLL container. Content outside the box is what a scroller is for, and
 *     a scrolled container genuinely moves its content out of its own rect. The
 *     port exposes no scroll offset, so "scrolled away" and "overflowing
 *     start-side" are indistinguishable here, and inventing a distinction is how
 *     an oracle starts reporting fiction. Named as a limit rather than hidden.
 *   - a CLIPPER. Content before the box start is genuinely lost, and N710 owns
 *     clipped loss across all four edges with the numbers that matter. Reporting
 *     it here too would be one defect with two claims, which is a recorded
 *     muting cause. Same handoff as N660's.
 *   - a container with UNMEASURABLE content anywhere in its subtree, which is not
 *     an exemption at all but an admission: it reports N680. See below.
 *
 * `content-visibility: auto` IS WHY THIS RULE READS `declared()` FIRST.
 * Measured: a skipped subtree makes the clipper report
 * `scrollWidth 200 === clientWidth 200` while its child needs 471 pixels, and
 * `rendered()` answers false for every node inside it — so `painted()` hands the
 * rule an EMPTY list and the run is a PASS with zero findings. Nothing throws,
 * so the runner's `catch` never fires either. The subtree has to be reached
 * through `declared()`, which is the only selector that returns nodes
 * `painted()` refused.
 *
 * And the verdict for it is UNDECIDABLE, never FAIL. css-contain-2 requires that
 * the skipped contents of an `auto` element stay available to find-in-page and
 * tab order and remain focusable and selectable, so the READER loses nothing
 * whatsoever. Only the PROOF is destroyed. Reporting a failure there would be
 * the mirror-image lie of the one this rule exists to fix.
 *
 * THE ADMISSION IS NO LONGER WRITTEN HERE, and the verdicts are unchanged. This
 * rule was one of three that asked `measurable()` for itself, which is why the
 * paragraphs above exist; the seam now asks on behalf of every measuring rule,
 * so `painted()` reports the N680 and hands back a sample that says whether it
 * is whole. The subject and the count come out the same, because the seam names
 * the SCOPE that was denied and this rule's scope was always the container. One
 * verdict does move, and it is a narrowing: an unmeasurable node inside an
 * ESCAPED subtree no longer produces an admission, because the escape means no
 * containment guarantee was in force there and there is nothing to fail to
 * prove.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';
import type { Measurement } from '../observe.js';

/** The containers the resolution table sized, and so the ones it promises. */
const CONTAINERS = '[data-layout], [data-fit]';

/**
 * Layout is fractional and a rect is not, so a one-unit difference is rounding
 * rather than escape. Same tolerance the rest of the engine uses, deliberately:
 * a stricter rule here would report the sub-pixel noise of every derived value.
 */
const TOLERANCE = 1;

/**
 * Positioned out of flow, so the containment premise does not apply. The
 * overflow menu panel is `position: absolute` inside its row on purpose — it has
 * no neighbour to displace and it is MEANT to paint outside — and the same
 * argument that keeps it out of N670's sibling pass keeps it out of this one.
 */
const OUT_OF_FLOW: Readonly<Record<string, true>> = { absolute: true, fixed: true };

/**
 * A promoted overlay and EVERYTHING INSIDE IT. `OUT_OF_FLOW` above exempts the
 * panel itself, and that was not enough: a button inside an open popover is in
 * normal flow *relative to the panel*, so it reads as in-flow here while its
 * rect is positioned against the viewport. The result was a confident false
 * failure — "paints 46 pixels above its block-start edge of app-message-row" — about
 * an element that is not laid out inside that row at all.
 *
 * This is the eighth oracle bug in this experiment and the one with the least
 * excuse: N710 was given exactly this exemption an hour earlier, for exactly
 * this reason, and its sibling did not get it. A fix applied to one rule and not
 * to the rule beside it is its own defect class, and the reason it is recorded
 * here rather than quietly patched.
 *
 * `[popover]` rather than `:popover-open`, matching N710: happy-dom has no
 * popover API, so the pseudo would make the unit lens and the browser lens
 * disagree about the same document. A closed popover is `display: none` and
 * `painted()` has already dropped it.
 */
const PROMOTED = '[popover], [popover] *';

export function directionalOverflowRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N715', (lens, out) => {
    const promoted = new Set(lens.declared(PROMOTED).map((el) => el.node));
    const containers = lens.painted(CONTAINERS).items;
    const claimed = new Set<TNode>();

    // Reverse document order, so a nested container claims its descendants
    // before its ancestors get to see them.
    for (let index = containers.length - 1; index >= 0; index--) {
      const container = containers[index] as Measurement<TNode>;

      // The subtree, asked for BEFORE the containment question and used after
      // it, which is deliberate rather than clumsy: asking is what raises the
      // admission for content this container holds and nobody can measure, and
      // that admission is owed whatever kind of box this turns out to be. A
      // scroller with a skipped subtree still cannot be cleared.
      const inside = container.painted('*');
      // A subtree holding content the checker cannot measure cannot support a
      // containment claim about itself. `painted()` has already said so as
      // N680; this is the rule declining to add a verdict on top of it,
      // because every number below would be drawn from a subtree with a hole.
      if (!inside.whole) continue;

      const containment = container.containment();
      // A scroller moves its own content and the port carries no scroll offset;
      // a clipper's losses belong to N710. Neither is a defect this rule can
      // describe truthfully.
      if (containment !== 'visible') continue;

      const outer = container.bounds();
      for (const item of inside.items) {
        if (claimed.has(item.node)) continue;
        claimed.add(item.node);
        if (promoted.has(item.node)) continue;
        if (OUT_OF_FLOW[item.raw('position')]) continue;

        const inner = item.bounds();
        // A zero-area rect is a node with no box to compare — a non-replaced
        // inline, say — and its origin would read as an escape all the way to
        // the viewport corner. `painted()` has already removed the
        // `display: contents` hosts; this removes the rest without pretending
        // they were measured.
        if (inner.inline === 0 && inner.block === 0) continue;

        const beforeBlock = outer.blockStart - inner.blockStart;
        const beforeInline = outer.inlineStart - inner.inlineStart;
        if (beforeBlock <= TOLERANCE && beforeInline <= TOLERANCE) continue;

        // Both axes in one finding when both escape: it is one node in one
        // wrong place, and splitting it would double-count a single defect.
        const axes = [
          beforeBlock > TOLERANCE ? `${Math.round(beforeBlock)}px above its block-start edge` : '',
          beforeInline > TOLERANCE
            ? `${Math.round(beforeInline)}px before its inline-start edge`
            : '',
        ].filter((axis) => axis !== '');
        out.finding(
          item.subject,
          `paints ${axes.join(' and ')} of ${container.subject} — invisible to scrollWidth and scrollHeight, which only ever grow towards the end edges`,
        );
      }
    }
  });
}
