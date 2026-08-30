/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { flushEffects, html } from '@nisli/core';
import { type Column, type Sort } from './table.js';
import { focusables } from './kernel.js';
import { accessibleName, accessibleNames, sortReachable } from '../test/claims.js';
import { estimator } from '../test/estimate.js';
import { mount as mountBlock, type Mounted } from '../test/mount.js';

interface Row { id: string; date: string; payee: string; category: string; account: string; note: string; amount: number }
const columns: Column<Row>[] = [
  { id: 'date', header: 'Date', kind: 'date', cell: (r) => r.date, priority: 'primary' },
  { id: 'payee', header: 'Payee', cell: (r) => r.payee, priority: 'primary' },
  { id: 'category', header: 'Category', cell: (r) => r.category },
  { id: 'account', header: 'Account', cell: (r) => r.account, priority: 'tertiary' },
  { id: 'note', header: 'Note', cell: (r) => r.note, priority: 'tertiary' },
  { id: 'amount', header: 'Amount', kind: 'money', cell: (r) => r.amount, priority: 'primary' },
];
const naturals = [72, 173, 101, 72, 52, 69]; // sum 539
const naturalOf = (header: string) => naturals[columns.findIndex((c) => header.startsWith(c.header))] ?? 0;
// A column is as wide as its header text says; everything else is the frame.
const text = (el: HTMLElement) => (el.tagName === 'TH' ? naturalOf(el.textContent ?? '') : undefined);
const rows: Row[] = [{ id: '1', date: 'Aug 1', payee: 'REI', category: 'Shopping', account: 'Card', note: '', amount: -12 }];

let mounted: Mounted | undefined;
afterEach(() => { mounted?.unmount(); mounted = undefined; });

function mount(width: number) {
  const t = (mounted = mountBlock('nisli-table', { columns, rows, key: (r: Row) => r.id }, { width, text }));
  return {
    shown: () => [...t.el.querySelectorAll<HTMLElement>('thead th')].filter((th) => th.style.display !== 'none').map((th) => th.textContent),
    cells: () => [...t.el.querySelectorAll<HTMLElement>('tbody td')].filter((td) => td.style.display !== 'none').length,
    el: t.el,
    resize: t.resize,
  };
}

