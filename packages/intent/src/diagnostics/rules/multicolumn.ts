/**
 * N713 — content lost in a multicolumn box.
 *
 * A COLUMN BOX IS NOT AN ELEMENT. That single sentence is the whole reason this
 * rule exists as its own file with its own code, and it is a class of blindness
 * no per-node predicate can ever escape: `crushed()` asks each element whether
 * its content fits the box it was given, and in a multicolumn container the box
 * that content has to fit is a COLUMN — a fragmentainer the engine created, with
 * no DOM node, no computed style and nothing to query.
 *
 * The recorded measurement, `columns: calc(var(--intent-unit) * 44)` at 320 pixels
 * with a long label: at dense/pointer the container resolved 3 columns of 101.33
 * pixels each holding 103 pixels of content, produced 6 crushed nodes, and
 * measured 323 against 320. Dense again, and only dense — the context whose
 * entire job is fitting more in less.
 *
 * WHY THE 6 CRUSHED NODES ARE NOT THE ANSWER, and this is what makes a separate
 * code honest rather than redundant. The per-node crush predicate saw that cell
 * ONLY because `[data-layout="stack"]` stretches its children to the column
 * width, so each item inherited the column's too-small inline size and reported
 * it. Make the item shrink-to-fit and it sits at its own content width instead:
 * `scrollWidth === clientWidth`, nothing crushed, nothing reported — and the
 * content is outside a box that has no node and can never be measured. The
 * defect survives the fix to the symptom.
 *
 * So the only honest assertion is item RECTANGLES against the container's own
 * rectangle, which is why `Bounds` grew an origin.
 *
 * IT SELECTS ON THE COMPUTED FACT, NOT ON A DECLARATION, and that decision cost
 * one iteration worth recording. The first version selected
 * `[data-layout="columns"]`, which is the spelling the layout audit PROPOSES for
 * this capability — and the reachability guard rejected it immediately, because
 * `VOCABULARY.layout` allows `row | stack | wrap | grid` and nothing else. A
 * fifth value would have matched no element in the app, reported nothing, and
 * been indistinguishable from a clean page: the exact defect shape N700 shipped
 * in and the exact reason that guard exists. It also would have failed N610 on
 * every render.
 *
 * Keying on `column-count`/`column-width` is not merely the way around the
 * guard, it is the better question. A multicolumn formatting context is a
 * COMPUTED fact; whether some future table spells it `data-layout="columns"`, a
 * boolean attribute like `data-scroll-region`, or nothing at all, this rule
 * measures the box that actually exists. The cost is honest and bounded: two
 * style resolutions per painted element per run, paid because a selector cannot
 * express "is a fragmentainer".
 *
 * IT VERIFIES THAT THE BOX IS ACTUALLY MULTICOLUMN, and that is not paranoia —
 * it is the audit's own first self-inflicted bug. `[data-layout="columns"]` was
 * shadowed by a shared `display: flex`, and the first "multicolumn" measurement
 * was a flex row. Multicol does not apply to a flex or grid container, and the
 * computed `column-width` keeps reporting the declared length regardless, so the
 * properties alone prove nothing either. A box that sets them and is not a block
 * container gets N680, not silence: the rule genuinely cannot evaluate its claim,
 * and the reason — an inert declaration — is a defect in the table that somebody
 * needs to see.
 *
 * WHAT THIS RULE CANNOT SEE, stated because a scope claim nobody wrote down is a
 * false PASS in waiting. An item that overflows an INTERIOR column — eating into
 * the column gap without leaving the container — is invisible here. In the
 * measured cell that is columns 1 and 2 at 103 pixels inside 101.33-pixel
 * columns, encroaching 1.67 pixels into an 8-pixel gap. Reconstructing the
 * column geometry to catch it is possible only when items stretch, and in
 * exactly that case N660 already reports it precisely, node by node, as the 6
 * crushed nodes above. Deriving it otherwise means reconstructing a content-box
 * origin from resolved padding longhands, and that arithmetic is what shipped
 * 710 false failures the last time this project tried it. An under-report
 * bounded by the column gap beats a fabricated number.
 *
 * `content-visibility: auto` used to be handled here, by hand, and the record
 * of why belongs to the file that now handles it: `painted()` drops skipped
 * nodes, that dropping IS the measured false PASS, and the answer is N680
 * because skipped content stays focusable and findable — the reader loses
 * nothing and only the proof is destroyed. This rule was one of three that
 * asked for itself. The other eight measuring rules did not, so the question
 * moved into the constructor and the verdicts here did not move with it: the
 * seam names the scope it was denied, and this rule's scope was always the
 * container. The escaped exemption came the same way and lost the same query.
 *
 * ONE REMAINING SILENCE IS KNOWN, MEASURED, AND DELIBERATELY LEFT, so nobody
 * reads the migration as having closed it. The discriminator below folds an
 * UNRESOLVABLE `column-count` into the same branch as an absent one, so a port
 * that cannot answer the property passes over the whole document — seeded and
 * proven by the injection harness, not suspected. It is not the same defect as
 * N640's and N650's floors, and that is why it is not fixed alongside them: a
 * custom property genuinely fails to resolve in a browser, whereas the computed
 * value of a standard longhand is always `auto` or an integer, so the condition
 * is reachable only through a port that under-resolves. Making the branch loud
 * would report N680 on every element of every fixture — the fake answers the
 * empty string for every property nobody declared — which is the false-FAIL
 * direction on a state the browser cannot produce. Closing it honestly means
 * the FAKE resolving standard longhands the way a browser does, which is
 * `testing.ts` and a different owner's file.
 */

