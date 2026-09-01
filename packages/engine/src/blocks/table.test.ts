/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { flushEffects, html } from '@nisli/core';
import { type Column, type Sort } from './table.js';
import { focusables } from './kernel.js';
import { onReport, type LayoutReport } from '../engine/report.js';
import { setMeasurer } from '../engine/measure.js';
import { metrics } from '../metrics.js';
import { accessibleName, accessibleNames, sortReachable, overflowText } from '../test/claims.js';
import { estimator } from '../test/estimate.js';
import { mount as mountBlock, type Mounted } from '../test/mount.js';
import { setDensity, setInput } from '../engine/axes.js';

interface Row { id: string; date: string; payee: string; category: string; account: string; note: string; amount: number }
const columns: Column<Row>[] = [
  { id: 'date', label: 'Date', kind: 'date', cell: (r) => r.date, priority: 'primary' },
  { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
  { id: 'category', label: 'Category', cell: (r) => r.category },
  { id: 'account', label: 'Account', cell: (r) => r.account, priority: 'tertiary' },
  { id: 'note', label: 'Note', cell: (r) => r.note, priority: 'tertiary' },
  { id: 'amount', label: 'Amount', kind: 'money', cell: (r) => r.amount, priority: 'primary' },
];
// Budgets (ADR 0044), never measurements: date 8ch → 81.6, money 12ch → 110.4 (rigid Σ 192);
// the four text columns share the remainder by weight (payee, primary, ×2; Σ weights 5),
// each clamped to [minTextColumn 96, textColumnCap 320].
const DATE = metrics.layout.dateChars * metrics.charWidth + 2 * metrics.space[3];      // 81.6
const MONEY = metrics.layout.figureChars * metrics.charWidth + 2 * metrics.space[3];   // 110.4
const rows: Row[] = [{ id: '1', date: 'Aug 1', payee: 'REI', category: 'Shopping', account: 'Card', note: '', amount: -12 }];

let mounted: Mounted | undefined;
afterEach(() => { mounted?.unmount(); mounted = undefined; });

const shownOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('thead th')].filter((th) => th.style.display !== 'none').map((th) => th.textContent);

function mount(width: number, rowsIn: readonly Row[] = rows) {
  const t = (mounted = mountBlock('nisli-table', { columns, rows: rowsIn, rowKey: (r: Row) => r.id }, { width }));
  return {
    shown: () => shownOf(t.el),
    cells: () => [...t.el.querySelectorAll<HTMLElement>('tbody td')].filter((td) => td.style.display !== 'none').length,
    el: t.el,
    resize: t.resize,
  };
}

