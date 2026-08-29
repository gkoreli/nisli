/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects } from '@nisli/core';
import { Table, type Column } from './table.js';
import { setMeasurer } from '../engine/measure.js';

let width = 1000;
beforeEach(() => {
  document.body.innerHTML = '';
  // A column is as wide as its header text says; the host is the frame.
  setMeasurer((el) => (el.tagName === 'NISLI-TABLE' ? width : el.tagName === 'TH' ? naturalOf(el.textContent ?? '') : 0));
});
afterEach(() => setMeasurer(null));

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
const rows: Row[] = [{ id: '1', date: 'Aug 1', payee: 'REI', category: 'Shopping', account: 'Card', note: '', amount: -12 }];

function mount(w: number) {
  width = w;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const t = document.createElement('nisli-table');
  for (const [k, v] of Object.entries({ columns, rows, key: (r: Row) => r.id })) (t as any)._setProp(k, v);
  host.appendChild(t);
  flushEffects();
  return {
    shown: () => [...t.querySelectorAll<HTMLElement>('thead th')].filter((th) => th.style.display !== 'none').map((th) => th.textContent),
    cells: () => [...t.querySelectorAll<HTMLElement>('tbody td')].filter((td) => td.style.display !== 'none').length,
    el: t,
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
    width = 1000;
    (t.el as any)._setProp('rows', [...rows]);
    flushEffects(); await Promise.resolve(); flushEffects();
    expect(t.shown().length).toBe(6);
  });
});
