/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { notify, __notices } from './notice.js';
import { confirm } from './confirm.js';
import './table.js'; import './columns.js';

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