describe('Table drops columns by priority — from budgets, never from cells', () => {
  it('1000: every column, and the slack widens the text columns so the row sums to the width', () => {
    const t = mount(1000);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Category', 'Account', 'Note', 'Amount']);
    const widths = [...t.el.querySelectorAll<HTMLElement>('thead th')].map((th) => parseFloat(th.style.width));
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(1000);
    expect(widths[0]).toBeCloseTo(DATE);
    expect(widths[5]).toBeCloseTo(MONEY);
  });
  it('640: the later tertiary folds first', () => {
    // remainder 448 → payee 179.2, others floored at 96: Σ 659.2 > 640 → Note folds.
    expect(mount(640).shown()).toEqual(['Date', 'Payee', 'Category', 'Account', 'Amount']);
  });
  it('480: both tertiaries', () => {
    // 192 + 115.2 + 3×96 = 595.2 > 480; folding Note and Account pays the deficit.
    expect(mount(480).shown()).toEqual(['Date', 'Payee', 'Category', 'Amount']);
  });
  it('360: nothing is lost — dropped columns fold under the primary text cell', () => {
    const t = mount(360);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    expect(t.cells()).toBe(3);
    const payee = t.el.querySelectorAll<HTMLElement>('tbody td')[1]!;
    expect(payee.textContent).toBe('REIShopping · Card');
  });
  it('360: the surviving columns are pinned — budgets plus the slack, under a fixed table layout', () => {
    const t = mount(360);
    const ths = [...t.el.querySelectorAll<HTMLElement>('thead th')].filter((th) => th.style.display !== 'none');
    expect(parseFloat(ths[0]!.style.width)).toBeCloseTo(DATE);
    // payee: floor 96 + all the slack (360 − 192 − 96 = 72) — the row sums to the width
    expect(parseFloat(ths[1]!.style.width)).toBeCloseTo(360 - DATE - MONEY);
    expect(parseFloat(ths[2]!.style.width)).toBeCloseTo(MONEY);
    expect(ths[1]!.style.textOverflow).toBe('ellipsis');
    expect(t.el.querySelector<HTMLElement>('table')!.style.tableLayout).toBe('fixed');
    expect(t.el.querySelector<HTMLElement>('table')!.style.width).toBe('100%');
  });
  it('280: the primaries alone exceed the width — FIT_COLUMNS is filed and they stay', () => {
    const filed: LayoutReport[] = [];
    const stop = onReport((r) => filed.push(r));
    const t = mount(280);
    // date 81.6 + payee 96 (its floor) + amount 110.4 = 288 > 280
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    expect(filed.map((r) => r.code)).toContain('FIT_COLUMNS');
    stop();
  });

  it('re-decides when the frame widens again', async () => {
    const t = mount(360);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    t.resize(1000);
    await Promise.resolve(); flushEffects();
    expect(t.shown().length).toBe(6);
  });

  it('a row lights up only while hovered, through the skin part', () => {
    mounted = mountBlock('nisli-table', { columns, rows, rowKey: (r: Row) => r.id }, { width: 1000, scheme: 'light' });
    const tr = mounted.el.querySelector<HTMLElement>('tbody tr')!;
    const before = tr.getAttribute('style');
    tr.dispatchEvent(new Event('pointerenter'));
    flushEffects();
    expect(tr.getAttribute('style')).not.toBe(before);
    tr.dispatchEvent(new Event('pointerleave'));
    flushEffects();
    expect(tr.getAttribute('style')).toBe(before);
  });
});

