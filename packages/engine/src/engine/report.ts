/**
 * Layout reports — the engine saying, in data, "I could not satisfy this".
 *
 * A block that decides a layout reports when the decision is unsatisfiable:
 * primaries that cannot fit, a title at its minimum that still overflows, a
 * cell narrower than its minimum. Silence means every plan was satisfied.
 * `prove()` collects these; in dev they also reach the console as diagnostics.
 */

export type ReportCode =
  | 'FIT_ROW'        // a row's essential items do not fit even after every concession
  | 'FIT_COLUMNS'    // a table's primary columns do not fit even truncated
  | 'FIT_CELL';      // a grid or form cell is narrower than its minimum

export interface LayoutReport {
  readonly code: ReportCode;
  /** The element that could not be satisfied. */
  readonly block: string;
  readonly width: number;
  /** How far short, px. */
  readonly deficit: number;
  readonly detail: string;
}

type Listener = (r: LayoutReport) => void;
const listeners = new Set<Listener>();

export function onReport(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The one way a block reports an unsatisfiable decision: hand it the plan
 * (anything with a `slack`) and the report is filed iff the slack is negative.
 * Returns whether it was. Blocks never call `report()` by hand.
 */
export function reportIf(plan: { readonly slack: number }, r: Omit<LayoutReport, 'deficit'>): boolean {
  if (plan.slack >= 0) return false;
  report({ ...r, deficit: -plan.slack });
  return true;
}

export function report(r: LayoutReport): void {
  for (const l of listeners) l(r);
  if (listeners.size === 0) {
    console.error(`[nisli engine ${r.code}] <${r.block}> ${r.detail} (${Math.round(r.deficit)}px short at ${Math.round(r.width)}px)`);
  }
}
