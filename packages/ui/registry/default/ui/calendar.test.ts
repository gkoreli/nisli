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
    // Days from adjacent months carry upstream's `outside` cell class
    // (text-muted-foreground); in-month days do not.
    expect(day(c, '2025-12-31').closest('td')!.className).toContain('text-muted-foreground');
    expect(day(c, '2026-01-15').closest('td')!.className).not.toContain('text-muted-foreground');
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
      r.querySelectorAll('th[role="columnheader"]')[0]!.textContent;
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
    const picked = onSelect.mock.calls[0]![0] as Date;
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
  it("marks today with upstream's today cell class and aria-current", () => {
    const now = new Date();
    const c = mount(html`${Calendar({ defaultMonth: now })}`);
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const btn = day(c, ymd);
    // today → `bg-accent text-accent-foreground` on the cell (matches v4).
    expect(btn.closest('td')!.className).toContain('bg-accent');
    // aria-current stays on the interactive button.
    expect(btn.getAttribute('aria-current')).toBe('date');
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
  // Dispatch a key on the grid, flush the reactive re-render, then AWAIT the
  // focus microtask (focusOn() imperatively focuses the target in a
  // queueMicrotask) so document.activeElement reflects the calendar's move.
  const press = async (r: ParentNode, key: string, shiftKey = false): Promise<void> => {
    q(r, '[data-slot="calendar-grid"]').dispatchEvent(
      new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }),
    );
    flushEffects();
    flushEffects();
    await Promise.resolve();
    await Promise.resolve();
  };
  const focusedYmd = (r: ParentNode) =>
    (r.querySelector('[data-day] button[tabindex="0"]')!.closest('[data-day]') as HTMLElement).getAttribute(
      'data-day',
    );
  /** The day the browser actually put focus on. */
  const activeYmd = () =>
    (document.activeElement?.closest('[data-day]') as HTMLElement | null)?.getAttribute('data-day');

  it('moves REAL focus by day/week/row with arrows, Home/End', async () => {
    const c = mount(html`${Calendar({ selected: new Date(2026, 0, 15), defaultMonth: JAN_2026 })}`);
    // Keyboard user tabs onto the roving day, then drives with the grid.
    day(c, '2026-01-15').focus();
    expect(activeYmd()).toBe('2026-01-15');

    await press(c, 'ArrowRight');
    expect(focusedYmd(c)).toBe('2026-01-16');
    expect(activeYmd()).toBe('2026-01-16'); // the calendar moved document.activeElement
    await press(c, 'ArrowLeft');
    await press(c, 'ArrowLeft');
    expect(activeYmd()).toBe('2026-01-14');
    await press(c, 'ArrowDown');
    expect(activeYmd()).toBe('2026-01-21');
    await press(c, 'ArrowUp');
    await press(c, 'ArrowUp');
    expect(activeYmd()).toBe('2026-01-07');

    await press(c, 'Home'); // week starts Sunday (weekStartsOn 0) → 2026-01-04
    expect(activeYmd()).toBe('2026-01-04');
    await press(c, 'End');
    expect(activeYmd()).toBe('2026-01-10');
  });

  it('PageUp/PageDown move by month, re-render, and carry real focus across', async () => {
    const c = mount(html`${Calendar({ selected: new Date(2026, 0, 15), defaultMonth: JAN_2026 })}`);
    day(c, '2026-01-15').focus();

    await press(c, 'PageDown');
    expect(caption(c)).toContain('February 2026');
    expect(focusedYmd(c)).toBe('2026-02-15');
    // The Feb grid is freshly rendered; focus followed onto the new button.
    expect(activeYmd()).toBe('2026-02-15');
    await press(c, 'PageUp');
    await press(c, 'PageUp');
    expect(caption(c)).toContain('December 2025');
    expect(activeYmd()).toBe('2025-12-15');
  });

  it('Shift+PageDown / Shift+PageUp jump a full year (±12 months) with focus', async () => {
    const c = mount(html`${Calendar({ selected: new Date(2026, 0, 15), defaultMonth: JAN_2026 })}`);
    day(c, '2026-01-15').focus();

    await press(c, 'PageDown', true);
    expect(caption(c)).toContain('January 2027');
    expect(activeYmd()).toBe('2027-01-15');
    await press(c, 'PageUp', true);
    await press(c, 'PageUp', true);
    expect(caption(c)).toContain('January 2025');
    expect(activeYmd()).toBe('2025-01-15');
  });
});

