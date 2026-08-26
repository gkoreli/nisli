/**
 * candidates.test.ts — degradation order.
 *
 * Ordering is the whole authored input to fit solving: the author declares
 * `data-priority` and nothing else, so if the order is wrong the author has no
 * remaining channel through which to correct it.
 */
import { describe, expect, it } from 'vitest';
import { orderCandidates } from './candidates.js';
import type { Candidate, Priority } from '../contracts.js';

function candidate(node: string, priority: Priority): Candidate<string> {
  return { node, priority, strategy: 'hide' };
}

describe('orderCandidates', () => {
  it('degrades priority 5 first and priority 1 last', () => {
    const ordered = orderCandidates([
      candidate('body', 1),
      candidate('decoration', 5),
      candidate('timestamp', 3),
      candidate('reply', 2),
      candidate('badge', 4),
    ]);

    expect(ordered.map((c) => c.node)).toEqual(['decoration', 'badge', 'timestamp', 'reply', 'body']);
  });

  it('keeps declaration order within one priority (Star before Archive)', () => {
    // The recorded defect: Star vanished while Archive survived, though both
    // were declared priority 4. Two controls of equal importance must degrade
    // in the order the author wrote them, right-to-left in the source, or the
    // result is not reproducible between runs.
    const ordered = orderCandidates([
      candidate('star', 4),
      candidate('archive', 4),
      candidate('reply', 4),
    ]);

    expect(ordered.map((c) => c.node)).toEqual(['star', 'archive', 'reply']);
  });

  it('interleaves equal priorities without disturbing their relative order', () => {
    const ordered = orderCandidates([
      candidate('a1', 1),
      candidate('b5', 5),
      candidate('a2', 1),
      candidate('b6', 5),
      candidate('c3', 3),
    ]);

    expect(ordered.map((c) => c.node)).toEqual(['b5', 'b6', 'c3', 'a1', 'a2']);
  });

  it('does not mutate the input array', () => {
    const input: readonly Candidate<string>[] = [candidate('low', 1), candidate('high', 5)];
    const before = input.map((c) => c.node);

    orderCandidates(input);

    expect(input.map((c) => c.node)).toEqual(before);
  });

  it('returns an empty array for no candidates', () => {
    expect(orderCandidates([])).toEqual([]);
  });
});
