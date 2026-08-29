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

export function report(r: LayoutReport): void {
  for (const l of listeners) l(r);
  if (listeners.size === 0) {
    console.error(`[nisli engine ${r.code}] <${r.block}> ${r.detail} (${Math.round(r.deficit)}px short at ${Math.round(r.width)}px)`);
  }
}
