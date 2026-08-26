/**
 * N700 — two actions in one surface both claim to be the most important.
 *
 * This is the first rule in the set that checks ATTENTION rather than geometry,
 * and it exists because of a specific piece of evidence rather than a hunch.
 *
 * WHY THIS RULE IS DEFENSIBLE AND AN "IS THIS UI GOOD" RULE IS NOT.
 * Aesthetic quality is not measurable, and that is settled rather than argued:
 * the best published predictors of perceived UI appeal ceiling at adjusted
 * R²≈.48 (Reinecke, CHI 2013) and 49%/32% (Miniukovich, CHI 2015), and the
 * canonical "these are good" reference class — Webby Award winners — itself
 * spans means of 4.21 to 6.57 on a 9-point scale with an average SD of 1.69.
 * There is no consistent label, so no oracle can be trained on one. Symmetry and
 * balance were *pruned* from those models by backward elimination.
 *
 * So this rule does not judge quality. It finds a CONTRADICTION between two
 * declarations, which is exact, and it has a normative source: the GNOME HIG
 * states that "each view should only ever include a single button using either
 * the suggested or destructive styles". That rule is unenforceable against
 * `class="bg-blue-600"`, because that string names a colour rather than a role.
 * It becomes decidable the moment emphasis is declared.
 *
 * WHY IT CANNOT PRODUCE A FALSE FAILURE. It reads no geometry at all. Five of
 * the nine defects in the first run were the checker measuring the wrong box or
 * measuring an unpainted node; a rule that measures nothing is structurally
 * immune to that entire class. It therefore selects through `declared()`, not
 * `painted()` — a `display: contents` component host has no box, and an
 * emphasis declaration is a fact about the source whether or not it renders.
 *
 * SCOPE IS THE ONLY REAL DESIGN DECISION HERE, and the wrong choice makes the
 * rule useless in both directions. GNOME says "view". A page is too coarse: the
 * marketing page in this prototype deliberately shows four self-contained cards
 * side by side, each demonstrating one density with its own Save button, and
 * four primaries on one page is correct there. A single element is too fine to
 * mean anything. The unit that matches "view" is the SURFACE — the card, panel
 * or region a reader takes in as one thing.
 *
 * Hence OWNERSHIP rather than containment: a surface owns the emphatic actions
 * beneath it except those belonging to a nested surface. The four marketing
 * cards each own exactly one, and the region containing them owns none. Without
 * that subtraction this rule would report every ancestor of a violation as well
 * as the violation, and a checker that reports one defect four times gets muted
 * — which the round-2 corpus records as a real failure mode, not a hypothetical.
 */

import type { Rule } from '../../contracts.js';
import { rule } from '../rule.js';

/**
 * A surface is the unit a reader takes in at once. Both spellings are one
 * concept: a card or panel declares `data-appearance="surface"`, and a region is
 * the outermost surface of a view, which would otherwise own nothing and check
 * nothing.
 *
 * THE FIRST VERSION OF THIS LINE SAID `[data-surface]`, WHICH MATCHES NOTHING.
 * The vocabulary spells a surface as a value of `data-appearance`, not as an
 * attribute of its own, so the rule shipped dead: it selected 11 regions, no
 * surfaces, and reported a clean page. Both halves of the test suite agreed
 * with it, because the fixtures were invented from the same wrong assumption as
 * the selector. Nothing in a fake-inspector unit test or a 240-cell matrix can
 * catch a rule that never fires — silence reads as success. `AXIS_ATTRS` in
 * contracts.ts and `test/reachability.test.ts` exist because of this line.
 */
const SURFACE = '[data-appearance="surface"], [data-component="app-region"]';

/**
 * Emphasis that claims priority. `primary` says "do this"; `danger` says "this
 * is irreversible" — both spend the same attention, which is why the GNOME rule
 * counts them together rather than allowing one of each.
 */
const EMPHATIC =
  '[data-appearance="action"][data-role="primary"], [data-appearance="action"][data-role="danger"]';

export function competingPrimariesRule<TNode>(): Rule<TNode> {
  return rule<TNode>('N700', (lens, out) => {
    for (const surface of lens.declared(SURFACE)) {
      // Actions belonging to a nested surface are that surface's problem, and
      // reporting them here as well would multiply one defect by its depth.
      const nested = new Set(
        surface
          .declared(SURFACE)
          .flatMap((inner) => inner.declared(EMPHATIC))
          .map((action) => action.node),
      );
      const owned = surface.declared(EMPHATIC).filter((action) => !nested.has(action.node));
      if (owned.length < 2) continue;
      const names = owned
        .map((action) => `${action.subject} (${action.attr('data-role')})`)
        .join(', ');
      out.finding(
        surface.subject,
        `${owned.length} actions in one surface declare priority: ${names} — attention cannot be spent twice`,
      );
    }
  });
}
