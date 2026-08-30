/**
 * Paging — a long list is a decision, not a scroll. Pure: numbers in, data
 * out. Table shows `metrics.layout.tablePage` rows, then asks.
 */
import { metrics } from '../metrics.js';

/**
 * Given how many rows are shown and how many exist: how many remain and how
 * many the next request reveals (`page`, default `metrics.layout.tablePage`).
 */
export function pageSize(shown: number, total: number, page: number = metrics.layout.tablePage): { readonly remaining: number; readonly next: number } {
  const remaining = Math.max(0, total - shown);
  return { remaining, next: Math.min(page, remaining) };
}
