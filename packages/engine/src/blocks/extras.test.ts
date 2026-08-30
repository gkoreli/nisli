/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushEffects, html, signal } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { notify, __notices } from './notice.js';
import { confirm } from './confirm.js';
import { Dialog } from './dialog.js';
import { focusables, __layers } from './kernel.js';
import { liveTone } from '../test/claims.js';
import { estimator } from '../test/estimate.js';
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
  const props = { columns: [{ id: 'id', label: 'Id', cell: (r: { id: string }) => r.id }], rows, rowKey: (r: { id: string }) => r.id };
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
  const props = { labels, series: [{ label: 'A', values: labels.map((_, i) => i + 1) }], format: (v: number) => String(v) };
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
    const props = { labels, series: [{ label: 'A', values: labels.map((_, i) => i + 1) }], format: String };
    const shown = (m: Mounted) => [...m.el.querySelectorAll<HTMLElement>('span')].filter((s) => labels.includes(s.textContent ?? '') && s.style.visibility === 'visible').length;
    expect(shown(up('nisli-columns', props, { width: 1200 }))).toBe(12); // slot 100 ≥ 65.6
    expect(shown(up('nisli-columns', props, { width: 400 }))).toBe(6);   // slot 33 → every 2nd
    expect(shown(up('nisli-columns', props, { width: 240 }))).toBe(3);   // slot 20 → every 4th
    expect(shown(up('nisli-columns', props, { width: 0 }))).toBe(6);     // unmeasured: 48px slot → every 2nd
  });

  it('Bars: the label column is labelColumn(width, budget) — the label budget (never the longest label), then a third, never under minLabel', () => {
    const items = [{ label: 'Groceries and household', value: 3, text: '3' }, { label: 'Rent', value: 9, text: '9' }];
    const budget = 20 * 7.2 + 8; // labelChars × charWidth + a breath = 152; the 23-char label truncates inside it
    const label = (m: Mounted) => m.styleOf('each-item span').width;
    expect(label(up('nisli-bars', { items }, { width: 900 }))).toBe(`${budget}px`);
    expect(label(up('nisli-bars', { items }, { width: 300 }))).toBe('100px');
    expect(label(up('nisli-bars', { items }, { width: 120 }))).toBe('64px');
    expect(label(up('nisli-bars', { items }, { width: 0 }))).toBe(`${budget}px`);
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

describe('notify — live tone, a Dismiss a keyboard reaches, Escape, paused timers (ADR 0042 c)', () => {
  const polite = () => document.querySelector<HTMLElement>('[role=status][aria-live=polite]')!;
  const assertive = () => document.querySelector<HTMLElement>('[role=alert][aria-live=assertive]')!;
  const noticesIn = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-nisli-tone]')];
  const key = (k: string, target: Element) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); target.dispatchEvent(e); flushEffects(); return e; };
  const tick = () => new Promise<void>((r) => queueMicrotask(r));
  let main: HTMLElement;
  beforeEach(() => { main = document.createElement('main'); document.body.appendChild(main); });
  afterEach(() => { __notices.value = []; flushEffects(); vi.useRealTimers(); main.remove(); });

  it('maps tone to urgency: negative is an assertive alert, every other tone a polite status; both containers exist before a notice arrives', () => {
    notify('Saved', 'positive'); flushEffects();
    expect(noticesIn(polite()).map((n) => n.textContent)).toEqual(['Saved×']);
    expect(noticesIn(assertive())).toEqual([]);                     // the alert container is there, empty
    notify('Failed', 'negative'); notify('Note'); notify('Careful', 'warning'); flushEffects();
    expect(noticesIn(assertive()).map((n) => n.getAttribute('data-nisli-tone'))).toEqual(['negative']);
    expect(noticesIn(polite()).map((n) => n.getAttribute('data-nisli-tone'))).toEqual(['positive', 'neutral', 'warning']);
    expect(noticesIn(assertive())[0]!.getAttribute('role')).toBe('group');
    // The spoken name is a human word, not the engine's tone vocabulary; the tone stamp stays as the checker's evidence.
    expect(noticesIn(assertive())[0]!.getAttribute('aria-label')).toBe('Error');
    expect(noticesIn(polite()).map((n) => n.getAttribute('aria-label'))).toEqual(['Success', 'Note', 'Warning']);
    expect(liveTone.check(polite().parentElement!, estimator(800))).toEqual([]);
  });

  it('each notice has a Dismiss button in the tab order; focusing it and pressing Enter (a click) removes that notice only', () => {
    notify('One', 'positive'); notify('Two', 'negative'); flushEffects();
    const region = polite().parentElement!;
    const dismiss = [...region.querySelectorAll<HTMLElement>('button[aria-label=Dismiss]')];
    expect(dismiss.length).toBe(2);
    expect(focusables(region)).toEqual(dismiss);                    // what Tab walks: the two Dismiss buttons, in order
    dismiss[1]!.focus();
    expect(document.activeElement).toBe(dismiss[1]);
    key('Enter', dismiss[1]!); (document.activeElement as HTMLElement).click(); flushEffects();   // Enter on a button is a click
    expect(__notices.value.map((n) => n.text)).toEqual(['One']);
    expect(noticesIn(polite()).length).toBe(1);
    expect(noticesIn(assertive()).length).toBe(0);
    // Focus did not fall to <body> (WCAG 2.4.3): with no opener and no dialog, the main landmark takes it.
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
  });

  it('a keyboard Dismiss returns focus to where it came from: the control Tab left (Enter), or the page control that was focused (Escape)', () => {
    const before = document.createElement('button'); before.id = 'before'; main.appendChild(before);
    notify('One', 'positive'); flushEffects();
    const dismiss = polite().querySelector<HTMLElement>('button[aria-label=Dismiss]')!;
    before.focus();
    dismiss.focus();                                                 // as Tab would: the focusin carries relatedTarget = #before
    key('Enter', dismiss); (document.activeElement as HTMLElement).click(); flushEffects();
    expect(__notices.value.length).toBe(0);
    expect(document.activeElement).toBe(before);
    notify('Two', 'negative'); flushEffects();
    const d2 = assertive().querySelector<HTMLElement>('button[aria-label=Dismiss]')!;
    before.focus(); d2.focus();
    key('Escape', d2);
    expect(__notices.value.length).toBe(0);
    expect(document.activeElement).toBe(before);
    // The origin is gone: the main landmark, never <body>.
    notify('Three', 'positive'); flushEffects();
    const d3 = polite().querySelector<HTMLElement>('button[aria-label=Dismiss]')!;
    before.focus(); d3.focus(); before.remove();
    key('Escape', d3);
    expect(document.activeElement).toBe(main);
  });

  it('Escape on a focused notice dismisses it, is defaultPrevented, and never reaches an open dialog below', async () => {
    const open = signal(true);
    const t = mount(Dialog, { title: 'D', open, onClose: () => { open.value = false; }, children: html`<input id="first" />` });
    try {
      await tick();
      expect(document.activeElement?.id).toBe('first');
      notify('Could not save', 'negative'); flushEffects();
      expect(__layers.value.map((l) => l.kind)).toEqual(['modal', 'passive']);
      // A modal's Tab guard never reaches the region (the known limit): focus the Dismiss as a pointer or AT would.
      const dismiss = assertive().querySelector<HTMLElement>('button[aria-label=Dismiss]')!;
      dismiss.focus();
      const e = key('Escape', dismiss);
      expect(e.defaultPrevented).toBe(true);
      expect(__notices.value.length).toBe(0);
      expect(open.value).toBe(true);
      expect(__layers.value.map((l) => l.kind)).toEqual(['modal']);
      // Focus was not left on a removed element or dropped to <body>: back in the dialog, on the field it came from.
      expect(t.el.querySelector('[role=dialog]')!.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.id).toBe('first');
      key('Escape', document.activeElement!);
      expect(open.value).toBe(false);
    } finally { t.unmount(); }
  });

  it('the timer is a resumable countdown: 4 s for a polite tone, 8 s for negative; focus or a pointer holds it and the remaining time resumes', () => {
    vi.useFakeTimers();
    notify('Quick', 'positive'); flushEffects();
    vi.advanceTimersByTime(3999); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Quick']);
    vi.advanceTimersByTime(1); flushEffects();
    expect(__notices.value).toEqual([]);

    notify('Held', 'positive'); flushEffects();
    const held = noticesIn(polite())[0]!;
    vi.advanceTimersByTime(1000);
    held.querySelector<HTMLElement>('button')!.focus(); flushEffects();   // focusin bubbles to the notice: paused
    vi.advanceTimersByTime(10_000); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Held']);
    (document.activeElement as HTMLElement).blur(); flushEffects();       // focusout: resumes with 3 s left, not 4
    vi.advanceTimersByTime(2999); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Held']);
    vi.advanceTimersByTime(1); flushEffects();
    expect(__notices.value).toEqual([]);

    notify('Hovered', 'negative'); flushEffects();
    const hovered = noticesIn(assertive())[0]!;
    vi.advanceTimersByTime(7000);
    hovered.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(60_000); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Hovered']);
    hovered.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(999); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Hovered']);
    vi.advanceTimersByTime(1); flushEffects();
    expect(__notices.value).toEqual([]);
  });
});

describe('confirm', () => {
  it('resolves true on confirm, false on cancel/escape, and cleans up', async () => {
    const p = confirm({ title: 'Sure?', text: 'Really.', action: { label: 'Yes', destructive: true } });
    flushEffects();
    const dlg = document.querySelector('[role=dialog]')!;
    expect(document.getElementById(dlg.getAttribute('aria-labelledby')!)!.textContent).toBe('Sure?');
    [...dlg.querySelectorAll('button')].find((b) => b.textContent === 'Yes')!.click();
    expect(await p).toBe(true);
    const q = confirm({ title: 'Again?', text: 'm', action: { label: 'Yes' } }); flushEffects();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await q).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    expect(document.querySelectorAll('[role=dialog]').length).toBe(0);
  });
});
