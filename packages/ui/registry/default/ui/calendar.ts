/**
 * ui/calendar.ts — Calendar.
 *
 * Cited source: new-york-v4/ui/calendar.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 *
 * This component ports v4's calendar. Because there is no "verbatim" summary to
 * hide behind, EVERY adaptation is enumerated below; the class strings are
 * ported at the equivalent element, and where the string differs from upstream
 * the reason is stated.
 *
 * ADAPTATIONS (exhaustive):
 *
 * 1. ENGINE. Upstream wraps `react-day-picker` (unvendorable). The behavior is
 *    reimplemented from `Intl`: month-grid generation (locale-aware weekday/
 *    month names + week start), prev/next nav, single/range selection, min/max
 *    + a `disabled(date)` predicate, and full WAI-ARIA date-grid keyboard nav.
 *
 * 2. LAYOUT / CLASS PARITY. Ported at the equivalent element, matching v4's
 *    `classNames` map: root (`group/calendar w-fit bg-background p-3
 *    [--cell-size:--spacing(8)]` + contextual `bg-transparent`), months
 *    (`relative flex flex-col gap-4 md:flex-row`), month (`flex w-full
 *    flex-col gap-4`), month_caption (`flex h-(--cell-size) w-full
 *    items-center justify-center px-(--cell-size)`) + caption_label
 *    (`text-sm font-medium select-none`), nav (`absolute inset-x-0 top-0 flex
 *    w-full items-center justify-between gap-1`), month_grid (`w-full
 *    border-collapse`), weekdays (`flex`), weekday, week (`mt-2 flex w-full`),
 *    day cell (`group/day relative aspect-square h-full w-full p-0 text-center
 *    select-none` + the first/last-child range-rounding selectors + the
 *    today/outside/disabled/range_start/range_middle/range_end modifier
 *    classes), and the DayButton class list.
 *
 * 3. `cn` IS CLSX-STYLE, NOT tailwind-merge. Upstream composes the nav buttons
 *    and DayButton as `<Button …>` + an override string and lets twMerge drop
 *    the shadowed Button-chrome classes. Our `cn` does not merge, so emitting
 *    `buttonVariants()` verbatim would leave BOTH the shadowed class and its
 *    override (e.g. `size-9` next to `size-auto`, `h-9` next to
 *    `size-(--cell-size)`) — a real sizing conflict. `dayButtonClasses` and
 *    `navButtonClasses` are therefore the tailwind-merge RESOLUTION of
 *    upstream's composition, inlined. Dropped-as-shadowed, per pair:
 *    DayButton — `inline-flex`→`flex`, `gap-2`→`gap-1`, `font-medium`→
 *    `font-normal`, `size-9`(from `size="icon"`)→`size-auto`; nav — `h-9`→
 *    `size-(--cell-size)`, unmodified `px-4`/`py-2`→`p-0`. tailwind-merge only
 *    collapses utilities WITHIN a modifier chain, so nav's `has-[>svg]:px-3`
 *    (default size) does NOT conflict with the unmodified `p-0` and survives —
 *    it is retained in `navButtonClasses`, not dropped. Everything else in both
 *    strings is upstream's Button base + `ghost` variant + the upstream
 *    override, byte-for-byte.
 *
 * 4. STRUCTURE. Renders a REAL semantic `<table role="grid">` with `<thead>`/
 *    `<tbody>` (light-DOM strength — true grid semantics; rdp uses flex rows).
 *    `data-day` (local `YYYY-MM-DD`, not `toLocaleDateString`) and the
 *    `group/day` focus group live on the CELL, and the roving `data-focused`
 *    that drives DayButton's `group-data-[focused=true]/day:*` ring is set on
 *    the cell — so the upstream DayButton focus classes work unchanged.
 *
 * 5. DROPPED (V1 scope / non-applicable). Upstream's RTL chevron hooks
 *    (`rtl:**:[.rdp-button_*>svg]:rotate-180`) target react-day-picker's
 *    internal DOM, absent here. The dropdown/caption-layout and week-number
 *    classNames (no dropdown month/year pickers, no week numbers, no
 *    multi-month view in V1). `defaultClassNames.*` (rdp-internal, non-visual).
 *
 * 6. `data-slot` on every rendered element is ours (ADR 0022 light-DOM
 *    convention); upstream sets `data-slot="calendar"` on Root only.
 *
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
  type TemplateResult,
} from '@nisli/core';
import { attr, boolAttr, cn, transparentHost } from '../lib/utils.js';
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

// tailwind-merge resolution of upstream's `<Button variant="ghost" size="icon"
// className={…}>` (see header adaptation 3). Button base + ghost variant, with
// the DayButton `className` overriding the shadowed size/gap/font/display
// classes. Byte-for-byte upstream otherwise.
const dayButtonClasses =
  'shrink-0 items-center justify-center rounded-md text-sm whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground dark:hover:text-accent-foreground [&>span]:text-xs [&>span]:opacity-70';

// tailwind-merge resolution of upstream's `cn(buttonVariants({ variant:
// "ghost" }), "size-(--cell-size) p-0 select-none aria-disabled:opacity-50")`.
// `h-9`→`size-(--cell-size)`; the unmodified `px-4`/`py-2`→`p-0`. NOTE:
// `has-[>svg]:px-3` (default size) lives in a DIFFERENT modifier chain than the
// unmodified `p-0`, so tailwind-merge does NOT collapse it — it survives, and
// since both nav buttons wrap a direct <svg> it is a real class. Retained here.
const navButtonClasses =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 has-[>svg]:px-3 size-(--cell-size) p-0 select-none aria-disabled:opacity-50';

// Upstream `day` cell (non-showWeekNumber branch), ported verbatim.
const dayCellBase =
  'group/day relative aspect-square h-full w-full p-0 text-center select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md';

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
  transparentHost(host);

  // Attribute fallbacks for plain-HTML usage; explicit props always win.
  const parseDateAttr = (name: string): Date | undefined => {
    const raw = host.getAttribute(name);
    if (!raw) return undefined;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  const modeAttr = attr(props.mode, host, 'mode');
  const mode: CalendarMode = modeAttr.value === 'range' ? 'range' : 'single';
  const weekStartsOn =
    props.weekStartsOn.value ??
    (host.hasAttribute('week-starts-on') ? Number(host.getAttribute('week-starts-on')) : 0);
  const showOutside = boolAttr(props.showOutsideDays, host, 'show-outside-days', true).value;
  const localeAttr = attr(props.locale, host, 'locale');
  const locale = (): string => localeAttr.value ?? 'default';
  const className = attr(props.className, host, 'class-name');
  const baseId = `ui-calendar-${++uid}`;

  const propMonth = (): Date | undefined => props.month.value ?? parseDateAttr('month');
  const propDefaultMonth = (): Date | undefined =>
    props.defaultMonth.value ?? parseDateAttr('default-month');
  const propMin = (): Date | undefined => props.min.value ?? parseDateAttr('min');
  const propMax = (): Date | undefined => props.max.value ?? parseDateAttr('max');

  const today = startOfDay(new Date());

  // ── Displayed month (controlled or internal) ──
  const internalMonth = signal<Date>(
    startOfMonth(propMonth() ?? propDefaultMonth() ?? new Date()),
  );
  const month = computed<Date>(() =>
    startOfMonth(propMonth() ?? internalMonth.value),
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

  // Focused day for the roving tabindex + keyboard grid. CRITICAL: it must be
  // a day IN the displayed month, or every cell renders tabindex=-1 and
  // keyboard users can't tab into the grid. Prefer a visible selection, else
  // today-if-visible, else the first of the month.
  const initialFocus = (): Date => {
    const m = month.value;
    const s = single.value;
    if (s && isSameMonth(s, m)) return s;
    if (isSameMonth(today, m)) return today;
    return startOfMonth(m);
  };
  const focused = signal<Date>(initialFocus());

  const isDisabled = (d: Date): boolean => {
    const min = propMin();
    const max = propMax();
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

  // ── Keyboard grid navigation (WAI-ARIA date-grid pattern) ──
  /** Shift by whole months, clamping the day to the target month's length. */
  const monthShift = (d: Date, delta: number): Date => {
    const m = new Date(d.getFullYear(), d.getMonth() + delta, 1);
    const lastDay = endOfMonth(m).getDate();
    return new Date(m.getFullYear(), m.getMonth(), Math.min(d.getDate(), lastDay));
  };
  const focusOn = (target: Date): void => {
    focused.value = target;
    if (!isSameMonth(target, month.value)) internalMonth.value = startOfMonth(target);
    // Focus the (persisted or newly rendered) day button after the DOM settles.
    queueMicrotask(() => {
      const btn = host.querySelector<HTMLElement>(`[data-day="${ymd(target)}"] button`);
      btn?.focus();
    });
  };
  const onGridKeydown = (e: KeyboardEvent): void => {
    const cur = focused.value;
    const dow = (cur.getDay() - weekStartsOn + 7) % 7;
    let target: Date | null = null;
    switch (e.key) {
      case 'ArrowLeft': target = addDays(cur, -1); break;
      case 'ArrowRight': target = addDays(cur, 1); break;
      case 'ArrowUp': target = addDays(cur, -7); break;
      case 'ArrowDown': target = addDays(cur, 7); break;
      case 'Home': target = addDays(cur, -dow); break; // start of week
      case 'End': target = addDays(cur, 6 - dow); break; // end of week
      case 'PageUp': target = monthShift(cur, e.shiftKey ? -12 : -1); break;
      case 'PageDown': target = monthShift(cur, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    focusOn(target);
  };

  // ── Derived view ──
  const weeks = computed<Date[][]>(() => buildWeeks(month.value, weekStartsOn));
  const weekdayNames = computed<string[]>(() => {
    const fmt = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    const long = new Intl.DateTimeFormat(locale(), { weekday: 'long' });
    const start = weeks.value[0]![0]!;
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return `${fmt.format(d)} ${long.format(d)}`; // short + long
    });
  });
  const captionLabel = computed<string>(() =>
    new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(month.value),
  );
  const dayLabelFmt = computed(
    () => new Intl.DateTimeFormat(locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  );

  const chevron = (dir: 'left' | 'right'): TemplateResult => html`<svg
    data-slot="calendar-chevron"
    class="size-4"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  ><path data-slot="calendar-chevron-path" d="${dir === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}"></path></svg>`;

  // Root classes ported from calendar.tsx (group/calendar, --cell-size,
  // contextual bg-transparent inside card/popover). The RTL chevron-rotate
  // utilities target react-day-picker's internal `.rdp-button_*` classes and
  // do not apply to our structure (header adaptation 5), so they are omitted.
  const classes = computed(() =>
    cn(
      'group/calendar w-fit bg-background p-3 [--cell-size:--spacing(8)] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent',
      className.value,
    ),
  );

  // A cell: <td> (upstream `day`) with a day <button> (upstream DayButton).
  // today/outside/disabled are fixed for this month render; selected/range/
  // focused state is bound reactively so the button DOM (and its focus)
  // survives selection + keyboard moves. The cell carries `group/day` and
  // `data-focused` so the DayButton's `group-data-[focused=true]/day:*` ring
  // and `data-selected` week-edge rounding fire (header adaptation 4).
  const renderDay = (day: Date): TemplateResult => {
    const outside = !isSameMonth(day, month.value);
    if (outside && !showOutside) {
      // Upstream `hidden` modifier → an inert `invisible` cell that keeps grid
      // layout. data-slot on both elements (header adaptation 6).
      return html`<td
        role="gridcell"
        data-slot="calendar-day"
        aria-hidden="true"
        class="${cn(dayCellBase, 'invisible')}"
      ><div data-slot="calendar-day-button" class="size-(--cell-size)"></div></td>`;
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

    // Cell class = upstream `day` + the applicable modifier classNames
    // (today / outside / disabled / range_start / range_middle / range_end),
    // each ported verbatim from calendar.tsx.
    const cellClasses = computed(() =>
      cn(
        dayCellBase,
        isToday && 'rounded-md bg-accent text-accent-foreground data-[selected=true]:rounded-none',
        outside && 'text-muted-foreground aria-selected:text-muted-foreground',
        disabled && 'text-muted-foreground opacity-50',
        r.value.start && 'rounded-l-md bg-accent',
        r.value.middle && 'rounded-none',
        r.value.end && 'rounded-r-md bg-accent',
      ),
    );

    return html`<td
      role="gridcell"
      data-slot="calendar-day"
      data-day="${ymd(day)}"
      data-selected="${computed(() => flag(selected.value))}"
      data-focused="${computed(() => flag(isSameDay(day, focused.value)))}"
      class="${cellClasses}"
    >
      <button
        type="button"
        data-slot="calendar-day-button"
        class="${dayButtonClasses}"
        aria-label="${label}"
        aria-selected="${computed(() => flag(selected.value))}"
        aria-disabled="${flag(disabled)}"
        aria-current="${isToday ? 'date' : undefined}"
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
    html`<tr role="row" data-slot="calendar-week" class="mt-2 flex w-full">${each(
      signal(week),
      (d) => ymd(d),
      (dSig) => renderDay(dSig.value),
    )}</tr>`;

  // Structure mirrors v4: months (relative, for the absolute nav) → month
  // (caption + grid) with the nav overlaid at the top (header adaptation 2).
  return html`<div data-slot="calendar" id="${baseId}" role="application" class="${classes}">
    <div data-slot="calendar-months" class="relative flex flex-col gap-4 md:flex-row">
      <div data-slot="calendar-month" class="flex w-full flex-col gap-4">
        <div
          data-slot="calendar-caption"
          aria-live="polite"
          class="flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)"
        ><span data-slot="calendar-caption-label" class="text-sm font-medium select-none">${captionLabel}</span></div>

        <table
          role="grid"
          data-slot="calendar-grid"
          aria-labelledby="${baseId}"
          class="w-full border-collapse"
          @keydown=${onGridKeydown}
        >
          <thead data-slot="calendar-weekdays-head">
            <tr role="row" data-slot="calendar-weekdays" class="flex">${each(
              weekdayNames,
              (n) => n,
              (nSig) => {
                const parts = nSig.value.split(' ');
                return html`<th
                  role="columnheader"
                  data-slot="calendar-weekday"
                  abbr="${parts[1]}"
                  aria-label="${parts[1]}"
                  class="flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none"
                >${parts[0]}</th>`;
              },
            )}</tr>
          </thead>
          <tbody role="rowgroup" data-slot="calendar-weeks" class="flex flex-col">${each(
            weeks,
            (w) => ymd(w[0]!),
            (wSig) => renderWeek(wSig.value),
          )}</tbody>
        </table>
      </div>

      <div
        data-slot="calendar-nav"
        class="absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1"
      >
        <button
          type="button"
          data-slot="calendar-prev"
          aria-label="Go to previous month"
          class="${navButtonClasses}"
          @click=${goPrev}
        >${chevron('left')}</button>
        <button
          type="button"
          data-slot="calendar-next"
          aria-label="Go to next month"
          class="${navButtonClasses}"
          @click=${goNext}
        >${chevron('right')}</button>
      </div>
    </div>
  </div>`;
});
