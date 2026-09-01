import { describe, it, expect } from 'vitest';
import { metrics } from '../metrics.js';
import { cellFloor, shellMode, dialogMode, labelColumn, labelEvery, labelWidth, pageSize, fit, columnsFor, columnBudgets, spreadSlack, textWeights, SORT_MARK_CHARS, type ColumnIntent } from './space.js';

const L = metrics.layout;

describe('space — decisions from a width', () => {
  it('re-exports the fit and columns decisions', () => {
    expect(typeof fit).toBe('function');
    expect(columnsFor(928, 4, 220, 16)).toBe(4);
  });

  it('cellFloor: a grid cell is never narrower than a card around the narrowest table — derived, so it cannot disagree with the table floor (ADR 0046)', () => {
    // comfortable: card padding 2×16 + a figure column (12 × 7.2 + 2×12) + minTextColumn 96
    expect(cellFloor()).toBeCloseTo(32 + 110.4 + 96);
    // compact: the same arithmetic over compact spacing — a smaller floor, more cells fit
    expect(cellFloor(L, 7.2, { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 24 })).toBeCloseTo(24 + 102.4 + 96);
    // a wider figure budget or text floor moves the cell floor with it — one source of truth
    expect(cellFloor({ ...L, figureChars: 14 })).toBeCloseTo(32 + 124.8 + 96);
    expect(cellFloor({ ...L, minTextColumn: 120 })).toBeCloseTo(32 + 110.4 + 120);
  });

  it('shellMode: a sidebar iff a useful content column fits beside it; unmeasured is roomy', () => {
    const edge = L.sidebarWidth + L.contentMin;
    expect(shellMode(0)).toBe('sidebar');
    expect(shellMode(edge)).toBe('sidebar');
    expect(shellMode(edge - 1)).toBe('bar');
    expect(shellMode(360)).toBe('bar');
  });

  it('dialogMode: a sheet below dialogMin, a card at it and above; unmeasured is a card', () => {
    expect(dialogMode(0)).toBe('card');
    expect(dialogMode(L.dialogMin)).toBe('card');
    expect(dialogMode(L.dialogMin - 1)).toBe('sheet');
    expect(dialogMode(360)).toBe('sheet');
  });

  it('labelWidth: characters by glyph width plus a breath; padding and glyph width may be passed', () => {
    expect(labelWidth('')).toBe(metrics.space[2]);
    expect(labelWidth('abcd')).toBe(4 * metrics.charWidth + metrics.space[2]);
    expect(labelWidth('abcd', 24)).toBe(4 * metrics.charWidth + 24);
    expect(labelWidth('abcd', 0, 8)).toBe(32);
  });

  it('every threshold decision takes an explicit layout, so a test can pass its own numbers (the axes never move layout — ADR 0046)', () => {
    const tight = { ...L, sidebarWidth: 100, contentMin: 100, dialogMin: 300, minLabel: 10 };
    expect(shellMode(200, tight)).toBe('sidebar');
    expect(shellMode(199, tight)).toBe('bar');
    expect(dialogMode(299, tight)).toBe('sheet');
    expect(dialogMode(300, tight)).toBe('card');
    expect(labelColumn(120, 200, tight)).toBe(40);
    expect(pageSize(0, 100, 25)).toEqual({ remaining: 100, next: 25 });
  });

  it('labelColumn: natural when unmeasured, else at most a third, never below the minimum', () => {
    expect(labelColumn(0, 200)).toBe(200);
    expect(labelColumn(900, 200)).toBe(200);           // a third (300) has room
    expect(labelColumn(300, 200)).toBe(100);           // a third
    expect(labelColumn(120, 200)).toBe(L.minLabel);    // a third (40) is below the floor
    expect(labelColumn(120, 50)).toBe(50);             // shorter than the floor: natural
  });

  it('labelEvery: one label per slot when they fit, every nth otherwise, never below 1', () => {
    expect(labelEvery(100, 60)).toBe(1);
    expect(labelEvery(60, 60)).toBe(1);
    expect(labelEvery(59, 60)).toBe(2);
    expect(labelEvery(33.3, 60)).toBe(2);
    expect(labelEvery(30, 60)).toBe(2);
    expect(labelEvery(29, 60)).toBe(3);
    expect(labelEvery(0, 60)).toBe(60);                // a zero slot is treated as one px
  });

  it('pageSize: how many remain and how many the next request reveals', () => {
    expect(pageSize(60, 150)).toEqual({ remaining: 90, next: L.tablePage });
    expect(pageSize(120, 150)).toEqual({ remaining: 30, next: 30 });
    expect(pageSize(150, 150)).toEqual({ remaining: 0, next: 0 });
    expect(pageSize(200, 150)).toEqual({ remaining: 0, next: 0 });
  });
});

