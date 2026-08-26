/**
 * @nisli/intent/devtools — the checker, and why it is a separate entry point.
 *
 * Everything here is DEV-ONLY WEIGHT. Nothing in `@nisli/intent` proper imports
 * it, so a consumer shipping production drops the whole subpath and pays nothing
 * for it. That split is not tidiness: the resolution table and the fit pass are
 * what a user's browser needs, and the fifteen rules are what an AUTHOR needs.
 *
 * WHAT THIS IS FOR, in one paragraph, because it is the reason the package
 * exists rather than a debugging nicety. An agent writing UI code cannot see
 * what it made. Every other class of mistake it makes is caught by a machine in
 * seconds — a typo, a type error, a failing test. Appearance mistakes are caught
 * only by a human looking at a screen, hours later, if at all. Because
 * appearance here is DERIVED from a declaration rather than typed by hand, it
 * can be asserted over: `check()` answers "is this UI wrong" without a
 * screenshot, a baseline image or a human.
 *
 * TWO INVARIANTS THAT COST MORE THAN THEY LOOK, both learned by measurement and
 * both now structural rather than advisory:
 *
 *   1. A check must measure the box its claim is about. `Box` is the padding box
 *      for CONTAINMENT claims; `Bounds` is the border box plus origin for
 *      PRESSABILITY and extent claims. They are separate types because
 *      confusing them produced five defects, twice in the same rule family.
 *   2. A check that cannot measure must SAY SO rather than pass. `observe`'s
 *      lens has exactly two selectors — `painted()` is the only route to
 *      geometry, `declared()` is for claims about what the author wrote — and
 *      `Report.undecidable()` is how a rule admits defeat. Three of the four
 *      silent oracle bugs in this project's history were a rule quietly
 *      returning nothing when the geometry it needed was unavailable.
 *
 * The scoreboard, kept here on purpose: across the prototype's development,
 * EIGHT of the fourteen defects found were in the checker rather than in the
 * page. An appearance oracle is easy to write and hard to make truthful, and the
 * expensive half of "the framework checks the UI" is the checker's own honesty.
 * That is why every rule ships with a fixture proving it can fail, and why
 * `codes.ts` is append-only.
 */

/**
 * COMPOSING A RULE SET, and why the fifteen rule factories are NOT exported.
 *
 * `DEFAULT_RULES()` returns fresh instances of all fifteen, and `check()` takes
 * any `readonly Rule<T>[]`, so both directions of composition already work with
 * no additional exports:
 *
 *   subtract   check(i, DEFAULT_RULES().filter((r) => r.code !== 'N650'))
 *   add        check(i, [...DEFAULT_RULES(), myRule()])
 *   from zero  check(i, DEFAULT_RULES().filter((r) => KEEP.has(r.code)))
 *
 * Exporting the factories individually would add fifteen permanent
 * compatibility obligations and buy nothing those three lines do not already
 * give — the same trade that kept four solver internals off the main entry. A
 * rule is addressed by its CODE, which is append-only and documented, rather
 * than by an import name that could be renamed.
 */
// ── Running the checks ─────────────────────────────────────────────────────
export { check, DEFAULT_RULES } from './diagnostics/runner.js';
export { domInspector } from './diagnostics/dom.js';

// ── Reading the results ────────────────────────────────────────────────────
export { formatFindings, summarize } from './diagnostics/report.js';

// ── The code registry ──────────────────────────────────────────────────────
export { CODES, codeEntry, DOCS_BASE } from './diagnostics/codes.js';

// ── Authoring a rule ───────────────────────────────────────────────────────
// A consumer writing their own check gets the same composition the shipped
// sixteen use, and the same first decision: `rule` for a claim about what the
// author wrote, `measuringRule` for a claim about what the browser painted. The
// second one is not a convenience — its lens has already discharged the three
// obligations a measuring rule owes (not rendered, not measurable, forfeited by
// an escape), so a consumer's rule inherits them rather than reimplementing
// them, which is what nine of this package's own rules failed to do by hand.
// `AXIS_ATTRS` and `VOCABULARY` on the main entry are what make such a rule
// checkable for dead selectors.
//
// `measure` is deliberately NOT exported. It is the composer that binds the
// obligations to a report, and handing it out would let a caller build a
// measuring lens with a different admission — an escape from the obligations,
// which is the thing this seam exists to remove.
export type {
  Declaration,
  Lens,
  Measurement,
  MeasuringLens,
  Sample,
} from './diagnostics/observe.js';
export { observe } from './diagnostics/observe.js';
export type { Report } from './diagnostics/rule.js';
export { measuringRule, rule } from './diagnostics/rule.js';
export { isAdmittedFailure } from './diagnostics/admitted.js';

// ── Provenance ─────────────────────────────────────────────────────────────
// "Why is this element this size" answered with a derivation chain rather than a
// guess. The counterpart to a checker: one says what is wrong, this says why
// anything is the way it is.
export type { Explanation } from './explain.js';
export { explain } from './explain.js';
