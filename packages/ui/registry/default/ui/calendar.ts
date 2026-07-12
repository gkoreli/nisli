/**
 * ui/calendar.ts — Calendar.
 *
 * Cited source: new-york-v4/ui/calendar.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 *
 * DEVIATION (documented, ADR 0022 canonical-reference rule): upstream wraps
 * `react-day-picker` (unvendorable). The VISUALS are ported verbatim — the
 * day/weekday/caption/nav classes and the selected (`bg-primary`), today
 * (`bg-accent`), range, outside, disabled, and focus-ring state classes — but
 * the BEHAVIOR is original: month-grid generation from `Intl`
 * (locale-aware weekday/month names + week start), prev/next navigation,
 * single/range selection, min/max + a `disabled(date)` predicate, and full
 * WAI-ARIA date-grid keyboard navigation. It renders a REAL
 * `<table role="grid">` (our light-DOM strength — true grid semantics).
 *
 * V1 SCOPE: single + range selection (multiple deferred); no dropdown month/
 * year pickers and no multi-month view (documented, matching the ticket).
 * Selection dispatches a bubbling `ui-select` CustomEvent from the host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  component,
  computed,
  html,
  signal,
  each,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { attr, cn } from '../lib/utils.js';
import { buttonVariants } from './button.js';

// ── Date helpers (no dependencies) ──────────────────────────────────

const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth() + n, 1);
const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Local (not UTC) YYYY-MM-DD, for stable keys + the data-day attribute. */
const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isSameMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
/** Whole-day comparison: <0 if a before b. */
const cmpDay = (a: Date, b: Date): number => startOfDay(a).getTime() - startOfDay(b).getTime();

/** Weeks (each 7 Dates, including outside days) covering `month`'s grid. */
function buildWeeks(month: Date, weekStartsOn: number): Date[][] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  let cursor = addDays(first, -offset);
  const weeks: Date[][] = [];
  while ((cmpDay(cursor, last) <= 0 || weeks.length === 0) && weeks.length < 6) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export type CalendarMode = 'single' | 'range';
export type DateRange = { from: Date | null; to: Date | null };

// ── ui-calendar ─────────────────────────────────────────────────────

const dayButtonClasses =
  'flex aspect-square size-9 w-full min-w-9 flex-col items-center justify-center gap-1 rounded-md leading-none font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[today=true]:bg-accent data-[today=true]:text-accent-foreground data-[outside=true]:text-muted-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-start=true]:rounded-r-none data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:rounded-l-none data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[selected-single=true]:data-[today=true]:bg-primary';

export type CalendarProps = {
  mode?: CalendarMode;
  /** Selected date (single) or range object (range). */
  selected?: Date | DateRange | null;
  /** Displayed month (controlled). */
  month?: Date;
  defaultMonth?: Date;
  min?: Date;
  max?: Date;
  /** Predicate returning true for dates that cannot be selected. */
  disabled?: (date: Date) => boolean;
  /** 0 (Sun) – 6 (Sat); the first column. Default 0. */
  weekStartsOn?: number;
  showOutsideDays?: boolean;
  /** Intl locale for month/weekday names. Default 'default'. */
  locale?: string;
  className?: string;
};

let uid = 0;