describe('columnBudgets — the tenet as arithmetic (ADR 0044): naturals from kind, label and share, never from rows', () => {
  const cw = metrics.charWidth;                          // 7.2
  const pad = 2 * metrics.space[3];                      // 24
  const cols: ColumnIntent[] = [
    { id: 'date', label: 'Date', kind: 'date', priority: 'primary' },
    { id: 'payee', label: 'Payee', priority: 'primary' },
    { id: 'category', label: 'Category' },
    { id: 'note', label: 'Note', priority: 'tertiary' },
    { id: 'amount', label: 'Amount', kind: 'money', priority: 'primary' },
  ];
  const DATE = L.dateChars * cw + pad;                   // 81.6
  const MONEY = L.figureChars * cw + pad;                // 110.4

  it('dates and figures get character budgets, rigid (no minWidth): they never truncate', () => {
    const b = columnBudgets(cols, 1000);
    expect(b[0]).toEqual({ id: 'date', width: DATE });
    expect(b[4]).toEqual({ id: 'amount', width: MONEY });
  });

  it('text columns share the remainder by weight (primary double), capped, with minWidth at the text floor', () => {
    const b = columnBudgets(cols, 1000);
    const remainder = 1000 - DATE - MONEY;               // 808, over weights 2+1+1
    expect(b[1]!.width).toBe(L.textColumnCap);           // payee: 404 capped at 320
    expect(b[1]!.minWidth).toBe(L.minTextColumn);
    expect(b[2]!.width).toBeCloseTo(remainder / 4);      // category: 202
  });

  it('below the floor every text share pins at minTextColumn — the same at any narrow width, so the floor cannot move either', () => {
    for (const w of [400, 300, 200, 100]) {
      const b = columnBudgets(cols, w);
      expect(b[2]!.width).toBe(L.minTextColumn);
      expect(b[2]!.minWidth).toBe(L.minTextColumn);
    }
  });

  it('a header label floors its column (a label is intent), and a sortable column reserves the sort mark whether or not it is sorted — there is no sort input at all', () => {
    const long: ColumnIntent[] = [{ id: 'total', label: 'Total amount', kind: 'money', sortable: true }];
    expect(columnBudgets(long, 500)[0]!.width).toBeCloseTo('Total amount'.length * cw + pad + SORT_MARK_CHARS * cw); // 124.8 > the figure budget
    const plain: ColumnIntent[] = [{ id: 'total', label: 'Total amount', kind: 'money' }];
    expect(columnBudgets(plain, 500)[0]!.width).toBeCloseTo('Total amount'.length * cw + pad); // the label floor alone
  });

  it('unmeasured (0) is roomy: every text column at its cap', () => {
    expect(columnBudgets(cols, 0)[1]!.width).toBe(L.textColumnCap);
    expect(columnBudgets(cols, 0)[2]!.width).toBe(L.textColumnCap);
  });

  it('every budget takes an explicit layout, so a test can pass its own numbers (the axes never move layout — ADR 0046)', () => {
    const tight = { ...L, dateChars: 6, figureChars: 8, minTextColumn: 40, textColumnCap: 100 };
    const b = columnBudgets(cols, 300, tight);
    expect(b[0]!.width).toBeCloseTo(Math.max(6 * cw + pad, labelWidth('Date', pad, cw)));
    expect(b[2]!.width).toBeCloseTo(labelWidth('Category', pad, cw)); // the label floor beats the tight share floor (40)
  });

  it('spreadSlack: the leftover goes to the surviving weighted columns; unweighted and folded ones keep their widths; no slack, no change', () => {
    const plan = fit({ available: 500, gap: 0, triggerWidth: 0, items: [
      { id: 'a', width: 100, priority: 2 },
      { id: 'b', width: 100, priority: 1 },
    ] });
    expect(plan.slack).toBe(300);
    const spread = spreadSlack(plan, new Map([['b', 1], ['gone', 5]]));
    expect(spread.get('a')).toBe(100);
    expect(spread.get('b')).toBe(400);
    expect(spread.has('gone')).toBe(false);
    const none = spreadSlack(plan, new Map());
    expect([...none.values()]).toEqual([100, 100]);
  });

  it('textWeights: primary text 2, other text 1, figures and dates none — the weights spreadSlack shares by', () => {
    expect([...textWeights(cols)]).toEqual([['payee', 2], ['category', 1], ['note', 1]]);
  });
});
