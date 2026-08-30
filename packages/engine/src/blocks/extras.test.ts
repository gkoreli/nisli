/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { notify, __notices } from './notice.js';
import { confirm } from './confirm.js';
import { mount, type Mounted } from '../test/mount.js';
import './table.js'; import './columns.js'; import './bars.js'; import './meter.js';

let width = 1000;
beforeEach(() => { document.body.innerHTML = ''; setMeasurer((el) => (el.tagName === 'TH' ? 60 : width)); });
afterEach(() => setMeasurer(null));

const make = (tag: string, props: Record<string, unknown>) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) (el as any)._setProp(k, v);
  document.body.appendChild(el); flushEffects();
  return el;
};

describe('Table paging', () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ id: String(i) }));
  const props = { columns: [{ id: 'id', header: 'Id', cell: (r: { id: string }) => r.id }], rows, key: (r: { id: string }) => r.id };
  it('shows 60 rows, then 60 more on request, and says how many remain', () => {
    const t = make('nisli-table', props);
    expect(t.querySelectorAll('tbody tr').length).toBe(60);
    const more = [...t.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Show'))!;
    expect(more.textContent).toBe('Show 60 more of 90');
    more.click(); flushEffects();
    expect(t.querySelectorAll('tbody tr').length).toBe(120);
    expect(more.textContent).toBe('Show 30 more of 30');
    more.click(); flushEffects();
    expect(more.parentElement!.style.display).toBe('none');
  });
  it('starts over when the list changes', () => {
    const t = make('nisli-table', props);
    [...t.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Show'))!.click(); flushEffects();
    (t as any)._setProp('rows', rows.slice(0, 100)); flushEffects();
    expect(t.querySelectorAll('tbody tr').length).toBe(60);
  });
});

describe('Columns', () => {
  const labels = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`); // 8 chars → ~60px each
  const props = { labels, series: [{ name: 'A', values: labels.map((_, i) => i + 1) }], text: (v: number) => String(v) };
  const visible = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('span')].filter((s) => labels.includes(s.textContent ?? '') && s.style.visibility === 'visible').length;
  it('shows every label when there is room, every other when there is not', () => {
    width = 1200; expect(visible(make('nisli-columns', props))).toBe(12);
    width = 400; expect(visible(make('nisli-columns', props))).toBe(6);
  });
  it('scales bars to the largest value', () => {
    width = 1200;
    const el = make('nisli-columns', props);
    const bars = [...el.querySelectorAll<HTMLElement>('[role=img] [title] > div')];
    expect(bars.at(-1)!.style.height).toBe('100%');
    expect(bars[0]!.style.height).toBe(`${(1 / 12) * 100}%`);
  });
});

describe('charts at a width (mount)', () => {
  const mounted: Mounted[] = [];
  const up = (...args: Parameters<typeof mount>) => { const m = mount(...args); mounted.push(m); return m; };
  afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); });

  it('Columns: label thinning is labelEvery(slot, longest) at every width', () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`); // 8 chars → 65.6px each
    const props = { labels, series: [{ name: 'A', values: labels.map((_, i) => i + 1) }], text: String };
    const shown = (m: Mounted) => [...m.el.querySelectorAll<HTMLElement>('span')].filter((s) => labels.includes(s.textContent ?? '') && s.style.visibility === 'visible').length;
    expect(shown(up('nisli-columns', props, { width: 1200 }))).toBe(12); // slot 100 ≥ 65.6
    expect(shown(up('nisli-columns', props, { width: 400 }))).toBe(6);   // slot 33 → every 2nd
    expect(shown(up('nisli-columns', props, { width: 240 }))).toBe(3);   // slot 20 → every 4th
    expect(shown(up('nisli-columns', props, { width: 0 }))).toBe(6);     // unmeasured: 48px slot → every 2nd
  });

  it('Bars: the label column is labelColumn(width, longest) — natural, then a third, never under minLabel', () => {
    const items = [{ label: 'Groceries and household', value: 3, text: '3' }, { label: 'Rent', value: 9, text: '9' }];
    const longest = 23 * 7.2 + 8; // 173.6
    const label = (m: Mounted) => m.styleOf('each-item span').width;
    expect(label(up('nisli-bars', { items }, { width: 900 }))).toBe(`${longest}px`);
    expect(label(up('nisli-bars', { items }, { width: 300 }))).toBe('100px');
    expect(label(up('nisli-bars', { items }, { width: 120 }))).toBe('64px');
    expect(label(up('nisli-bars', { items }, { width: 0 }))).toBe(`${longest}px`);
    const fills = [...up('nisli-bars', { items }, { width: 900 }).el.querySelectorAll<HTMLElement>('[style*="height:100%"]')];
    expect(fills.map((f) => f.style.width)).toEqual([`${(3 / 9) * 100}%`, '100%']);
  });

  it('Meter: tone is the block\'s ratio decision; the fill is clamped; aria mirrors the numbers', () => {
    const track = (m: Mounted) => m.el.querySelector<HTMLElement>('[role=meter] > div')!.style;
    const neutral = up('nisli-meter', { label: 'Food', value: 40, max: 100, detail: '40 of 100' }, { scheme: 'light' });
    expect(neutral.el.querySelector('[role=meter]')!.getAttribute('aria-valuenow')).toBe('40');
    expect(neutral.el.querySelector('[role=meter]')!.getAttribute('aria-valuemax')).toBe('100');
    expect(track(neutral).width).toBe('40%');
    const warn = up('nisli-meter', { label: 'Food', value: 90, max: 100 }, { scheme: 'light' });
    const over = up('nisli-meter', { label: 'Food', value: 120, max: 100 }, { scheme: 'light' });
    expect(track(over).width).toBe('100%');
    expect(track(warn).background).not.toBe(track(neutral).background);
    expect(track(over).background).not.toBe(track(warn).background);
    expect(track(up('nisli-meter', { label: 'Food', value: 1, max: 0 }, {})).width).toBe('0%');
  });
});

describe('notify', () => {
  it('shows, is polite, and is dismissed on click', () => {
    notify('Saved', 'positive'); flushEffects();
    const region = document.querySelector('[role=status][aria-live=polite]')!;
    expect(region.textContent).toContain('Saved');
    (region.querySelector('each-item > div') as HTMLElement).click(); flushEffects();
    expect(__notices.value.length).toBe(0);
  });
});

describe('confirm', () => {
  it('resolves true on confirm, false on cancel/escape, and cleans up', async () => {
    const p = confirm({ title: 'Sure?', message: 'Really.', confirmLabel: 'Yes', destructive: true });
    flushEffects();
    const dlg = document.querySelector('[role=dialog]')!;
    expect(dlg.getAttribute('aria-label')).toBe('Sure?');
    [...dlg.querySelectorAll('button')].find((b) => b.textContent === 'Yes')!.click();
    expect(await p).toBe(true);
    const q = confirm({ title: 'Again?', message: 'm' }); flushEffects();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await q).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    expect(document.querySelectorAll('[role=dialog]').length).toBe(0);
  });
});