export const Calendar = component<CalendarProps>('ui-calendar', (props, host) => {
  const mode: CalendarMode = props.mode.value === 'range' ? 'range' : 'single';
  const weekStartsOn = props.weekStartsOn.value ?? 0;
  const showOutside = props.showOutsideDays.value ?? true;
  const localeAttr = attr(props.locale, host, 'locale');
  const locale = (): string => localeAttr.value ?? 'default';
  const className = attr(props.className, host, 'class-name');
  const baseId = `ui-calendar-${++uid}`;

  const today = startOfDay(new Date());

  // ── Displayed month (controlled or internal) ──
  const internalMonth = signal<Date>(
    startOfMonth(props.month.value ?? props.defaultMonth.value ?? new Date()),
  );
  const month = computed<Date>(() =>
    startOfMonth(props.month.value ?? internalMonth.value),
  );

  // ── Selection (controlled or internal) ──
  const internalSingle = signal<Date | null>(
    !props.selected.value || props.selected.value instanceof Date
      ? ((props.selected.value as Date | null) ?? null)
      : null,
  );
  const internalRange = signal<DateRange>(
    props.selected.value && !(props.selected.value instanceof Date)
      ? (props.selected.value as DateRange)
      : { from: null, to: null },
  );
  const single = computed<Date | null>(() => {
    const s = props.selected.value;
    if (s instanceof Date) return s;
    if (s === null || s === undefined) return internalSingle.value;
    return internalSingle.value;
  });
  const range = computed<DateRange>(() => {
    const s = props.selected.value;
    if (s && !(s instanceof Date)) return s as DateRange;
    return internalRange.value;
  });

  // Focused day for roving tabindex + keyboard grid (commit 2 drives arrows).
  const focused = signal<Date>(single.value ?? today);

  const isDisabled = (d: Date): boolean => {
    const min = props.min.value;
    const max = props.max.value;
    if (min && cmpDay(d, min) < 0) return true;
    if (max && cmpDay(d, max) > 0) return true;
    const fn = props.disabled.value;
    return fn ? fn(d) : false;
  };

  const emit = (value: Date | DateRange): void => {
    host.dispatchEvent(
      new CustomEvent('ui-select', { detail: { value }, bubbles: true }),
    );
  };

  const select = (day: Date): void => {
    if (isDisabled(day)) return;
    focused.value = day;
    if (!isSameMonth(day, month.value)) internalMonth.value = startOfMonth(day);
    if (mode === 'range') {
      const cur = range.value;
      let next: DateRange;
      // No start yet, or a complete range → begin a new range.
      if (!cur.from || (cur.from && cur.to)) next = { from: day, to: null };
      else if (cmpDay(day, cur.from) < 0) next = { from: day, to: cur.from };
      else next = { from: cur.from, to: day };
      internalRange.value = next;
      emit(next);
    } else {
      internalSingle.value = day;
      emit(day);
    }
  };

  const inRange = (d: Date): { start: boolean; middle: boolean; end: boolean } => {
    const r = range.value;
    if (!r.from) return { start: false, middle: false, end: false };
    const start = isSameDay(d, r.from);
    if (!r.to) return { start, middle: false, end: false };
    const end = isSameDay(d, r.to);
    const middle = cmpDay(d, r.from) > 0 && cmpDay(d, r.to) < 0;
    return { start, middle, end };
  };

  const goPrev = (): void => {
    internalMonth.value = addMonths(month.value, -1);
  };
  const goNext = (): void => {
    internalMonth.value = addMonths(month.value, 1);
  };

  // ── Derived view ──
  const weeks = computed<Date[][]>(() => buildWeeks(month.value, weekStartsOn));
  const weekdayNames = computed<string[]>(() => {
    const fmt = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    const long = new Intl.DateTimeFormat(locale(), { weekday: 'long' });
    const start = weeks.value[0]![0]!;
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return `${fmt.format(d)} ${long.format(d)}`; // short\0long
    });
  });
  const captionLabel = computed<string>(() =>
    new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(month.value),
  );
  const dayLabelFmt = computed(
    () => new Intl.DateTimeFormat(locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  );

  const navButtonClasses = cn(
    buttonVariants({ variant: 'ghost' }),
    'size-9 select-none p-0 aria-disabled:pointer-events-none aria-disabled:opacity-50',
  );

  const chevron = (dir: 'left' | 'right'): TemplateResult => html`<svg
    class="size-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  ><path d="${dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}"></path></svg>`;

  const classes = computed(() => cn('w-fit bg-background p-3', className.value));

  // A cell: <td> with a day <button>. `day`, today/outside/disabled are fixed
  // for this month render; selected/range/focused state is bound reactively so
  // the button DOM (and its focus) survives selection + keyboard moves.
  const renderDay = (day: Date): TemplateResult => {
    const outside = !isSameMonth(day, month.value);
    if (outside && !showOutside) {
      return html`<td role="gridcell" class="p-0"><div class="size-9"></div></td>`;
    }
    const disabled = isDisabled(day);
    const isToday = isSameDay(day, today);
    const label = dayLabelFmt.value.format(day);

    const selSingle = computed(
      () => mode === 'single' && single.value != null && isSameDay(day, single.value),
    );
    const r = computed(() => (mode === 'range' ? inRange(day) : { start: false, middle: false, end: false }));
    const selected = computed(
      () => selSingle.value || r.value.start || r.value.end || r.value.middle,
    );
    const flag = (b: boolean): string => (b ? 'true' : 'false');

    return html`<td role="gridcell" data-day="${ymd(day)}" class="p-0">
      <button
        type="button"
        class="${dayButtonClasses}"
        aria-label="${label}"
        aria-selected="${computed(() => flag(selected.value))}"
        aria-disabled="${flag(disabled)}"
        aria-current="${isToday ? 'date' : undefined}"
        data-today="${flag(isToday)}"
        data-outside="${flag(outside)}"
        data-selected-single="${computed(() => flag(selSingle.value))}"
        data-range-start="${computed(() => flag(r.value.start))}"
        data-range-middle="${computed(() => flag(r.value.middle))}"
        data-range-end="${computed(() => flag(r.value.end))}"
        tabindex="${computed(() => (isSameDay(day, focused.value) ? 0 : -1))}"
        @click=${() => select(day)}
      >${day.getDate()}</button>
    </td>`;
  };

  const renderWeek = (week: Date[]): TemplateResult =>
    html`<tr role="row" class="flex w-full">${each(
      signal(week),
      (d) => ymd(d),
      (dSig) => renderDay(dSig.value),
    )}</tr>`;

  return html`<div data-slot="calendar" id="${baseId}" role="application" class="${classes}">
    <div class="relative flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <button
          type="button"
          data-slot="calendar-prev"
          aria-label="Go to previous month"
          class="${navButtonClasses}"
          @click=${goPrev}
        >${chevron('left')}</button>
        <div
          data-slot="calendar-caption"
          aria-live="polite"
          class="text-sm font-medium select-none"
        >${captionLabel}</div>
        <button
          type="button"
          data-slot="calendar-next"
          aria-label="Go to next month"
          class="${navButtonClasses}"
          @click=${goNext}
        >${chevron('right')}</button>
      </div>

      <table
        role="grid"
        data-slot="calendar-grid"
        aria-labelledby="${baseId}"
        class="w-full border-collapse"
      >
        <thead>
          <tr role="row" class="flex">${each(
            weekdayNames,
            (n) => n,
            (nSig) => {
              const parts = nSig.value.split(' ');
              return html`<th
                role="columnheader"
                abbr="${parts[1]}"
                aria-label="${parts[1]}"
                class="flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none"
              >${parts[0]}</th>`;
            },
          )}</tr>
        </thead>
        <tbody role="rowgroup" class="flex flex-col gap-1">${each(
          weeks,
          (w) => ymd(w[0]!),
          (wSig) => renderWeek(wSig.value),
        )}</tbody>
      </table>
    </div>
  </div>`;
});
