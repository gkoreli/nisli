/**
 * calendar.test.ts — Calendar: month grid, nav, single selection, disabled.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import { Calendar } from './calendar.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

const q = (r: ParentNode, sel: string) => r.querySelector<HTMLElement>(sel)!;
const caption = (r: ParentNode) => q(r, '[data-slot="calendar-caption"]').textContent;
/** The day button for a local YYYY-MM-DD. */
const day = (r: ParentNode, ymd: string) =>
  r.querySelector<HTMLButtonElement>(`[data-day="${ymd}"] button`)!;

// A fixed month for determinism (independent of the machine's "today").
const JAN_2026 = new Date(2026, 0, 15);

describe('Calendar — grid', () => {
  it('renders the month caption and seven weekday headers', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    expect(caption(c)).toContain('January 2026');
    expect(c.querySelectorAll('th[role="columnheader"]')).toHaveLength(7);
    // Grid is a real table with role=grid.
    expect(q(c, '[data-slot="calendar-grid"]').getAttribute('role')).toBe('grid');
    // Jan 1 and Jan 31 are present as in-month days.
    expect(day(c, '2026-01-01')).not.toBeNull();
    expect(day(c, '2026-01-31')).not.toBeNull();
    // Days from adjacent months are marked outside.
    expect(day(c, '2025-12-31')?.getAttribute('data-outside')).toBe('true');
    expect(day(c, '2026-01-15')?.getAttribute('data-outside')).toBe('false');
  });

  it('navigates months with prev/next', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    q(c, '[data-slot="calendar-prev"]').click();
    flushEffects();
    expect(caption(c)).toContain('December 2025');

    q(c, '[data-slot="calendar-next"]').click();
    q(c, '[data-slot="calendar-next"]').click();
    flushEffects();
    expect(caption(c)).toContain('February 2026');
  });

  it('respects weekStartsOn for the first column', () => {
    const sun = mount(html`${Calendar({ defaultMonth: JAN_2026, weekStartsOn: 0 })}`);
    const mon = mount(html`${Calendar({ defaultMonth: JAN_2026, weekStartsOn: 1 })}`);
    const firstCol = (r: ParentNode) =>
      r.querySelectorAll('th[role="columnheader"]')[0].textContent;
    expect(firstCol(sun)).not.toBe(firstCol(mon));
  });
});

describe('Calendar — single selection', () => {
  it('selects a day, marks it, and emits ui-select', () => {
    const onSelect = vi.fn();
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    (c.querySelector('ui-calendar') as HTMLElement).addEventListener('ui-select', (e) =>
      onSelect((e as CustomEvent).detail.value),
    );

    const d15 = day(c, '2026-01-15');
    d15.click();
    flushEffects();
    flushEffects();

    expect(d15.getAttribute('data-selected-single')).toBe('true');
    expect(d15.getAttribute('aria-selected')).toBe('true');
    expect(onSelect).toHaveBeenCalledTimes(1);
    const picked = onSelect.mock.calls[0][0] as Date;
    expect(picked.getFullYear()).toBe(2026);
    expect(picked.getMonth()).toBe(0);
    expect(picked.getDate()).toBe(15);
  });

  it('moves selection to another day', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    day(c, '2026-01-10').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-10').getAttribute('data-selected-single')).toBe('true');

    day(c, '2026-01-20').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-20').getAttribute('data-selected-single')).toBe('true');
    expect(day(c, '2026-01-10').getAttribute('data-selected-single')).toBe('false');
  });
});

describe('Calendar — disabled dates', () => {
  it('disables dates before min and after max, blocking selection', () => {
    const c = mount(
      html`${Calendar({ defaultMonth: JAN_2026, min: new Date(2026, 0, 10), max: new Date(2026, 0, 20) })}`,
    );
    expect(day(c, '2026-01-05').getAttribute('aria-disabled')).toBe('true');
    expect(day(c, '2026-01-25').getAttribute('aria-disabled')).toBe('true');
    expect(day(c, '2026-01-15').getAttribute('aria-disabled')).toBe('false');

    day(c, '2026-01-05').click();
    flushEffects();
    expect(day(c, '2026-01-05').getAttribute('data-selected-single')).toBe('false');
  });

  it('honors a disabled(date) predicate', () => {
    const c = mount(
      html`${Calendar({ defaultMonth: JAN_2026, disabled: (d: Date) => d.getDate() === 17 })}`,
    );
    expect(day(c, '2026-01-17').getAttribute('aria-disabled')).toBe('true');
    day(c, '2026-01-17').click();
    flushEffects();
    expect(day(c, '2026-01-17').getAttribute('data-selected-single')).toBe('false');
  });
});

