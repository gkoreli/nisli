/**
 * prove() over a real composition: a shell with a page, a toolbar, a table,
 * a form and a dialog, proven at five widths with the calibrated estimator —
 * and a screen that cannot be satisfied, whose claims say why. Also the dev
 * evidence: a host stamped data-nisli-report and the window ring buffer.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { signal, computed, html, el, flushEffects } from '@nisli/core';
import { prove, formatClaim } from './prove.js';
import { block } from '../blocks/kernel.js';
import { mount, textMeasurer, type Mounted } from './mount.js';
import { App } from '../blocks/app.js';
import { Page } from '../blocks/page.js';
import { Section } from '../blocks/section.js';
import { Grid } from '../blocks/grid.js';
import { Stat } from '../blocks/stat.js';
import { Toolbar } from '../blocks/toolbar.js';
import { Table, type Column } from '../blocks/table.js';
import { Form, type Field } from '../blocks/form.js';
import { Dialog } from '../blocks/dialog.js';
import { Text } from '../blocks/text.js';
import { setDevMode } from '../engine/dev.js';
import { REPORT_ATTR, reportRing } from '../engine/report.js';

interface Row { id: string; date: string; payee: string; category: string; account: string; note: string; amount: number }
const columns: Column<Row>[] = [
  { id: 'date', label: 'Date', kind: 'date', cell: (r) => r.date, priority: 'primary' },
  { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
  { id: 'category', label: 'Category', cell: (r) => r.category },
  { id: 'account', label: 'Account', cell: (r) => r.account, priority: 'tertiary' },
  { id: 'note', label: 'Note', cell: (r) => r.note, priority: 'tertiary' },
  { id: 'amount', label: 'Amount', kind: 'money', cell: (r) => r.amount, priority: 'primary' },
];
const rows: Row[] = [
  { id: '1', date: 'Aug 30', payee: 'Whole Foods Market #10235', category: 'Groceries', account: 'Checking', note: 'weekly', amount: -123.45 },
  { id: '2', date: 'Aug 29', payee: 'REI', category: 'Shopping', account: 'Card', note: '', amount: -12 },
];
interface Draft { payee: string; amount: number; kind: string; note: string }
const fields: Field<Draft>[] = [
  { name: 'payee', label: 'Payee', kind: 'text', required: true },
  { name: 'amount', label: 'Amount', kind: 'money' },
  { name: 'kind', label: 'Kind', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }] },
  { name: 'note', label: 'Note', long: true },
];

const WIDTHS = [1280, 1024, 768, 480, 360];

function screen(open = false) {
  return App({
    brand: 'Ledger',
    nav: [{ label: 'Overview', href: '/' }, { label: 'Transactions', href: '/transactions' }],
    location: '/transactions',
    children: Page({
      title: 'Transactions',
      actions: [{ id: 'import', label: 'Import', priority: 'tertiary' }, { id: 'add', label: 'Add transaction', priority: 'primary' }],
      children: [
        Grid({ children: [Stat({ label: 'Spent', value: '$1,234.56', delta: { text: '+12%', tone: 'negative' } }), Stat({ label: 'Income', value: '$3,000.00' })] }),
        Section({ title: 'This month', children: [Table({ columns, rows, rowKey: (r) => r.id })] }),
        Section({ title: 'Quick add', children: [Form<Draft>({ fields, initial: { payee: '', amount: 0, kind: 'expense', note: '' }, key: 'new', onSubmit: () => {} })] }),
        Dialog({ title: 'Edit transaction', open, onClose: () => {}, children: [Text({ text: 'Body' }), Form<Draft>({ fields, initial: { payee: 'REI', amount: -12, kind: 'expense', note: '' }, key: 'edit', onSubmit: () => {} })] }),
      ],
    }),
  });
}

let mounted: Mounted | null = null;
afterEach(() => { mounted?.unmount(); mounted = null; document.body.innerHTML = ''; setDevMode(null); });

describe('prove()', () => {
  it('a real screen holds every claim at five widths, skinned and bare', async () => {
    const skinned = await prove(() => screen(), { widths: WIDTHS, scheme: 'light' });
    expect(skinned.claims).toEqual([]);
    expect(skinned.byWidth.map((w) => w.width)).toEqual(WIDTHS);
    const bare = await prove(() => screen(), { widths: WIDTHS });
    expect(bare.claims).toEqual([]);
  });

  it('with the dialog open the page is inert, the dialog is reachable and labelled, and the sheet at 360 still holds', async () => {
    const proof = await prove(() => screen(true), { widths: [1280, 360], scheme: 'light' });
    expect(proof.claims).toEqual([]);
  });

  it('a screen the engine cannot satisfy is a list of claims that say why, tagged with the width', async () => {
    // Three primary columns (never leave) need their budgets: date 81.6 + payee 96 + amount 110.4 = 288px; a grid cell needs 220.
    const proof = await prove(() => Grid({ children: [Section({ title: 'S', children: [Table({ columns, rows, rowKey: (r) => r.id })] })] }), { widths: [1024, 200], scheme: 'light' });
    expect(proof.byWidth[0]!.claims).toEqual([]);
    const at200 = proof.byWidth[1]!;
    expect(at200.reports.map((r) => r.code).sort()).toEqual(['FIT_CELL', 'FIT_COLUMNS']);
    expect(at200.claims.map((c) => [c.code, c.block, c.width])).toContainEqual(['FIT_COLUMNS', 'nisli-table', 200]);
    expect(at200.claims.map((c) => [c.code, c.block, c.width])).toContainEqual(['FIT_CELL', 'nisli-grid', 200]);
    expect(proof.claims.every((c) => c.severity === 'error')).toBe(true);
    expect(proof.reports).toEqual(at200.reports);
    // A toolbar whose title at its minimum plus the menu trigger cannot fit: FIT_ROW.
    const bar = await prove(() => Toolbar({ title: 'A title that is far too long to survive on a phone', actions: [{ id: 'a', label: 'Publish', priority: 'primary' }] }), { widths: [140], scheme: 'light' });
    expect(bar.claims.map((c) => c.code)).toContain('FIT_ROW');
  });

  it('a screen with a control nobody can name is not proven', async () => {
    const proof = await prove(() => html`<nisli-section><button type="button"></button></nisli-section>` as never, { widths: [800] });
    expect(proof.claims.map((c) => c.code)).toEqual(['NAME_MISSING']);
  });

  it('a proof is a fixed point: turns stop when nothing changes, and a screen still moving at the cap is UNSETTLED', async () => {
    const still = await prove(() => Text({ text: 'still' }), { widths: [800] });
    expect(still.claims).toEqual([]);
    expect(still.byWidth[0]!.turns).toBeGreaterThanOrEqual(2);   // one turn after mount, one after settle(), each finding nothing to do
    expect(still.byWidth[0]!.turns).toBeLessThan(10);            // plus the axes flip: flip, settle, the fresh mount, its settle, the restore — one each
    // A block that rewrites itself every microtask (for longer than any proof looks) never settles.
    const n = signal(0);
    const moving = await prove(() => {
      const bump = () => { if (n.value++ < 10_000) queueMicrotask(bump); };
      queueMicrotask(bump);
      return Text({ text: computed(() => `tick ${n.value}`) });
    }, { widths: [800], turns: 4 });
    expect(moving.claims.map((c) => [c.code, c.width])).toContainEqual(['UNSETTLED', 800]);
    expect(moving.claims[0]!.detail).toMatch(/still changing after 4 turns after mount/);
    expect(moving.byWidth[0]!.turns).toBeGreaterThanOrEqual(5);   // the cap after mount, then at least one turn after settle()
  });

  it('a standing report is a finding, not movement: a plan the engine cannot satisfy is filed once and the screen settles', async () => {
    // Every turn remeasures; a row that cannot fit re-files the same FIT_ROW on every solve. That is one report and a fixed point.
    const Stuck = block<{ items: readonly string[] }>('nisli-stuck-row', {
      render: (props, ctx) => {
        ctx.fitRow({ gap: 0, available: () => 100, items: () => props.items.value.map((id) => ({ id, width: 80, priority: 20 })), report: { code: 'FIT_ROW', detail: () => 'two primaries in a hundred pixels' } });
        return [el('i', {}, 'stuck')];
      },
    });
    const proof = await prove(() => Stuck({ items: ['a', 'b'] }), { widths: [800] });
    expect(proof.claims.map((c) => c.code)).toEqual(['FIT_ROW']);
    expect(proof.claims.some((c) => c.code === 'UNSETTLED')).toBe(false);
    expect(proof.reports).toHaveLength(1);
  });

  it('DECISION_UNSTABLE: a data-perturbed variant must decide the same structural plans; a changed intent is caught and named', async () => {
    const reversed = [...rows].reverse();
    // Same intent, data reordered: every structural plan matches — the tenet (ADR 0044) holds.
    const stable = await prove(() => Table({ columns, rows, rowKey: (r) => r.id }), { widths: [768, 360], variants: [() => Table({ columns, rows: reversed, rowKey: (r) => r.id })] });
    expect(stable.claims).toEqual([]);
    // A variant that changes the columns changes intent: the diff names the block and both plans.
    const broken = await prove(() => Table({ columns, rows, rowKey: (r) => r.id }), { widths: [768], variants: [() => Table({ columns: columns.slice(0, 3), rows, rowKey: (r) => r.id })] });
    expect(broken.claims.map((c) => [c.code, c.block, c.width])).toContainEqual(['DECISION_UNSTABLE', 'nisli-table', 768]);
    expect(broken.claims.find((c) => c.code === 'DECISION_UNSTABLE')!.detail).toMatch(/with the data perturbed \(variant 1\)/);
  });

  it('widths × axes (ADR 0046): every context is proven at every width, each claim tagged with both; the default is unchanged', async () => {
    const AXES = [{}, { density: 'compact' as const }, { input: 'touch' as const }];
    const proof = await prove(() => Stat({ label: 'Spent', value: '$1,234.56' }), { widths: [800, 360], axes: AXES });
    expect(proof.byWidth.map((w) => [w.width, w.axes.density, w.axes.input])).toEqual([
      [800, 'comfortable', 'pointer'], [800, 'compact', 'pointer'], [800, 'comfortable', 'touch'],
      [360, 'comfortable', 'pointer'], [360, 'compact', 'pointer'], [360, 'comfortable', 'touch'],
    ]);
    expect(proof.claims).toEqual([]);
    // The default: one pass per width, at comfortable + pointer, exactly as before.
    const plain = await prove(() => Stat({ label: 'Spent', value: '$1,234.56' }), { widths: [800] });
    expect(plain.byWidth.map((w) => [w.width, w.axes])).toEqual([[800, { density: 'comfortable', input: 'pointer' }]]);
    // A claim carries both: a button at 24px fails TARGET_SMALL under touch only, at each width.
    const short = await prove(() => html`<nisli-section><button type="button" style="display:inline-flex;height:24px;padding:0 12px">Save</button></nisli-section>` as never, { widths: [800, 360], axes: AXES });
    expect(short.claims.map((c) => [c.code, c.width, c.axes])).toEqual([
      ['TARGET_SMALL', 800, { density: 'comfortable', input: 'touch' }],
      ['TARGET_SMALL', 360, { density: 'comfortable', input: 'touch' }],
    ]);
    // A frozen record is AXIS_STALE at every context (each flips to another), named with the block and the axes it was found under.
    // `control.height` moves on every flip (32 at the default, 44 under touch); `space` would not move between touch and pointer.
    const Frozen = block<{ text: string }>('nisli-frozen-stat', { render: (props, ctx) => el('div', { style: ctx.part([], { height: ctx.metrics.control.height }) }, props.text) });
    const stale = await prove(() => Frozen({ text: 'x' }), { widths: [800], axes: [{}, { input: 'touch' }] });
    expect(stale.claims.map((c) => [c.code, c.block, c.width, c.axes])).toEqual([
      ['AXIS_STALE', 'nisli-frozen-stat', 800, { density: 'comfortable', input: 'pointer' }],
      ['AXIS_STALE', 'nisli-frozen-stat', 800, { density: 'comfortable', input: 'touch' }],
    ]);
    expect(stale.claims[0]!.detail).toMatch(/flipped live from comfortable\+pointer to compact\+touch/);
    expect(stale.claims[1]!.detail).toMatch(/flipped live from comfortable\+touch to comfortable\+pointer/);
    expect(formatClaim(stale.claims[1]!)).toMatch(/^AXIS_STALE <nisli-frozen-stat> did not follow the axes: .* @ 800px comfortable\+touch$/);
    expect(formatClaim(stale.claims[0]!)).toMatch(/ @ 800px$/);
  });

  it('viewport may be a function of the width; settle() lets a store boot before the checks', async () => {
    const loaded = signal(false);
    queueMicrotask(() => { loaded.value = true; });
    const proof = await prove(() => Dialog({ title: 'D', open: true, onClose: () => {}, children: [Text({ text: 'x' })] }), { widths: [800], viewport: (w) => w / 2 });
    expect(proof.claims).toEqual([]);
    expect(loaded.value).toBe(true);
  });
});

describe('runtime evidence (dev)', () => {
  it('an unsatisfied plan stamps the block host data-nisli-report and lands in window.__nisli.reports; a satisfied one clears the stamp', async () => {
    setDevMode(true);
    const ring = reportRing()!;
    ring.length = 0;
    mounted = mount('nisli-toolbar', { title: 'A title that is far too long to survive', actions: [{ id: 'a', label: 'Publish', priority: 'primary' }] }, { width: 140, text: textMeasurer(8) });
    expect(mounted.el.getAttribute(REPORT_ATTR)).toBe('FIT_ROW');
    expect(ring.map((r) => r.code)).toEqual(['FIT_ROW']);
    expect(ring[0]!.block).toBe('nisli-toolbar');
    // The global exists as evidence in itself: a runner can tell "no reports" from "no dev build".
    expect((window as unknown as { __nisli: { dev: boolean } }).__nisli.dev).toBe(true);
    mounted.resize(1200);
    await Promise.resolve(); flushEffects();
    expect(mounted.el.hasAttribute(REPORT_ATTR)).toBe(false);
  });

  it('outside dev nothing is stamped and there is no ring', () => {
    setDevMode(false);
    expect(reportRing()).toBeNull();
    mounted = mount('nisli-toolbar', { title: 'A title that is far too long to survive', actions: [{ id: 'a', label: 'Publish', priority: 'primary' }] }, { width: 140, text: textMeasurer(8) });
    expect(mounted.el.hasAttribute(REPORT_ATTR)).toBe(false);
  });
});
