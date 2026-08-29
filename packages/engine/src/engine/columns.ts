/**
 * How many columns a width affords, given the narrowest useful cell.
 * Pure; used by Grid and Form.
 */
export function columnsFor(width: number, count: number, minColumn: number, gap: number): number {
  if (count <= 0 || width <= 0) return 1;
  const fit = Math.floor((width + gap) / (minColumn + gap));
  return Math.max(1, Math.min(count, fit));
}