describe('Table aligns mixed content by semantic kind', () => {
  it('keeps an action column rigid and centred while text columns receive the remaining width', () => {
    const mixed: Column<Row>[] = [
      { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
      { id: 'category', label: 'Category', cell: (r) => r.category },
      { id: 'actions', label: 'Actions', kind: 'action', cell: () => html`<button aria-label="Edit">E</button>`, priority: 'primary' },
    ];
    mounted = mountBlock('nisli-table', { columns: mixed, rows, rowKey: (r: Row) => r.id }, { width: 1000 });
    const ths = [...mounted.el.querySelectorAll<HTMLElement>('thead th')];
    const tds = [...mounted.el.querySelectorAll<HTMLElement>('tbody td')];
    const actionWidth = Math.max(
      metrics.control.hit + 2 * metrics.space[3],
      'Actions'.length * metrics.charWidth + 2 * metrics.space[3],
    );
    expect(parseFloat(ths[2]!.style.width)).toBeCloseTo(actionWidth);
    expect(ths[2]!.style.textAlign).toBe('center');
    expect(tds[2]!.style.textAlign).toBe('center');
    expect(ths.every((th) => th.style.verticalAlign === 'middle')).toBe(true);
    expect(tds.every((td) => td.style.verticalAlign === 'middle')).toBe(true);
    expect(ths.map((th) => parseFloat(th.style.width)).reduce((a, b) => a + b, 0)).toBeCloseTo(1000);
  });
});

describe('Table is reachable by keyboard (ADR 0042 b)', () => {
  const key = (k: string, target: Element, init: KeyboardEventInit = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); target.dispatchEvent(e); flushEffects(); return e; };
  // Enter/Space on a focused native button is a click: happy-dom does not synthesise it, so the proof does what the browser would.
  const activate = (k: 'Enter' | ' ') => { const b = document.activeElement as HTMLElement; key(k, b); b.click(); flushEffects(); };
  const sortable: Column<Row>[] = columns.map((c) => (c.id === 'date' || c.id === 'amount' ? { ...c, sortable: true } : c));

  it('a sortable header is a button a keyboard reaches; Enter sorts ascending, Space flips to descending, aria-sort follows on the th', () => {
    const sorts: Sort[] = [];
    // The app owns the sort: onSort hands the engine the new one, as a screen would.
    mounted = mountBlock('nisli-table', { columns: sortable, rows, rowKey: (r: Row) => r.id, onSort: (s: Sort) => { sorts.push(s); (mounted!.el as any)._setProp('sort', s); } }, { width: 1000 });
    const ths = [...mounted.el.querySelectorAll<HTMLElement>('thead th')];
    expect(ths.map((th) => !!th.querySelector('button'))).toEqual([true, false, false, false, false, true]);
    const order = focusables(mounted.el);
    expect(order[0]).toBe(ths[0]!.querySelector('button'));         // the first Tab stop in the table is the Date header
    order[0]!.focus();
    expect(document.activeElement).toBe(ths[0]!.querySelector('button'));
    expect(accessibleName(document.activeElement!)).toBe('Date');
    activate('Enter');
    expect(sorts).toEqual([{ by: 'date', order: 'asc' }]);
    expect(ths[0]!.getAttribute('aria-sort')).toBe('ascending');
    expect(ths[0]!.querySelector('[aria-hidden=true]')!.textContent).toBe(' ↑');
    activate(' ');
    expect(sorts).toEqual([{ by: 'date', order: 'asc' }, { by: 'date', order: 'desc' }]);
    expect(ths[0]!.getAttribute('aria-sort')).toBe('descending');
    expect(ths[1]!.hasAttribute('aria-sort')).toBe(false);
    expect(ths[0]!.style.cursor).not.toBe('pointer');               // the pointer affordance is the button's, not the cell's
    expect(ths[0]!.querySelector<HTMLElement>('button')!.style.cursor).toBe('pointer');
    expect(sortReachable.check(mounted.el, estimator(1000))).toEqual([]);
  });

  it('a selectable row is a named tab stop after the headers; Enter and Space each select once, Space without scrolling the page; focus lights it up', () => {
    const selected: Row[] = [];
    mounted = mountBlock('nisli-table', { columns: sortable, rows, rowKey: (r: Row) => r.id, onOpen: (r: Row) => selected.push(r) }, { width: 1000, scheme: 'light' });
    const order = focusables(mounted.el);
    const tr = mounted.el.querySelector<HTMLElement>('tbody tr')!;
    expect(order[2]).toBe(tr);                                      // Date, Amount headers, then the row
    const before = tr.getAttribute('style');
    tr.focus(); flushEffects();
    expect(document.activeElement).toBe(tr);
    expect(accessibleName(tr)).toBe('Aug 1');                       // named by its first primary cell
    expect(document.getElementById(tr.getAttribute('aria-labelledby')!)!.tagName).toBe('TD');
    expect(tr.getAttribute('style')).not.toBe(before);              // the hover part, while focused
    const enter = key('Enter', tr);
    expect(selected.length).toBe(1);
    expect(enter.defaultPrevented).toBe(true);                      // no keypress reaches the field the selection focuses
    const space = key(' ', tr);
    expect(selected.length).toBe(2);
    expect(space.defaultPrevented).toBe(true);
    expect(key('a', tr).defaultPrevented).toBe(false);
    expect(selected.length).toBe(2);
    tr.blur(); flushEffects();
    expect(tr.getAttribute('style')).toBe(before);
    expect(accessibleNames.check(mounted.el, estimator(1000))).toEqual([]);
  });

  it('a control inside a cell keeps its own keys: Space on it is not prevented and does not select the row; on the row it does', () => {
    const selected: Row[] = [];
    const withControl: Column<Row>[] = columns.map((c) => (c.id === 'note' ? { ...c, cell: () => html`<button id="in">x</button>` } : c));
    mounted = mountBlock('nisli-table', { columns: withControl, rows, rowKey: (r: Row) => r.id, onOpen: (r: Row) => selected.push(r) }, { width: 1000 });
    const tr = mounted.el.querySelector<HTMLElement>('tbody tr')!;
    const inner = mounted.el.querySelector<HTMLElement>('#in')!;
    expect(focusables(mounted.el)).toContain(inner);
    inner.focus();
    expect(key(' ', inner).defaultPrevented).toBe(false);
    expect(key('Enter', inner).defaultPrevented).toBe(false);
    expect(selected.length).toBe(0);
    tr.focus();
    expect(key(' ', tr).defaultPrevented).toBe(true);
    expect(selected.length).toBe(1);
  });

  it('the whole header cell sorts (it is the target\'s box): a tap beside the label sorts once, and the button\'s own click bubbles to it once', () => {
    const sorts: Sort[] = [];
    mounted = mountBlock('nisli-table', { columns: sortable, rows, rowKey: (r: Row) => r.id, onSort: (s: Sort) => { sorts.push(s); (mounted!.el as any)._setProp('sort', s); } }, { width: 1000 });
    const th = mounted.el.querySelector<HTMLElement>('thead th')!;
    th.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sorts).toEqual([{ by: 'date', order: 'asc' }]);
    th.querySelector('button')!.click();
    expect(sorts).toEqual([{ by: 'date', order: 'asc' }, { by: 'date', order: 'desc' }]);
    // A cell that is not sortable has no handler: a tap on it sorts nothing.
    mounted.el.querySelectorAll<HTMLElement>('thead th')[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sorts).toHaveLength(2);
  });

  it('a table without onOpen has no focusable rows and no row names; without sortable no header buttons', () => {
    mounted = mountBlock('nisli-table', { columns, rows, rowKey: (r: Row) => r.id }, { width: 1000 });
    expect(mounted.el.querySelector('tbody tr')!.hasAttribute('tabindex')).toBe(false);
    expect(mounted.el.querySelector('tbody tr')!.hasAttribute('aria-labelledby')).toBe(false);
    expect(mounted.el.querySelectorAll('thead button').length).toBe(0);
    expect(focusables(mounted.el)).toEqual([]);
  });

  it('row ids come from a counter, so a keyed reorder keeps every id unique', () => {
    const two = [...rows, { id: '2', date: 'Aug 2', payee: 'Uber', category: 'Transport', account: 'Card', note: '', amount: -7 }];
    mounted = mountBlock('nisli-table', { columns, rows: two, rowKey: (r: Row) => r.id, onOpen: () => {} }, { width: 1000 });
    const ids = () => [...mounted!.el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) => tr.getAttribute('aria-labelledby'));
    const first = ids();
    (mounted.el as any)._setProp('rows', [two[1], two[0]]); flushEffects();
    expect(ids()).toEqual([first[1], first[0]]);                    // the elements moved with their rows
    expect(new Set(ids()).size).toBe(2);
    expect([...mounted.el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) => accessibleName(tr))).toEqual(['Aug 2', 'Aug 1']);
  });
});

