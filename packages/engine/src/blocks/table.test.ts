/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { flushEffects } from '@nisli/core';
import { type Column } from './table.js';
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
