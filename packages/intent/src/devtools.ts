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

// ── Running the checks ─────────────────────────────────────────────────────
export { check, DEFAULT_RULES } from './diagnostics/runner.js';
export { domInspector } from './diagnostics/dom.js';

// ── Reading the results ────────────────────────────────────────────────────
export { formatFindings, summarize } from './diagnostics/report.js';
export { CODES, codeEntry, DOCS_BASE } from './diagnostics/codes.js';

// ── Authoring a rule ───────────────────────────────────────────────────────
// A consumer writing their own check gets the same composition the shipped
// fifteen use: a lens that cannot reach an unpainted node's geometry, and a
// reporter that applies severity and hint from the registry rather than from the
// caller. `AXIS_ATTRS` and `VOCABULARY` on the main entry are what make such a
// rule checkable for dead selectors.
export type { Lens, Observation } from './diagnostics/observe.js';
export { observe } from './diagnostics/observe.js';
export type { Report } from './diagnostics/rule.js';
export { rule } from './diagnostics/rule.js';
export { isAdmittedFailure } from './diagnostics/admitted.js';

// ── Provenance ─────────────────────────────────────────────────────────────
// "Why is this element this size" answered with a derivation chain rather than a
// guess. The counterpart to a checker: one says what is wrong, this says why
// anything is the way it is.
export type { Explanation } from './explain.js';
export { explain } from './explain.js';
