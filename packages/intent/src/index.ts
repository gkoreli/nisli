/**
 * @nisli/intent — appearance derived from declared meaning and context.
 *
 * This is the RUNTIME half. It contains the vocabulary contract and the measured
 * fit pass, and it deliberately imports nothing from `./devtools`: the checker
 * is dev-only weight and a consumer shipping production must be able to drop it
 * entirely. Anything both halves need lives in `contracts.ts`, which this
 * barrel owns.
 *
 * The three tiers, so nobody mistakes the last one for a layout engine:
 *
 *   1. Static, zero runtime — CSS custom properties and container queries do
 *      density, rhythm, type scale, colour, elevation and radius. Ship
 *      `@nisli/intent/theme.css` and no JavaScript participates.
 *   2. The browser's own solvers — flex, grid, `clamp()`, `text-wrap`,
 *      `field-sizing`, anchor positioning and `position-try`. Already solvers;
 *      the engine's job is to stop fighting them.
 *   3. Measured and bounded — `solveFit` is the only novel runtime code, and it
 *      makes DISCRETE choices only: what collapses, what truncates, what moves
 *      to a menu. A bounded loop over a declared priority list, never a
 *      constraint system. Grid Style Sheets shipped a Cassowary solver to the
 *      browser in 2014 and is an archived repository; Flutter's architecture
 *      document rejects constraint solving by name. Tier 3 stays small on
 *      purpose.
 *
 * Barrel discipline: every name here is a permanent compatibility obligation,
 * so four of the prototype's exports were deliberately withheld — see the
 * module doc in `contracts.ts` for which and why.
 */

// ── The vocabulary contract ────────────────────────────────────────────────
// Types first, then the two frozen tables. `VOCABULARY` says what the legal
// values ARE; `AXIS_ATTRS` says where they are WRITTEN, and they ship together
// because either alone leaves the vocabulary unable to be checked by the people
// using it — which is precisely how a rule once shipped matching nothing.
export type {
  AlignKind,
  AppearanceRole,
  Backdrop,
  BackdropKind,
  Bounds,
  Box,
  Candidate,
  ClipKind,
  CodeEntry,
  Containment,
  Degradation,
  Density,
  Emphasis,
  Finding,
  FitOutcome,
  FitState,
  InputMode,
  Inspector,
  LayoutKind,
  Metrics,
  Mutator,
  Priority,
  Rgba,
  Rule,
  Severity,
  Strategy,
  TextRole,
  ThemeName,
} from './contracts.js';
export { AXIS_ATTRS, STRATEGIES, VOCABULARY } from './contracts.js';

// ── The measured tier ──────────────────────────────────────────────────────
export { discoverCandidates, domMetrics, domMutator, fitContainers } from './fit/dom.js';
export { fit, solveAll } from './fit/observe.js';
export { solveFit } from './fit/solver.js';

// ── The engine ─────────────────────────────────────────────────────────────
// Thing #1: the engine decides one Row. `allocate` is the pure decision;
// `Row` is the typed building block that owns it; `declareItem` and
// `declareTrigger` are how a child says how it may give way — a typed call,
// never an attribute. `planOf` reads the decision back.
export type { ItemDeclaration, RowAction, RowDecision, RowInput, RowItem, RowPlan, RowProps, RowScope } from './engine/row.js';
export { allocate } from './engine/allocate.js';
export { declareItem, declareTrigger, planOf, Row, RowContext } from './engine/row.js';