describe('Table column decisions are a function of width and intent, never of the rows shown (tenet, ADR 0044)', () => {
  const many: Row[] = Array.from({ length: 70 }, (_, i) => ({
    id: String(i), date: `Aug ${(i % 28) + 1}`, payee: `Payee ${i}`, category: 'Shopping', account: 'Card', note: '', amount: -(i + 1),
  }));
  // Row 65 sits beyond the first page (tablePage = 60) and carries a very long payee.
  many[65] = { ...many[65]!, payee: 'AMAZON MARKETPLACE PAYMENTS AMZN.COM/BILL WA — order 112-4491883-2201014 (marketplace seller)', amount: -9999 };
  const sorted = [...many].sort((a, b) => a.amount - b.amount);
  // A rows change lands on a microtask; nothing may re-solve, but let anything that would.
  const settle = async () => { flushEffects(); await Promise.resolve(); await Promise.resolve(); flushEffects(); };

  it('768: sorting by Amount brings a long payee onto the page; the visible header set must not change', async () => {
    mounted = mountBlock('nisli-table', { columns, rows: many, rowKey: (r: Row) => r.id }, { width: 768, measure: estimator(768) });
    const before = shownOf(mounted.el);
    expect(before).toContain('Payee');
    expect(before).toContain('Category');
    expect(before).toContain('Account');
    expect(before).toContain('Amount');
    // Sort by amount descending (largest debit first): row 65 enters the page.
    (mounted.el as any)._setProp('rows', sorted);
    await settle();
    expect([...mounted.el.querySelectorAll('tbody tr')].some((tr) => tr.textContent!.includes('AMAZON MARKETPLACE'))).toBe(true);
    // The tenet: a layout decision depends on width and intent, never on which data is shown.
    expect(shownOf(mounted.el)).toEqual(before);
    // And it must not change back either.
    (mounted.el as any)._setProp('rows', many);
    await settle();
    expect(shownOf(mounted.el)).toEqual(before);
  });

  it('at every width, the header set and the pinned widths are the same for any rows: sorted, paged, one row, none', async () => {
    for (const width of [1280, 1024, 768, 480, 360]) {
      const snapshot = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('thead th')].map((th) => `${th.textContent}:${th.style.display}:${th.style.width}`);
      const base = mountBlock('nisli-table', { columns, rows: many, rowKey: (r: Row) => r.id }, { width });
      const expected = snapshot(base.el);
      // …after paging: "Show 10 more of 10" reveals the long payee
      [...base.el.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent!.startsWith('Show'))!.click();
      await settle();
      expect(base.el.querySelectorAll('tbody tr').length).toBe(70);
      expect(snapshot(base.el), `paged at ${width}`).toEqual(expected);
      base.unmount();
      // …with the rows sorted, with one row, with none
      for (const data of [sorted, many.slice(0, 1), [] as Row[]]) {
        const t = mountBlock('nisli-table', { columns, rows: data, rowKey: (r: Row) => r.id }, { width });
        await settle();
        expect(snapshot(t.el), `rows ${data.length} at ${width}`).toEqual(expected);
        t.unmount();
      }
    }
  });

  it('a figure wider than its budget truncates and files FIGURE_TRUNCATED — the column does not widen', () => {
    const wide: Column<Row>[] = columns.map((c) => (c.id === 'amount' ? { ...c, cell: () => '-$123,456,789.00' } : c));
    mounted = mountBlock('nisli-table', { columns: wide, rows, rowKey: (r: Row) => r.id }, { width: 768, measure: estimator(768) });
    const amountTh = [...mounted.el.querySelectorAll<HTMLElement>('thead th')].at(-1)!;
    expect(parseFloat(amountTh.style.width)).toBeCloseTo(MONEY);   // the budget stands
    const claims = overflowText.check(mounted.frame, estimator(768));
    expect(claims.map((c) => c.code)).toContain('FIGURE_TRUNCATED');
    expect(claims.find((c) => c.code === 'FIGURE_TRUNCATED')!.detail).toContain('-$123,456,789.00');
  });

  it('a sortable header reserves its sort mark, so the sorted column is exactly as wide as the unsorted one', async () => {
    const sortable: Column<Row>[] = columns.map((c) => (c.id === 'amount' ? { ...c, label: 'Total amount', sortable: true } : c));
    mounted = mountBlock('nisli-table', { columns: sortable, rows, rowKey: (r: Row) => r.id }, { width: 1000 });
    const widthsOf = () => [...mounted!.el.querySelectorAll<HTMLElement>('thead th')].map((th) => th.style.width);
    const before = widthsOf();
    // label floor (12ch + padding) + the reserved mark (2ch) — wider than the figure budget, sorted or not
    expect(parseFloat(before.at(-1)!)).toBeCloseTo(12 * metrics.charWidth + 2 * metrics.space[3] + 2 * metrics.charWidth);
    (mounted.el as any)._setProp('sort', { by: 'amount', order: 'asc' });
    await settle();
    expect(widthsOf()).toEqual(before);
    expect(shownOf(mounted.el).at(-1)).toContain('Total amount');
  });

  it('a rows change causes zero solves: the engine never re-measures, and the styles stand', async () => {
    mounted = mountBlock('nisli-table', { columns, rows: many, rowKey: (r: Row) => r.id }, { width: 768 });
    const before = [...mounted.el.querySelectorAll<HTMLElement>('thead th')].map((th) => th.getAttribute('style'));
    let hostMeasures = 0;
    const host = mounted.el;
    setMeasurer((node) => { if (node === host) hostMeasures++; return node === host ? 768 : 0; });
    (mounted.el as any)._setProp('rows', sorted);
    await settle();
    expect(hostMeasures).toBe(0);   // a solve reads measure(host); none ran
    expect([...mounted.el.querySelectorAll<HTMLElement>('thead th')].map((th) => th.getAttribute('style'))).toEqual(before);
  });
});

