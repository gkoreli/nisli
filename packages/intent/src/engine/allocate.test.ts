import { describe, expect, it } from 'vitest';
import { allocate, type RowInput, type RowItem } from './allocate.js';

function item(id: string, max: number, extra: Partial<RowItem> = {}): RowItem {
  return { id, priority: 3, grow: false, max, min: max, ...extra };
}

function row(available: number, items: RowItem[], extra: Partial<RowInput> = {}): RowInput {
  return { available, gap: 10, trigger: 30, items, ...extra };
}

describe('allocate — it fits', () => {
  it('keeps every item at its content size when the row has room', () => {
    const plan = allocate(row(300, [item('a', 100), item('b', 80)]));
    expect(plan.state).toBe('settled');
    expect(plan.decisions.map((d) => d.action)).toEqual(['keep', 'keep']);
    expect(plan.slack).toBe(300 - 100 - 80 - 10);
    expect(plan.menu).toBe(false);
  });

  it('gives all slack to the one grower, and splits it between two', () => {
    const one = allocate(row(300, [item('a', 100, { grow: true }), item('b', 80)]));
    expect(one.decisions[0]).toEqual({ id: 'a', action: 'grow', size: 100 + 110 });
    const two = allocate(row(300, [item('a', 100, { grow: true }), item('b', 80, { grow: true })]));
    expect(two.decisions.map((d) => d.size)).toEqual([155, 135]);
  });
});

describe('allocate — giving way', () => {
  it('truncates the least important truncatable item by exactly the deficit', () => {
    const plan = allocate(row(200, [item('title', 150, { priority: 3, strategy: 'truncate', min: 40 }), item('time', 80, { priority: 5, strategy: 'truncate', min: 20 })]));
    // demand 150 + 80 + 10 = 240, deficit 40: `time` (priority 5) gives 40 of its 60 reducible.
    expect(plan.state).toBe('settled');
    expect(plan.decisions).toEqual([
      { id: 'title', action: 'keep', size: 150 },
      { id: 'time', action: 'truncate', size: 40 },
    ]);
  });

  it('spends candidates in priority order, then document order among equals', () => {
    const plan = allocate(row(100, [
      item('first', 60, { priority: 4, strategy: 'hide' }),
      item('second', 60, { priority: 4, strategy: 'hide' }),
      item('keep', 60, { priority: 1, strategy: 'hide' }),
    ]));
    // demand 60*3 + 20 = 200 vs 100. `second` (later, same priority) goes first: 130. Then `first`: 60. Fits.
    expect(plan.decisions.map((d) => d.action)).toEqual(['hide', 'hide', 'keep']);
  });

  it('charges the menu trigger once, on the first item moved to the menu', () => {
    const plan = allocate(row(150, [
      item('reply', 60, { priority: 1 }),
      item('star', 50, { priority: 4, strategy: 'menu' }),
      item('archive', 50, { priority: 4, strategy: 'menu' }),
    ]));
    // demand 160 + 20 = 180 vs 150. Move `archive`: 60+50+30(trigger) + 2 gaps = 160 — still over. Move `star`: 60+30+10 = 100. Settled.
    expect(plan.menu).toBe(true);
    expect(plan.decisions.map((d) => d.action)).toEqual(['keep', 'menu', 'menu']);
    expect(plan.slack).toBe(50);
  });

  it('skips a truncation that buys nothing rather than pretending it helped', () => {
    const plan = allocate(row(100, [item('atomic', 120, { strategy: 'truncate', min: 120 })]));
    expect(plan.decisions[0]?.action).toBe('keep');
    expect(plan.state).toBe('unsatisfiable');
  });

  it('reports unsatisfiable with the deficit when every candidate is spent', () => {
    const plan = allocate(row(50, [item('a', 100, { priority: 1 }), item('b', 40, { strategy: 'hide' })]));
    expect(plan.state).toBe('unsatisfiable');
    expect(plan.slack).toBe(-50);
    expect(plan.decisions.map((d) => d.action)).toEqual(['keep', 'hide']);
  });

  it('lets a flexible item reflow to its floor only after declared degradations are spent', () => {
    const plan = allocate(row(200, [
      item('prose', 300, { grow: true, min: 80 }),
      item('time', 60, { priority: 5, strategy: 'hide' }),
    ]));
    // demand 300 + 60 + 10 = 370 vs 200. `time` hides first (deficit 100), then prose reflows to 200.
    expect(plan.decisions).toEqual([
      { id: 'prose', action: 'reflow', size: 200 },
      { id: 'time', action: 'hide', size: 0 },
    ]);
    expect(plan.state).toBe('settled');
  });

  it('is unsatisfiable when even the floors do not fit, and says by how much', () => {
    const plan = allocate(row(50, [item('prose', 300, { grow: true, min: 80 })]));
    expect(plan.state).toBe('unsatisfiable');
    expect(plan.slack).toBe(-30);
  });

  it('is a pure function: same input, same plan', () => {
    const input = row(120, [item('a', 90, { strategy: 'truncate', min: 30 }), item('b', 60, { priority: 5, strategy: 'menu' })]);
    expect(allocate(input)).toEqual(allocate(input));
  });
});
