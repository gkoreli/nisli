/**
 * The live-flip proof over every block (ADR 0046 §Acceptance): each block in
 * `skin.test.ts`'s list is mounted at the default context, flipped live to
 * compact + touch, and must carry byte-identical inline styles to a fresh
 * mount at compact + touch — `AXIS_STALE` as a unit test, and the gate for
 * the migration's completeness: any number a block read once and froze
 * (a record handed to `ctx.part()`, a setup-time constant) shows here.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { html, signal, flushEffects } from '@nisli/core';
import { mount, textMeasurer, type Mounted } from './test/mount.js';
import { axisStale } from './test/prove.js';
import { setDensity, setInput } from './engine/axes.js';
import { App, Page, Section, Grid, Stat, Table, Form, Dialog, Meter, Bars, Empty, Text, Link, Columns, Toolbar, type Content } from './index.js';

// The same list `skin.test.ts` mounts (see `mountAll` there), through the block factories.
const BLOCKS: Record<string, () => Content> = {
  'nisli-app': () => App({ brand: 'B', nav: [{ label: 'A', href: '/a' }], location: '/a', children: html`<i></i>` }),
  'nisli-page': () => Page({ title: 'T', actions: [{ id: 'x', label: 'X', priority: 'primary' }, { id: 'y', label: 'Y', destructive: true }], children: html`<i></i>` }),
  'nisli-section': () => Section({ title: 'S', children: html`<i></i>` }),
  'nisli-section-pending': () => Section({ title: 'S', children: html`<i></i>`, status: { loading: signal(true), error: signal(null) } }),
  'nisli-grid': () => Grid({ children: [html`<i></i>`, html`<i></i>`] }),
  'nisli-stat': () => Stat({ label: 'L', value: 'V', delta: { text: 'd', tone: 'negative' }, hint: 'h' }),
  'nisli-table': () => Table<{ id: number }>({ columns: [{ id: 'a', label: 'A', cell: () => 'a', kind: 'money' }], rows: [{ id: 1 }], rowKey: (r) => String(r.id), onOpen: () => {} }),
  'nisli-form': () => Form<{ a: string; s: string; n: string }>({ fields: [{ name: 'a', label: 'A', kind: 'text', required: true, hint: 'h' }, { name: 's', label: 'S', options: [] }, { name: 'n', label: 'N', long: true }], initial: { a: '', s: '', n: '' }, onChange: () => {}, onSubmit: () => {}, onCancel: () => {}, actions: [{ id: 'd', label: 'D', destructive: true }] }),
  'nisli-dialog': () => Dialog({ title: 'D', open: true, onClose: () => {}, children: html`<i></i>` }),
  'nisli-meter': () => Meter({ label: 'M', value: 120, max: 100, text: 'x' }),
  'nisli-bars': () => Bars({ items: [{ label: 'a', value: 1, text: '1' }] }),
  'nisli-empty': () => Empty({ title: 'E', hint: 'h', actions: [{ id: 'a', label: 'A' }] }),
  'nisli-text': () => Text({ text: 't', role: 'code', tone: 'warning' }),
  'nisli-link': () => Link({ href: '/', label: 'l' }),
};

afterEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; setDensity('system'); setInput('system'); });

describe('every block follows the axes live (ADR 0046)', () => {
  it.each(Object.keys(BLOCKS))('%s: flipped live to compact + touch it matches a fresh mount there, byte for byte', async (name) => {
    const tag = name.replace('-pending', '');
    const make = BLOCKS[name]!;
    const t = mount(make, {}, { width: 800 });
    try {
      // Not vacuous: the block is there, with inline styles to diff.
      expect(t.el.tagName.toLowerCase()).toBe(tag);
      expect(t.frame.querySelectorAll('[style]').length).toBeGreaterThan(1);
      const claims = await axisStale(t, make, { width: 800 });
      expect(claims.map((c) => c.detail)).toEqual([]);
    } finally {
      t.unmount();
    }
  });
});

// ── The branches the simplest shapes never reach ───────────────────────
// Each case mounts one block in a shape that renders a branch the list above
// does not (a folded column, a segmented choice, a sheet, an open menu), then
// takes it through the same flip. The fresh tree is made by the same factory,
// so a factory that opens a menu opens it on both sides.

const noop = () => {};
const refetch = () => {};

/**
 * A factory whose mount opens a menu: once the tree is in the document (a
 * microtask later — the fixed-point runner's first turn), the last `tag` in
 * the document (the one just mounted: a fresh tree mounts after the live one)
 * has its `selector` clicked. A menu already open is left alone, so a test
 * that clicks the live toggle itself is not toggled back.
 */
