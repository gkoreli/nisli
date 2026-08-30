import { describe, it, expect } from 'vitest';
import { fit, type FitItem } from './fit.js';

// A toolbar as the engine sees it: a title that may truncate, four actions
// that may overflow. The block ranks the primary action above the title, so the
// title gives ground before "save" ever leaves the row.
const title: FitItem = { id: 'title', width: 240, minWidth: 80, priority: 10 };
const actions: FitItem[] = [
  { id: 'share', width: 72, priority: 1, overflowable: true },
  { id: 'export', width: 80, priority: 1, overflowable: true },
  { id: 'edit', width: 60, priority: 2, overflowable: true },
  { id: 'save', width: 64, priority: 20, overflowable: true },
];
const row = (available: number) =>
  fit({ available, gap: 8, triggerWidth: 32, items: [title, ...actions] });
const of = (available: number, id: string) => row(available).decisions.find((d) => d.id === id)!;

describe('fit() decides one toolbar row at five widths', () => {
  it('1024: everything keeps its natural width', () => {
    const plan = row(1024);
    expect(plan.overflowed).toEqual([]);
    expect(plan.decisions.every((d) => d.action === 'keep')).toBe(true);
    expect(plan.slack).toBe(1024 - (240 + 72 + 80 + 60 + 64 + 4 * 8));
  });

  it('800: still fits — no decision is made that was not needed', () => {
    expect(row(800).overflowed).toEqual([]);
  });

  it('520: the two lowest-priority actions overflow, later one first', () => {
    // need 548; overflow "export" (priority 1, later) → 548-80+32 = 500 ≤ 520
    const plan = row(520);
    expect(plan.overflowed).toEqual(['export']);
    expect(of(520, 'title').action).toBe('keep');
  });

  it('420: share and export overflow, edit and save survive, title untouched', () => {
    const plan = row(420);
    expect(plan.overflowed).toEqual(['share', 'export']);
    expect(of(420, 'title').width).toBe(240);
  });

  it('320: the secondary actions overflow, then the title truncates, save stays', () => {
    const plan = row(320);
    expect(plan.overflowed).toEqual(['share', 'export', 'edit']);
    // title + save + trigger + 2 gaps = 240+64+32+16 = 352 > 320 → title shrinks by 32
    expect(of(320, 'title')).toEqual({ id: 'title', action: 'shrink', width: 208 });
    expect(of(320, 'save').action).toBe('keep');
    expect(plan.slack).toBe(0);
  });

  it('160: the title hits its minimum before the primary action gives way', () => {
    // 80 + 64 + 32 + 16 = 192 > 160 → title at min (80), then save overflows: 80+32+8 = 120
    const plan = row(160);
    expect(of(160, 'title').width).toBe(80);
    expect(plan.overflowed).toEqual(['share', 'export', 'edit', 'save']);
    expect(plan.slack).toBe(40);
  });

  it('reports an unfixable deficit rather than pretending', () => {
    expect(row(100).slack).toBeLessThan(0);
  });

  it('is pure and order-stable: overflowed ids come back in document order', () => {
    const a = row(320);
    const b = row(320);
    expect(a).toEqual(b);
    expect(a.overflowed).toEqual(['share', 'export', 'edit']);
  });

  it('the Toolbar case: a rigid primary that is not overflowable stays when even it cannot fit, and the slack says so', () => {
    // A title at its minimum beside a primary the row cannot hold: nothing overflows, the plan reports.
    const plan = fit({
      available: 150, gap: 8, triggerWidth: 32,
      items: [{ id: 'title', width: 240, minWidth: 80, priority: 10 }, { id: 'save', width: 112, priority: 20 }],
    });
    expect(plan.overflowed).toEqual([]);
    expect(plan.decisions).toEqual([{ id: 'title', action: 'shrink', width: 80 }, { id: 'save', action: 'keep', width: 112 }]);
    expect(plan.slack).toBe(150 - (80 + 8 + 112));
  });

  it('a shrink that gives exactly the deficit leaves zero slack, not float noise — a fitted row is never reported', () => {
    // The estimator's widths for "Budgets · August 2026" / "Add budget" / "⋯" at 360: the title gives 2.057 and the
    // row is exactly 328 in arithmetic, -5.7e-14 in floats — which, reported, would keep a settled screen "moving".
    const plan = fit({
      available: 328, gap: 8, triggerWidth: 37.421,
      items: [{ id: 'title', width: 174.993, minWidth: 80, priority: 10 }, { id: 'add', width: 101.643, priority: 20 }, { id: 'prev', width: 92.198, priority: 2, overflowable: true }],
    });
    expect(plan.overflowed).toEqual(['prev']);
    expect(plan.decisions.find((d) => d.id === 'title')!.action).toBe('shrink');
    expect(plan.slack).toBe(0);
    expect(Object.is(plan.slack, -0)).toBe(false);
  });

  it('does not overflow items that are not overflowable', () => {
    const plan = fit({
      available: 50, gap: 0, triggerWidth: 20,
      items: [{ id: 'a', width: 100, priority: 1 }],
    });
    expect(plan.overflowed).toEqual([]);
    expect(plan.slack).toBe(-50);
  });
});

describe('fit() stacks before it overflows', () => {
  const cols = (available: number) => fit({
    available, gap: 0, triggerWidth: 0,
    items: [
      { id: 'date', width: 72, priority: 20 },
      { id: 'payee', width: 173, minWidth: 96, priority: 20 },
      { id: 'category', width: 101, priority: 2, stackInto: 'payee', overflowable: true },
      { id: 'account', width: 72, priority: 1, stackInto: 'payee', overflowable: true },
      { id: 'amount', width: 69, priority: 20 },
    ],
  });
  it('folds the lowest column under its target instead of dropping it', () => {
    const plan = cols(420); // 487 → account (72) folds → 415
    expect(plan.overflowed).toEqual([]);
    expect(plan.stacked.get('payee')).toEqual(['account']);
    expect(plan.decisions.find((d) => d.id === 'account')).toEqual({ id: 'account', action: 'stack', width: 0, into: 'payee' });
  });
  it('keeps folding, then truncates the target, and never loses a column', () => {
    const plan = cols(300); // fold both (314), payee shrinks to 159
    expect(plan.stacked.get('payee')).toEqual(['category', 'account']);
    expect(plan.decisions.find((d) => d.id === 'payee')).toEqual({ id: 'payee', action: 'shrink', width: 159 });
    expect(plan.slack).toBe(0);
  });
  it('overflows instead when the target itself is not in the row', () => {
    const plan = fit({ available: 50, gap: 0, triggerWidth: 10, items: [
      { id: 'a', width: 60, priority: 5, overflowable: true },
      { id: 'b', width: 40, priority: 1, stackInto: 'a', overflowable: true },
    ] });
    expect(plan.overflowed).toEqual(['a', 'b']);
    expect(plan.stacked.size).toBe(0);
  });
});