describe('Calendar — roving focus entry (a11y regression)', () => {
  // The bug rev caught: focus-init used selected-or-today without clamping to
  // the displayed month, so a defaultMonth with no visible selection left EVERY
  // day tabindex=-1 and keyboard users could not tab into the grid.
  it('exposes exactly one tabbable day, clamped to the displayed month, and is keyboard-navigable', async () => {
    // June 2030: does not contain "today" and has no selection.
    const c = mount(html`${Calendar({ defaultMonth: new Date(2030, 5, 15) })}`);
    const tabbable = c.querySelectorAll<HTMLButtonElement>('[data-day] button[tabindex="0"]');
    expect(tabbable).toHaveLength(1);

    const btn = tabbable[0]!;
    // Clamped into the visible month → its first day, not the off-screen today.
    expect((btn.closest('[data-day]') as HTMLElement).getAttribute('data-day')).toBe('2030-06-01');

    // Keyboard entry (Tab lands on the roving day), then the CALENDAR moves
    // real focus in response to a key — proving the grid is enterable AND
    // navigable, not just that a button can be focused.
    btn.focus();
    expect(document.activeElement).toBe(btn);
    q(c, '[data-slot="calendar-grid"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    flushEffects();
    await Promise.resolve();
    await Promise.resolve();
    const moved = document.activeElement as HTMLElement;
    expect((moved.closest('[data-day]') as HTMLElement).getAttribute('data-day')).toBe('2030-06-02');
    expect(moved.getAttribute('tabindex')).toBe('0');
  });

  it('prefers a visible selection for the tabbable day when one exists', () => {
    const c = mount(html`${Calendar({ selected: new Date(2030, 5, 20), defaultMonth: new Date(2030, 5, 1) })}`);
    const tabbable = c.querySelectorAll<HTMLButtonElement>('[data-day] button[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    expect((tabbable[0]!.closest('[data-day]') as HTMLElement).getAttribute('data-day')).toBe('2030-06-20');
  });
});

describe('Calendar — plain-HTML interop & attribute fallbacks', () => {
  it('drives mode / month / week start / outside-days from host attributes', () => {
    document.body.innerHTML =
      '<ui-calendar mode="range" default-month="2026-01-15T12:00:00" week-starts-on="1" show-outside-days="false"></ui-calendar>';
    flushEffects();
    const c = document.body;

    // default-month attribute → displayed month.
    expect(caption(c)).toContain('January 2026');

    // show-outside-days="false" → adjacent-month cells render empty (no data-day).
    expect(c.querySelector('[data-day="2025-12-31"]')).toBeNull();

    // week-starts-on="1" (Monday) → first column differs from a Sunday-start grid.
    const sundayRef = mount(html`${Calendar({ defaultMonth: JAN_2026, weekStartsOn: 0 })}`);
    const firstHeader = (r: ParentNode) =>
      r.querySelectorAll('th[role="columnheader"]')[0]!.textContent;
    expect(firstHeader(c)).not.toBe(firstHeader(sundayRef));

    // mode="range" → two clicks style a start/end range.
    day(c, '2026-01-10').click();
    flushEffects();
    day(c, '2026-01-14').click();
    flushEffects();
    flushEffects();
    expect(day(c, '2026-01-10').getAttribute('data-range-start')).toBe('true');
    expect(day(c, '2026-01-14').getAttribute('data-range-end')).toBe('true');
  });

  it('an explicit prop wins over the host attribute (mode precedence)', () => {
    const host = document.createElement('ui-calendar');
    host.setAttribute('mode', 'range');
    // Explicit prop set before connection must override the attribute.
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp('mode', 'single');
    host.setAttribute('default-month', '2026-01-15T12:00:00');
    document.body.appendChild(host);
    flushEffects();

    day(document.body, '2026-01-10').click();
    flushEffects();
    flushEffects();
    // single mode → data-selected-single, NOT a range start.
    expect(day(document.body, '2026-01-10').getAttribute('data-selected-single')).toBe('true');
    expect(day(document.body, '2026-01-10').getAttribute('data-range-start')).toBe('false');
  });

  it('merges className into the calendar root while keeping base classes', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026, className: 'my-cal-x' })}`);
    const root = q(c, '[data-slot="calendar"]');
    expect(root.className).toContain('my-cal-x');
    expect(root.className).toContain('group/calendar');
    expect(root.className).toContain('[--cell-size:--spacing(8)]');
  });

  // The invariant, not a sample: walk EVERY rendered element under the root and
  // assert each carries a data-slot (ADR 0022). Runs for both showOutsideDays
  // states so the hidden-outside placeholder cells are covered too.
  const assertEveryElementHasSlot = (root: HTMLElement) => {
    const missing: string[] = [];
    for (const el of Array.from(root.querySelectorAll('*'))) {
      // <each-item> is @nisli/core's list-reconciler wrapper (display:contents,
      // invisible to layout) — framework-owned, not component-authored, so it
      // is exempt from the data-slot convention.
      if (el.tagName.toLowerCase() === 'each-item') continue;
      if (!el.hasAttribute('data-slot')) {
        missing.push(`<${el.tagName.toLowerCase()}${el.className ? ` class="${el.className}"` : ''}>`);
      }
    }
    return missing;
  };

  it('stamps data-slot on EVERY rendered element (showOutsideDays=true)', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    const root = q(c, '[data-slot="calendar"]');
    expect(assertEveryElementHasSlot(root)).toEqual([]);
    // Spot-check the exhaustive names are actually present (guards a regression
    // where the walk passes because nothing rendered).
    for (const slot of [
      'calendar-months', 'calendar-month', 'calendar-caption', 'calendar-caption-label',
      'calendar-nav', 'calendar-prev', 'calendar-next', 'calendar-chevron', 'calendar-chevron-path',
      'calendar-grid', 'calendar-weekdays-head', 'calendar-weekdays', 'calendar-weekday',
      'calendar-weeks', 'calendar-week', 'calendar-day', 'calendar-day-button',
    ]) {
      expect(c.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });

  it('stamps data-slot on EVERY rendered element (showOutsideDays=false placeholders)', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026, showOutsideDays: false })}`);
    const root = q(c, '[data-slot="calendar"]');
    // There ARE hidden placeholder cells (Jan 2026 starts mid-week).
    expect(root.querySelector('td.invisible, td[aria-hidden="true"]')).not.toBeNull();
    expect(assertEveryElementHasSlot(root)).toEqual([]);
  });
});