describe('Calendar — today', () => {
  it('marks today with data-today and aria-current', () => {
    const now = new Date();
    const c = mount(html`${Calendar({ defaultMonth: now })}`);
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const td = day(c, ymd);
    expect(td.getAttribute('data-today')).toBe('true');
    expect(td.getAttribute('aria-current')).toBe('date');
  });
});

describe('Calendar — range selection', () => {
  it('selects a from/to range and styles start/middle/end', () => {
    const onSelect = vi.fn();
    const c = mount(html`${Calendar({ mode: 'range', defaultMonth: JAN_2026 })}`);
    (c.querySelector('ui-calendar') as HTMLElement).addEventListener('ui-select', (e) =>
      onSelect((e as CustomEvent).detail.value),
    );

    day(c, '2026-01-10').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-10').getAttribute('data-range-start')).toBe('true');

    day(c, '2026-01-14').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-10').getAttribute('data-range-start')).toBe('true');
    expect(day(c, '2026-01-14').getAttribute('data-range-end')).toBe('true');
    expect(day(c, '2026-01-12').getAttribute('data-range-middle')).toBe('true');

    const last = onSelect.mock.calls.at(-1)![0] as { from: Date; to: Date };
    expect(last.from.getDate()).toBe(10);
    expect(last.to.getDate()).toBe(14);
  });

  it('orders the range when the second click precedes the first', () => {
    const c = mount(html`${Calendar({ mode: 'range', defaultMonth: JAN_2026 })}`);
    day(c, '2026-01-20').click();
    flushEffects();
    day(c, '2026-01-15').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-15').getAttribute('data-range-start')).toBe('true');
    expect(day(c, '2026-01-20').getAttribute('data-range-end')).toBe('true');
  });

  it('a third click starts a fresh range', () => {
    const c = mount(html`${Calendar({ mode: 'range', defaultMonth: JAN_2026 })}`);
    day(c, '2026-01-10').click();
    flushEffects();
    day(c, '2026-01-14').click();
    flushEffects();
    day(c, '2026-01-20').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-20').getAttribute('data-range-start')).toBe('true');
    expect(day(c, '2026-01-14').getAttribute('data-range-end')).toBe('false');
    expect(day(c, '2026-01-12').getAttribute('data-range-middle')).toBe('false');
  });
});

describe('Calendar — keyboard grid navigation', () => {
  const press = (r: ParentNode, key: string, shiftKey = false) => {
    q(r, '[data-slot="calendar-grid"]').dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
    );
    flushEffects();
    flushEffects();
  };
  const focusedYmd = (r: ParentNode) =>
    (r.querySelector('[data-day] button[tabindex="0"]')!.closest('[data-day]') as HTMLElement).getAttribute(
      'data-day',
    );

  it('moves focus by day/week/row with arrows, Home/End, PageUp/Down', () => {
    const c = mount(html`${Calendar({ selected: new Date(2026, 0, 15), defaultMonth: JAN_2026 })}`);
    expect(focusedYmd(c)).toBe('2026-01-15');

    press(c, 'ArrowRight');
    expect(focusedYmd(c)).toBe('2026-01-16');
    press(c, 'ArrowLeft');
    press(c, 'ArrowLeft');
    expect(focusedYmd(c)).toBe('2026-01-14');
    press(c, 'ArrowDown');
    expect(focusedYmd(c)).toBe('2026-01-21');
    press(c, 'ArrowUp');
    press(c, 'ArrowUp');
    expect(focusedYmd(c)).toBe('2026-01-07');

    press(c, 'Home'); // week starts Sunday (weekStartsOn 0) → 2026-01-04
    expect(focusedYmd(c)).toBe('2026-01-04');
    press(c, 'End');
    expect(focusedYmd(c)).toBe('2026-01-10');
  });

  it('PageUp/PageDown move by month and re-render the grid', () => {
    const c = mount(html`${Calendar({ selected: new Date(2026, 0, 15), defaultMonth: JAN_2026 })}`);
    press(c, 'PageDown');
    expect(caption(c)).toContain('February 2026');
    expect(focusedYmd(c)).toBe('2026-02-15');
    press(c, 'PageUp');
    press(c, 'PageUp');
    expect(caption(c)).toContain('December 2025');
    expect(focusedYmd(c)).toBe('2025-12-15');
  });
});