import type { Rule } from '../../contracts.js';
import { measuringRule } from '../rule.js';

/** Same rounding tolerance as the rest of the engine. Layout is fractional. */
const TOLERANCE = 1;

/**
 * `display` values that establish a block container, which is the only kind of
 * box multicol applies to.
 *
 * Enumerated positively so an unknown or unresolved value lands in N680 rather
 * than being waved through: happy-dom returns the empty string for `display`, and
 * the negative spelling ("not flex and not grid") would call that a block
 * container and evaluate a multicolumn claim about a box nobody measured. Loud
 * beats vacuous.
 */
const BLOCK_CONTAINER: Readonly<Record<string, true>> = {
  block: true,
  'flow-root': true,
  'inline-block': true,
  'list-item': true,
  'table-cell': true,
  'table-caption': true,
};

/** Positioned out of flow, so it was never in a column to begin with. */
const OUT_OF_FLOW: Readonly<Record<string, true>> = { absolute: true, fixed: true };

export function multicolumnRule<TNode>(): Rule<TNode> {
  return measuringRule<TNode>('N713', (lens, out) => {
    for (const container of lens.painted('*').items) {
      // The computed discriminator. Both properties `auto` means no multicolumn
      // formatting context was ever requested, which is almost every element on
      // the page and therefore the branch that has to be cheapest.
      const count = container.raw('column-count');
      const width = container.raw('column-width');
      if ((count === 'auto' || count === '') && (width === 'auto' || width === '')) continue;

      const display = container.raw('display');
      if (!BLOCK_CONTAINER[display]) {
        out.undecidable(
          container.subject,
          `sets column-width: ${width} and column-count: ${count} but computes display: ${display || '<unresolved>'} — multicol does not apply to that box, so the declaration is inert and no column geometry exists. The first "multicolumn" measurement this project made was a flex row for exactly this reason`,
        );
        continue;
      }

      // A subtree holding content the checker cannot measure cannot support a
      // containment claim about itself. `painted()` raised the N680 when it was
      // asked; this is the rule declining to put a verdict on top of a subtree
      // with a hole in it. Asked before the geometry below is read, because
      // that is where the old hand-written admission sat and the order is what
      // keeps the verdicts identical.
      const inside = container.painted('*');
      if (!inside.whole) continue;

      const outer = container.bounds();
      // Outermost-first: once a node is reported, its whole subtree is claimed,
      // so an escaping item and the text inside it are one finding rather than
      // two descriptions of one defect.
      const claimed = new Set<TNode>();
      for (const item of inside.items) {
        if (claimed.has(item.node)) continue;
        if (OUT_OF_FLOW[item.raw('position')]) continue;

        const inner = item.bounds();
        // A zero-area rect is a node with no box to compare — a non-replaced
        // inline, say — and its origin would read as an escape all the way to
        // the viewport corner.
        if (inner.inline === 0 && inner.block === 0) continue;

        // All four edges. A fragmented container can lose content in any
        // direction: the block axis is where `column-fill` and a bounded height
        // push it, and the inline axis is where the last column overflows.
        const past = {
          'inline-start': outer.inlineStart - inner.inlineStart,
          'inline-end': inner.inlineStart + inner.inline - (outer.inlineStart + outer.inline),
          'block-start': outer.blockStart - inner.blockStart,
          'block-end': inner.blockStart + inner.block - (outer.blockStart + outer.block),
        };
        const breached = Object.entries(past).filter(([, amount]) => amount > TOLERANCE);
        if (breached.length === 0) continue;

        for (const descendant of item.declared('*')) claimed.add(descendant.node);
        out.finding(
          item.subject,
          `lies outside its multicolumn container ${container.subject} by ${breached
            .map(([edge, amount]) => `${Math.round(amount)}px past ${edge}`)
            .join(' and ')} — a column box is not an element, so no per-node crush test can reach this`,
        );
      }
    }
  });
}