const withMenuOpen = (make: () => Content, tag: string, selector: string): (() => Content) => () => {
  queueMicrotask(() => {
    const host = [...document.querySelectorAll<HTMLElement>(tag)].at(-1);
    const trigger = host?.querySelector<HTMLElement>(selector);
    if (trigger?.getAttribute('aria-expanded') === 'false') { trigger.click(); flushEffects(); }
  });
  return make();
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Draft { name: string; kind: string; account: string; paid: boolean; file: string; note: string; reason: string }
interface Row { id: number; name: string; amount: number; date: string; category: string; note: string }
const ROWS: Row[] = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}`, amount: (i + 1) * 10, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, category: i % 2 ? 'Food' : 'Rent', note: 'n' }));
const COLUMNS = [
  { id: 'name', label: 'Name', cell: (r: Row) => r.name, priority: 'primary' as const, sortable: true },
  { id: 'amount', label: 'Amount', cell: (r: Row) => r.amount, kind: 'money' as const, priority: 'primary' as const, sortable: true },
  { id: 'date', label: 'Date', cell: (r: Row) => r.date, kind: 'date' as const },
  { id: 'category', label: 'Category', cell: (r: Row) => r.category },
  { id: 'note', label: 'Note', cell: (r: Row) => r.note, priority: 'tertiary' as const },
];
const rowKey = (r: Row) => String(r.id);

interface Case {
  readonly make: () => Content;
  /** How the live tree is mounted (and the fresh one, the same way). Default: width 800. */
  readonly at?: { width: number; viewport?: number; text?: (el: HTMLElement) => number | undefined };
  /** Not vacuous: the branch the case is for is really there before the flip. */
  readonly check: (t: Mounted) => void;
  /** Bring the live tree into the shape (open a menu) before the flip. */
  readonly arrange?: (t: Mounted) => void;
}

const CASES: Record<string, Case> = {
  'Columns: 12 labels and two series': {
    make: () => Columns({ labels: MONTHS, series: [{ label: 'In', tone: 'positive', values: MONTHS.map((_, i) => i + 1) }, { label: 'Out', tone: 'negative', values: MONTHS.map((_, i) => 12 - i) }], format: (v) => `$${v}` }),
    check: (t) => { expect(t.el.querySelectorAll('[role=img] each-item').length).toBe(12); expect(t.el.querySelectorAll('[role=img] each-item > div > div').length).toBe(24); },
  },
  'Form: group, segmented, select, boolean, file, long, hidden by when': {
    make: () => Form<Draft>({
      fields: [
        { name: 'name', label: 'Name', required: true, group: 'Identity' },
        { name: 'kind', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }], group: 'Identity' },
        { name: 'account', label: 'Account', options: [{ value: '1', label: 'One' }, { value: '2', label: 'Two' }, { value: '3', label: 'Three' }, { value: '4', label: 'Four' }] },
        { name: 'paid', label: 'Paid', kind: 'boolean' },
        { name: 'file', label: 'Statement', kind: 'file', accept: '.csv' },
        { name: 'note', label: 'Note', long: true },
        { name: 'reason', label: 'Reason', when: (d) => d.paid === true },
      ],
      initial: { name: '', kind: 'a', account: '1', paid: false, file: '', note: '', reason: '' },
      onSubmit: noop, onCancel: noop,
    }),
    check: (t) => {
      expect(t.el.querySelector('fieldset')).not.toBeNull();
      expect(t.el.querySelector('[role=radiogroup], [role=group] [role=radio], [role=radio]')).not.toBeNull();
      expect(t.el.querySelector('select')).not.toBeNull();
      expect(t.el.querySelector('input[type=checkbox]')).not.toBeNull();
      expect(t.el.querySelector('input[type=file]')).not.toBeNull();
      expect(t.el.querySelector('textarea')).not.toBeNull();
      expect(t.el.querySelector('[name=reason]')).toBeNull();
    },
  },
  'Table: sorted, columns folded at 360, more than a page of rows': {
    make: () => Table<Row>({ columns: COLUMNS, rows: ROWS, rowKey, onOpen: noop, sort: { by: 'amount', order: 'desc' }, onSort: noop }),
    at: { width: 360 },
    check: (t) => {
      expect(t.el.querySelector('th[aria-sort=descending]')).not.toBeNull();
      expect(t.el.querySelector('th[aria-sort=descending] span[aria-hidden]')?.textContent).toContain('↓');
      expect([...t.el.querySelectorAll<HTMLElement>('th')].some((th) => th.style.display === 'none')).toBe(true);
      expect([...t.el.querySelectorAll('button')].some((b) => /^Show \d+ more of \d+$/.test(b.textContent ?? ''))).toBe(true);
    },
  },
  'Table: status pending': {
    make: () => Table<Row>({ columns: COLUMNS, rows: [], rowKey, status: { loading: signal(true), error: signal(null), refetch } }),
    check: (t) => { expect(t.el.querySelector('tbody[role=status]')).not.toBeNull(); },
  },
  'Section: status failed': {
    make: () => Section({ title: 'S', children: html`<i></i>`, status: { loading: signal(false), error: signal(new Error('no')), refetch } }),
    check: (t) => { expect(t.el.textContent).toContain('no'); },
  },
  'Section: status refreshing': {
    make: () => Section({ title: 'S', children: html`<i></i>`, status: { loading: signal(true), error: signal(null), data: signal({}), refetch } }),
    check: (t) => { expect(t.el.textContent).toContain('Updating…'); },
  },
  'Dialog: sheet at 360 with actions': {
    make: () => Dialog({ title: 'D', open: true, onClose: noop, actions: [{ id: 'ok', label: 'OK', priority: 'primary' }, { id: 'rm', label: 'Remove', destructive: true }], children: html`<i></i>` }),
    at: { width: 360, viewport: 360 },
    check: (t) => { expect(t.styleOf('[role=presentation]').alignItems).toBe('stretch'); expect(t.el.querySelectorAll('[role=dialog] button').length).toBeGreaterThanOrEqual(3); },
  },
  'App: bar mode at 360 with the menu open': {
    make: withMenuOpen(() => App({ brand: 'B', nav: [{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }], location: '/a', children: html`<i></i>` }), 'nisli-app', '[aria-label="Menu"]'),
    at: { width: 360 },
    arrange: (t) => { t.el.querySelector<HTMLElement>('[aria-label="Menu"]')!.click(); flushEffects(); },
    check: (t) => {
      expect(t.styleOf('header').display).toBe('flex');
      expect(t.el.querySelector('[aria-label="Menu"]')?.getAttribute('aria-expanded')).toBe('true');
      expect(t.styleOf('nav').display).toBe('flex');
    },
  },
  'Toolbar: overflow menu open at 360': {
    make: withMenuOpen(() => Toolbar({ title: 'Transactions', actions: [{ id: 'a', label: 'Add', priority: 'primary' }, { id: 'e', label: 'Export' }, { id: 'i', label: 'Import' }, { id: 'r', label: 'Reconcile' }, { id: 'd', label: 'Delete', destructive: true }] }), 'nisli-toolbar', '[aria-label="More actions"]'),
    at: { width: 360, text: textMeasurer(8) },
    arrange: (t) => { t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!.click(); flushEffects(); },
    check: (t) => {
      expect(t.el.querySelector('[aria-label="More actions"]')?.getAttribute('aria-expanded')).toBe('true');
      expect(t.styleOf('[role=menu]').display).toBe('flex');
      expect(t.el.querySelectorAll('[role=menuitem]').length).toBeGreaterThan(0);
    },
  },
  'Empty: with actions': {
    make: () => Empty({ title: 'Nothing', hint: 'Add one', actions: [{ id: 'a', label: 'Add', priority: 'primary' }, { id: 'b', label: 'Import' }] }),
    check: (t) => { expect(t.el.querySelectorAll('button').length).toBe(2); },
  },
  'Bars: a label longer than 20 characters': {
    make: () => Bars({ items: [{ label: 'A category name well over twenty characters', value: 3, text: '3' }, { label: 'b', value: 1, text: '1' }] }),
    check: (t) => { expect(t.el.querySelector('span')?.textContent?.length).toBeGreaterThan(20); },
  },
  'Meter: over 100%': {
    make: () => Meter({ label: 'M', value: 150, max: 100, text: '150%' }),
    check: (t) => { expect(t.el.textContent).toContain('150%'); },
  },
};

describe('the branches follow the axes live too (ADR 0046 §5)', () => {
  it.each(Object.keys(CASES))('%s: flipped live to compact + touch it matches a fresh mount there, byte for byte', async (name) => {
    const { make, at = { width: 800 }, check, arrange } = CASES[name]!;
    const t = mount(make, {}, at);
    try {
      // The test opens the live menu itself; the factory's own opening (a microtask later) then finds it open and leaves it.
      arrange?.(t);
      await Promise.resolve(); flushEffects();
      check(t);
      expect(t.frame.querySelectorAll('[style]').length).toBeGreaterThan(1);
      const claims = await axisStale(t, make, at);
      expect(claims.map((c) => c.detail)).toEqual([]);
      // Still the shape the case is for: the flip (and the fresh tree beside it) did not close a menu or lose a state.
      check(t);
    } finally {
      t.unmount();
    }
  });
});
