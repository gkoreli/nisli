/**
 * candidates.ts — candidate ordering. Pure: no DOM, no geometry.
 */

import type { Candidate } from '../contracts.js';

/**
 * Order candidates by the sequence in which they should be degraded: highest
 * priority number first, because 5 means "sacrifice this first" and 1 means
 * "this survives longest".
 *
 * The tie-break is the candidate's original index, spelled out rather than left
 * to the engine's sort stability, because ties are the common case and their
 * resolution is user-visible. An earlier pass made every button its own
 * candidate at the same priority; the order the tie happened to resolve in hid
 * Star while keeping Archive, i.e. half a control group, which reads as a bug
 * rather than as a decision. Two rules follow from that: a group that must
 * degrade together declares `data-collapse` once on the group (one candidate,
 * one decision), and equal-priority candidates degrade in declaration order,
 * deterministically, on every engine.
 *
 * Returns a new array; the input is left untouched so a caller may re-solve
 * from the same discovered set.
 */
export function orderCandidates<T>(candidates: readonly Candidate<T>[]): Candidate<T>[] {
  const order = candidates.map((_, index) => index);
  order.sort((a, b) => candidates[b]!.priority - candidates[a]!.priority || a - b);
  return order.map((index) => candidates[index]!);
}