describe('Calendar — resolved-composition doctrine (cn is clsx-style, not tailwind-merge)', () => {
  // @nisli/ui's `cn` does not merge Tailwind conflicts, so Button-composed
  // ports inline the tailwind-merge RESOLUTION of `buttonVariants(...) +
  // override` rather than the raw composition. These lock the exact resolution.
  it('nav buttons keep the resolved override AND the surviving has-[>svg]:px-3', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    const nav = q(c, '[data-slot="calendar-prev"]');
    const tokens = nav.className.split(/\s+/);

    // Overrides that win in the unmodified chain.
    expect(tokens).toContain('size-(--cell-size)');
    expect(tokens).toContain('p-0');
    // SURVIVES: `has-[>svg]:px-3` is a different modifier chain than `p-0`, so
    // tailwind-merge does not collapse it (rev's third-pass catch).
    expect(tokens).toContain('has-[>svg]:px-3');
    // The nav button really wraps a direct <svg>, so the modifier actually fires.
    expect(nav.querySelector(':scope > svg')).not.toBeNull();
    // Shadowed base classes are absent — proof we inlined the resolution, not
    // the raw `buttonVariants({ variant: 'ghost' })` default-size composition.
    expect(tokens).not.toContain('h-9');
    expect(tokens).not.toContain('px-4');
    expect(tokens).not.toContain('py-2');
  });

  it('day button is the resolved icon composition: size-auto, directional range rounding', () => {
    const c = mount(html`${Calendar({ defaultMonth: JAN_2026 })}`);
    const tokens = day(c, '2026-01-15').className.split(/\s+/);

    expect(tokens).toContain('size-auto');
    expect(tokens).toContain('min-w-(--cell-size)');
    expect(tokens).toContain('data-[range-start=true]:rounded-l-md');
    expect(tokens).toContain('data-[range-end=true]:rounded-r-md');
    // Shadowed `size="icon"`/base classes absent.
    expect(tokens).not.toContain('size-9');
    expect(tokens).not.toContain('gap-2');
    expect(tokens).not.toContain('font-medium');
    expect(tokens).not.toContain('inline-flex');
    // The old directionally-wrong endpoints must be gone.
    expect(tokens).not.toContain('data-[range-start=true]:rounded-r-none');
    expect(tokens).not.toContain('data-[range-end=true]:rounded-l-none');
  });
});
