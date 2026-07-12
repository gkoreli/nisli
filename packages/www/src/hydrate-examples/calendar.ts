/**
 * hydrate-examples/calendar.ts — the calendar preview (WWW-15).
 *
 * Static in SSG (resting: June 2024, the 9–15 range pre-selected); once hydrated,
 * clicking a day drives selection. Calendar's rendered range returns `selected`
 * whenever it is a DateRange (controlled), so a PLAIN object would pin the visual
 * and the touch would not be observable. Instead the example holds a live
 * `selected` SIGNAL and updates it from the bubbling `ui-select` event — a
 * controlled-but-reactive demo: clicking a day (e.g. the 20th, outside the initial
 * range) starts a new range there, so its `[data-slot="calendar-day-button"]`
 * becomes `aria-selected="true"` (the WWW-15 guard touch). Per-file for
 * code-splitting + auto-hydration.
 */
import { html, signal, type TemplateResult } from '@nisli/core';
import { Calendar, type DateRange } from '../nisli-ui/ui/calendar.js';

export default function calendarExample(): TemplateResult {
  const selected = signal<DateRange>({
    from: new Date(2024, 5, 9),
    to: new Date(2024, 5, 15),
  });
  const onSelect = (e: Event): void => {
    const value = (e as CustomEvent<{ value: Date | DateRange }>).detail?.value;
    if (value && !(value instanceof Date)) selected.value = value;
  };
  return html`<div @ui-select=${onSelect}>
    ${Calendar({
      mode: 'range',
      defaultMonth: new Date(2024, 5, 1),
      selected,
      className: 'rounded-md border',
    })}
  </div>`;
}
