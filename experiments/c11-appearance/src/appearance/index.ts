/**
 * appearance/ — the engine half of the C11 candidate.
 *
 * Layering, enforced by review rather than tooling (this is a prototype):
 *
 *   contracts.ts          types + the closed vocabulary. Imports nothing.
 *   fit/{candidates,strategies,solver}.ts    pure domain: decisions only
 *   fit/dom.ts            the ONLY DOM reader/writer for fit
 *   fit/observe.ts        nisli lifecycle binding
 *   diagnostics/rules/*   pure rules over the Inspector port
 *   diagnostics/dom.ts    the ONLY DOM reader for diagnostics
 *   explain.ts            provenance, dev-only in spirit
 *
 * The point of the split is graduation: if this bet survives, the pure domain
 * moves into @nisli/core unchanged and only the adapters are argued about on
 * byte cost.
 */

export type {
  AppearanceRole,
  Box,
  Candidate,
  CodeEntry,
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
  Rule,
  Severity,
  Strategy,
  TextRole,
  ThemeName,
} from './contracts.js';
export { STRATEGIES, VOCABULARY } from './contracts.js';

export { orderCandidates } from './fit/candidates.js';
export { discoverCandidates, domMetrics, domMutator, fitContainers } from './fit/dom.js';
export { fit, solveAll } from './fit/observe.js';
export { solveFit } from './fit/solver.js';
export { allowsShrink, needsAffordance, truncationDegenerate } from './fit/strategies.js';

export { CODES } from './diagnostics/codes.js';
export { domInspector } from './diagnostics/dom.js';
export { formatFindings, summarize } from './diagnostics/report.js';
export { check, DEFAULT_RULES } from './diagnostics/runner.js';

export { explain, type Explanation } from './explain.js';