describe('Table drops columns by priority', () => {
  it('1000: every column', () => {
    expect(mount(1000).shown()).toEqual(['Date', 'Payee', 'Category', 'Account', 'Note', 'Amount']);
  });
  it('500: the two tertiary columns leave the row, later one first', () => {
    // 539 - 52 (note) = 487 ≤ 500
    expect(mount(500).shown()).toEqual(['Date', 'Payee', 'Category', 'Account', 'Amount']);
  });
  it('420: both tertiaries', () => {
    // 487 - 72 = 415 ≤ 420
    expect(mount(420).shown()).toEqual(['Date', 'Payee', 'Category', 'Amount']);
  });
  it('294: nothing is lost — dropped columns fold under the primary text cell', () => {
    const t = mount(294);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    expect(t.cells()).toBe(3);
    const payee = t.el.querySelectorAll<HTMLElement>('tbody td')[1]!;
    expect(payee.textContent).toBe('REIShopping · Card');
  });
  it('250: the primary text column truncates rather than let the row overflow', () => {
    // primaries 72 + 173 + 69 = 314 > 250 → payee shrinks by 64 to 109 (min is 96)
    const t = mount(250);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    const payee = t.el.querySelectorAll<HTMLElement>('thead th')[1]!;
    expect(payee.style.width).toBe('109px');
    expect(payee.style.textOverflow).toBe('ellipsis');
    // every surviving column is pinned so the browser cannot re-widen them
    expect(t.el.querySelector<HTMLElement>('thead th')!.style.width).toBe('72px');
    expect(t.el.querySelector<HTMLElement>('table')!.style.tableLayout).toBe('fixed');
  });

  it('re-decides when the frame widens again', async () => {
    const t = mount(294);
    expect(t.shown()).toEqual(['Date', 'Payee', 'Amount']);
    t.resize(1000);
    await Promise.resolve(); flushEffects();
    expect(t.shown().length).toBe(6);
  });

  it('a row lights up only while hovered, through the skin part', () => {
    mounted = mountBlock('nisli-table', { columns, rows, key: (r: Row) => r.id }, { width: 1000, scheme: 'light' });
    const tr = mounted.el.querySelector<HTMLElement>('tbody tr')!;
    const before = tr.getAttribute('style');
    tr.dispatchEvent(new Event('mouseenter'));
    flushEffects();
    expect(tr.getAttribute('style')).not.toBe(before);
    tr.dispatchEvent(new Event('mouseleave'));
    flushEffects();
    expect(tr.getAttribute('style')).toBe(before);
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
    mounted = mountBlock('nisli-table', { columns: sortable, rows, key: (r: Row) => r.id, onSort: (s: Sort) => { sorts.push(s); (mounted!.el as any)._setProp('sort', s); } }, { width: 1000, text });
    const ths = [...mounted.el.querySelectorAll<HTMLElement>('thead th')];
    expect(ths.map((th) => !!th.querySelector('button'))).toEqual([true, false, false, false, false, true]);
    const order = focusables(mounted.el);
    expect(order[0]).toBe(ths[0]!.querySelector('button'));         // the first Tab stop in the table is the Date header
    order[0]!.focus();
    expect(document.activeElement).toBe(ths[0]!.querySelector('button'));
    expect(accessibleName(document.activeElement!)).toBe('Date');
    activate('Enter');
    expect(sorts).toEqual([{ by: 'date', dir: 'asc' }]);
    expect(ths[0]!.getAttribute('aria-sort')).toBe('ascending');
    expect(ths[0]!.querySelector('[aria-hidden=true]')!.textContent).toBe(' ↑');
    activate(' ');
    expect(sorts).toEqual([{ by: 'date', dir: 'asc' }, { by: 'date', dir: 'desc' }]);
    expect(ths[0]!.getAttribute('aria-sort')).toBe('descending');
    expect(ths[1]!.hasAttribute('aria-sort')).toBe(false);
    expect(ths[0]!.style.cursor).not.toBe('pointer');               // the pointer affordance is the button's, not the cell's
    expect(ths[0]!.querySelector<HTMLElement>('button')!.style.cursor).toBe('pointer');
    expect(sortReachable.check(mounted.el, estimator(1000))).toEqual([]);
  });

  it('a selectable row is a named tab stop after the headers; Enter and Space each select once, Space without scrolling the page; focus lights it up', () => {
    const selected: Row[] = [];
    mounted = mountBlock('nisli-table', { columns: sortable, rows, key: (r: Row) => r.id, onSelect: (r: Row) => selected.push(r) }, { width: 1000, text, scheme: 'light' });
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
    mounted = mountBlock('nisli-table', { columns: withControl, rows, key: (r: Row) => r.id, onSelect: (r: Row) => selected.push(r) }, { width: 1000, text });
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

  it('a table without onSelect has no focusable rows and no row names; without sortable no header buttons', () => {
    mounted = mountBlock('nisli-table', { columns, rows, key: (r: Row) => r.id }, { width: 1000, text });
    expect(mounted.el.querySelector('tbody tr')!.hasAttribute('tabindex')).toBe(false);
    expect(mounted.el.querySelector('tbody tr')!.hasAttribute('aria-labelledby')).toBe(false);
    expect(mounted.el.querySelectorAll('thead button').length).toBe(0);
    expect(focusables(mounted.el)).toEqual([]);
  });

  it('row ids come from a counter, so a keyed reorder keeps every id unique', () => {
    const two = [...rows, { id: '2', date: 'Aug 2', payee: 'Uber', category: 'Transport', account: 'Card', note: '', amount: -7 }];
    mounted = mountBlock('nisli-table', { columns, rows: two, key: (r: Row) => r.id, onSelect: () => {} }, { width: 1000, text });
    const ids = () => [...mounted!.el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) => tr.getAttribute('aria-labelledby'));
    const first = ids();
    (mounted.el as any)._setProp('rows', [two[1], two[0]]); flushEffects();
    expect(ids()).toEqual([first[1], first[0]]);                    // the elements moved with their rows
    expect(new Set(ids()).size).toBe(2);
    expect([...mounted.el.querySelectorAll<HTMLElement>('tbody tr')].map((tr) => accessibleName(tr))).toEqual(['Aug 2', 'Aug 1']);
  });
});