// ADR 0046 §3: `hit` floors the targets that are not controls — the row and the header cell — and the axes are live.
describe('Table under the axes (ADR 0046)', () => {
  afterEach(() => { setInput('system'); setDensity('system'); });
  // Three primaries at 800: the exact inline styles of 0.9.0, recorded from HEAD before this round — the default is byte-identical
  // except the `th`, which gains `height:24px` (the pointer floor, below its rendered height; the ADR accepts it).
  const three: Column<Row>[] = [
    { id: 'date', label: 'Date', kind: 'date', cell: (r) => r.date, priority: 'primary', sortable: true },
    { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
    { id: 'amount', label: 'Amount', kind: 'money', cell: (r) => r.amount, priority: 'primary' },
  ];
  const cell = (align: string, nums: string, width: string, head: boolean) =>
    `display:table-cell;text-align:${align};vertical-align:middle;font-variant-numeric:${nums};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0px;box-sizing:border-box;width:${width};padding:8px 12px;user-select:${head ? 'none' : 'auto'};font:inherit`;
  const up = (w = 800) => (mounted = mountBlock('nisli-table', { columns: three, rows, rowKey: (r: Row) => r.id }, { width: w }));
  const ths = (t: Mounted) => [...t.el.querySelectorAll<HTMLElement>('thead th')];
  const tr = (t: Mounted) => t.el.querySelector<HTMLElement>('tbody tr')!;
  const td = (t: Mounted) => t.el.querySelector<HTMLElement>('tbody td')!;

  it('the default is byte-identical to 0.9.0 — only the th gains height:24px; the sort button keeps its box', () => {
    const t = up();
    expect(ths(t).map((th) => th.getAttribute('style'))).toEqual([
      `${cell('left', 'tabular-nums', '81.6px', true)};height:24px`,
      `${cell('left', 'normal', '608px', true)};height:24px`,
      `${cell('right', 'tabular-nums', '110.4px', true)};height:24px`,
    ]);
    expect(td(t).getAttribute('style')).toBe(cell('left', 'tabular-nums', '81.6px', false));
    expect(tr(t).getAttribute('style')).toBe('cursor:default;height:24px');
    expect(t.el.querySelector<HTMLElement>('th button')!.getAttribute('style')).toBe(
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0px;display:inline-block;width:100%;max-width:100%;box-sizing:border-box;padding:0px;margin:0px;font:inherit;color:inherit;text-align:inherit;background:none;border:none;border-radius:0px;cursor:pointer',
    );
  });

  it('touch: the row and every header cell (sortable or not) are 44px; a cell\'s padding does not move; the sort button has no height of its own', () => {
    setInput('touch');
    const t = up();
    expect(tr(t).style.height).toBe('44px');
    expect(ths(t).map((th) => th.style.height)).toEqual(['44px', '44px', '44px']);
    expect(td(t).style.padding).toBe('8px 12px');
    expect(t.el.querySelector<HTMLElement>('th button')!.style.height).toBe('');
    expect(t.el.querySelector<HTMLElement>('th button')!.style.minHeight).toBe('');
  });

  it('compact: a cell is padded 6px 8px, the floors stay at 24px', () => {
    setDensity('compact');
    const t = up();
    expect(td(t).style.padding).toBe('6px 8px');
    expect(ths(t)[0]!.style.padding).toBe('6px 8px');
    expect(tr(t).style.height).toBe('24px');
  });

  it('the flip is live: a mounted table follows setInput and setDensity without a remount, and never resets its paging', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ id: String(i), date: 'Aug 1', payee: `P${i}`, category: 'c', account: 'a', note: '', amount: i }));
    mounted = mountBlock('nisli-table', { columns: three, rows: many, rowKey: (r: Row) => r.id }, { width: 800 });
    const t = mounted;
    const more = [...t.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Show'))!;
    more.click(); flushEffects();
    expect(t.el.querySelectorAll('tbody tr').length).toBe(120);
    expect(tr(t).style.height).toBe('24px');
    expect(td(t).style.padding).toBe('8px 12px');
    setInput('touch'); flushEffects();
    expect(tr(t).style.height).toBe('44px');
    expect(ths(t).map((th) => th.style.height)).toEqual(['44px', '44px', '44px']);
    setDensity('compact'); flushEffects();
    expect(td(t).style.padding).toBe('6px 8px');
    expect(tr(t).style.height).toBe('44px');                       // touch keeps the floor, compact keeps the rhythm
    expect(t.el.querySelectorAll('tbody tr').length).toBe(120);    // an axis change is not new data
  });
});
