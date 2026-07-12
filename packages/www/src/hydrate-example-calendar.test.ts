/**
 * hydrate-example-calendar.test.ts — WWW-15 focused regression: the calendar
 * hydrate example is TOUCH-OBSERVABLE (rev reject fix). A plain `selected` range
 * would pin the controlled selection so taps never flip `aria-selected`; the
 * example instead holds a live signal updated from the bubbling `ui-select`
 * event. This proves clicking an unselected enabled day (cdx2's guard candidate)
 * makes it `aria-selected="true"`.
 *
 * NB: lives in src/ (not src/hydrate-examples/) so it is NOT swept into the
 * `hydrate-examples/*.ts` glob that derives the hydrate set.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, flushEffects } from '@nisli/core';
import calendarExample from './hydrate-examples/calendar.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('WWW-15 calendar hydrate example — touch observability', () => {
  it('clicking an unselected enabled day flips its aria-selected false → true', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    html`${calendarExample()}`.mount(container);
    await Promise.resolve();
    flushEffects();

    const days = Array.from(
      container.querySelectorAll('[data-slot="calendar-day-button"]'),
    ) as HTMLButtonElement[];
    expect(days.length).toBeGreaterThan(20);

    // First enabled, not-yet-selected day — mirrors cdx2's guard candidate.
    const target = days.find(
      (b) => !b.disabled && b.getAttribute('aria-selected') !== 'true',
    );
    expect(target, 'an unselected enabled day exists').toBeTruthy();
    expect(target!.getAttribute('aria-selected')).toBe('false');

    target!.click();
    flushEffects();
    await Promise.resolve();
    flushEffects();

    // The live signal absorbed the ui-select event → the day is now selected.
    expect(target!.getAttribute('aria-selected')).toBe('true');
  });
});
