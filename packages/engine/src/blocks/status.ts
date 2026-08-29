import { el, signal, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import { notify } from './notice.js';

/** Structurally matches core's QueryResult<T> and ResourceResult<T>: pass either straight in. */
export interface Status {
  readonly loading: ReadonlySignal<boolean>;
  readonly error: ReadonlySignal<Error | null>;
  readonly data?: ReadonlySignal<unknown>;
  refetch?(): void;
  refresh?(): void;
}

export interface StatusView {
  pending: boolean;
  refreshing: boolean;
  failed: Error | null;
  retry?: () => void;
}

const IDLE: StatusView = { pending: false, refreshing: false, failed: null };

/** What the engine needs to know about an async result, read reactively. */
export function viewOf(s: Status | undefined): StatusView {
  if (!s) return IDLE;
  const loading = s.loading.value;
  const hasData = s.data !== undefined && s.data.value !== undefined;
  const retry = s.refetch ? () => s.refetch!() : s.refresh ? () => s.refresh!() : undefined;
  return { pending: loading && !hasData, refreshing: loading && hasData, failed: s.error.value, retry };
}

// ── Engine-drawn waiting states ───────────────────────────────────────

/** A placeholder bar. */
export const bone = (height: number, width: string | number = '100%'): TemplateResult =>
  el('div', { style: css({ height, width, display: 'block', ...look('skeleton') }) });

/** A skeleton: a group of bones announced as loading. */
export const skeleton = (bones: TemplateResult[]): TemplateResult =>
  el('div', { role: 'status', 'aria-label': 'Loading', style: css({ display: 'flex', flexDirection: 'column', gap: metrics.space[2], minWidth: 0 }) }, bones);

/** The standard block skeleton: three bars, full / 80% / 60%. */
export const blockSkeleton = (): TemplateResult =>
  skeleton([bone(metrics.control.height), bone(metrics.control.height / 2, '80%'), bone(metrics.control.height / 2, '60%')]);

/** An inline error line with a Retry when the source can be retried. */
export const failure = (error: Error, retry?: () => void): TemplateResult =>
  el('div', { role: 'alert', style: css({ display: 'flex', alignItems: 'center', gap: metrics.space[3], flexWrap: 'wrap' }) }, [
    el('span', { style: css({ minWidth: 0, ...look('tone.negative') }) }, error.message || String(error)),
    retry
      ? el('button', { type: 'button', style: css(buttonStyle('plain')), on: { click: () => retry() } }, 'Retry')
      : null,
  ]);

/** "Updating…" beside a title while fresh data is on its way. */
export const updating = (): TemplateResult =>
  el('span', { style: css({ marginLeft: metrics.space[2], font: 'inherit', ...look('text.faint') }) }, 'Updating…');

// ── Async actions ──────────────────────────────────────────────────────

/**
 * Run an action's handler; if it returns a promise, the id is busy until it
 * settles and a rejection is told to the person. Shared by every block that
 * renders an Action.
 */
export function createBusy() {
  const busy = signal<ReadonlySet<string>>(new Set());
  const is = (id: string) => busy.value.has(id);
  const run = (id: string, handler: (() => void | Promise<unknown>) | undefined) => {
    if (!handler) return;
    let result: void | Promise<unknown>;
    try { result = handler(); } catch (err) { notify(String((err as Error)?.message ?? err), 'negative'); return; }
    if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
    busy.value = new Set([...busy.value, id]);
    (result as Promise<unknown>)
      .catch((err: unknown) => notify(String((err as Error)?.message ?? err), 'negative'))
      .finally(() => { const next = new Set(busy.value); next.delete(id); busy.value = next; });
  };
  return { is, run, busy };
}
