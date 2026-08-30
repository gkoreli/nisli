/**
 * Layout reports — the engine saying, in data, "I could not satisfy this".
 *
 * A block that decides a layout reports when the decision is unsatisfiable:
 * primaries that cannot fit, a title at its minimum that still overflows, a
 * cell narrower than its minimum. Silence means every plan was satisfied.
 * `prove()` collects these; in dev they also reach the console as diagnostics,
 * the block's host is stamped `data-nisli-report="CODE"` while the plan stays
 * unsatisfied (cleared when it is), and `window.__nisli.reports` keeps the
 * last `RING` of them — evidence a browser runner (`@nisli/engine/verify`)
 * can read without a listener. `window.__nisli` is created when the engine
 * loads in dev, so its absence means a build without the evidence.
 */
import { isDev } from './dev.js';

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

/** A listener sees every report as it is filed, with the block's host when the block gave one. */
type Listener = (r: LayoutReport, host?: Element | null) => void;
const listeners = new Set<Listener>();

export function onReport(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The attribute a block's host carries in dev while one of its plans is unsatisfied. */
export const REPORT_ATTR = 'data-nisli-report';
/**
 * The attribute a decided block carries in dev: its structural decisions as a
 * canonical string (decisions as data, the same channel as the report stamp).
 * `prove()` diffs it between mounts of the same screen with the data
 * perturbed — the `DECISION_UNSTABLE` claim (ADR 0044).
 */
export const PLAN_ATTR = 'data-nisli-plan';

/** Stamp a block's structural decisions on its host (dev only). */
export function stampPlan(host: Element | null | undefined, plan: string): void {
  if (host && isDev()) host.setAttribute(PLAN_ATTR, plan);
}
/** How many reports the dev ring buffer keeps. */
export const RING = 200;

interface NisliGlobal { __nisli?: { reports: LayoutReport[]; dev: true } }

/**
 * The dev ring buffer on `window.__nisli.reports`; null outside dev or outside a
 * window. `window.__nisli` exists from the moment the engine loads in dev — with
 * `dev: true` — so a runner can tell "no reports" from "the evidence was compiled
 * out" (a production build has no `__nisli` at all).
 */
export function reportRing(): LayoutReport[] | null {
  if (!isDev() || typeof window === 'undefined') return null;
  const w = window as unknown as NisliGlobal;
  return (w.__nisli ??= { reports: [], dev: true }).reports;
}
reportRing();

/**
 * The one way a block reports an unsatisfiable decision: hand it the plan
 * (anything with a `slack`) and the report is filed iff the slack is negative.
 * Returns whether it was. Blocks never call `report()` by hand. Given the
 * block's `host`, dev mode stamps it with the code while the plan is
 * unsatisfied and clears the stamp once it is.
 */
export function reportIf(plan: { readonly slack: number }, r: Omit<LayoutReport, 'deficit'>, host?: Element | null): boolean {
  const filed = plan.slack < 0;
  if (filed) report({ ...r, deficit: -plan.slack }, host);
  if (host && isDev()) {
    if (filed) host.setAttribute(REPORT_ATTR, r.code);
    else if (host.getAttribute(REPORT_ATTR) === r.code) host.removeAttribute(REPORT_ATTR);
  }
  return filed;
}

export function report(r: LayoutReport, host?: Element | null): void {
  for (const l of listeners) l(r, host);
  const ring = reportRing();
  if (ring) { ring.push(r); if (ring.length > RING) ring.splice(0, ring.length - RING); }
  if (listeners.size === 0) {
    console.error(`[nisli engine ${r.code}] <${r.block}> ${r.detail} (${Math.round(r.deficit)}px short at ${Math.round(r.width)}px)`);
  }
}
