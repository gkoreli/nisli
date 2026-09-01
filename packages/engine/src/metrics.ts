/**
 * Structural metrics — the numbers the engine needs to *decide*: spacing,
 * control size, layout thresholds. Nothing here is a colour, a font, a border
 * or a shadow; those live in a skin, and the engine works without one.
 *
 * The numbers are a function of the sizing axes (density, input — ADR 0046):
 * `metricsFor()` is the pure table for one context, and `metrics` is the
 * door — one object at every read, whose groups are live over the axes.
 */
import { computed } from '@nisli/core';
import { sizing, type Axes } from './engine/axes.js';

/** The literal table for the default context (comfortable, pointer). Its keys are the schema. */
const COMFORTABLE = {
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 },
  /** A control's height and horizontal padding; `check` is a checkbox's side; `hit` the smallest side any target may have. */
  control: { height: 32, padX: 12, check: 16, hit: 24 },
  /**
   * Average glyph width at body size. Estimates use it, and so do the
   * budget decisions (`columnBudgets`, a chart's label budget): a budget in
   * characters becomes px through this number, calibrated to the default
   * skin. A skin with a wider face retunes it (or the char budgets) here —
   * `verify()` in Chromium is the honest check that it still holds.
   */
  charWidth: 7.2,
  /**
   * The z-order of everything that floats or pins. Page chrome pins below
   * the app bar; overlay kinds are bases a layer adds its stack position to,
   * and the order is the paint order: a popover above every modal, a notice
   * above everything.
   */
  layer: { sticky: 10, bar: 20, modal: 100, popover: 150, passive: 200 },
  layout: {
    /** Sidebar width when the shell has room for one. */
    sidebarWidth: 232,
    /** The narrowest content column worth having beside a sidebar. */
    contentMin: 560,
    /** Content never grows wider than this; it centres instead. */
    contentMax: 1120,
    /** A grid cell narrower than this is not worth a column. */
    minColumn: 220,
    /** A form field narrower than this is not worth a column. */
    minField: 240,
    /** A bar-chart label column is never narrower than this. */
    minLabel: 64,
    /** A dialog becomes a full-screen sheet below this viewport width. */
    dialogMin: 640,
    dialogWidth: 520,
    /** A text column may truncate down to this before anything else gives. */
    minTextColumn: 96,
    /** A title may truncate down to this. */
    minTitle: 80,
    /** A menu is never narrower than this; also its size for placement before it is laid out. */
    menuWidth: 160,
    /** Rows a table shows before asking; a long list is a decision, not a scroll. */
    tablePage: 60,
    /** A date cell's budget, characters — the widest short date ("Sep 30" and a breath). A longer format truncates and files FIGURE_TRUNCATED; raise it here, once. */
    dateChars: 8,
    /** A money or number cell's budget, characters: sign, symbol, separators and decimals included ("-$123,456.78"). */
    figureChars: 12,
    /** A text column never takes more than this from its share; slack after folding may still widen it. */
    textColumnCap: 320,
    /** A bar chart's label column budget, characters; a longer label truncates inside it. */
    labelChars: 20,
    /** A chart axis label's budget, characters; which labels show is then a function of width and count, never of the strings. */
    axisChars: 8,
  },
} as const;

/** Compact spends less on rhythm and shortens controls; it moves no floor (F9). Steps stay distinct so adjacent gaps never collapse into one. */
const COMPACT = { space: { 1: 4, 2: 6, 3: 8, 4: 12, 5: 16, 6: 24 }, control: { height: 28, padX: 8 } } as const;
/** Touch floors, through `max`: a control is at least `hit` tall, a checkbox `check`. */
const TOUCH = { height: 44, check: 24, hit: 44 } as const;

export type LayoutKey = keyof typeof COMFORTABLE.layout;
/** The layout thresholds — floors and budgets; one column for every context. */
export type Layout = Readonly<Record<LayoutKey, number>>;

export interface Metrics {
  readonly space: Readonly<Record<1 | 2 | 3 | 4 | 5 | 6, number>>;
  readonly control: { readonly height: number; readonly padX: number; readonly check: number; readonly hit: number };
  readonly charWidth: number;
  readonly layer: { readonly sticky: number; readonly bar: number; readonly modal: number; readonly popover: number; readonly passive: number };
  readonly layout: Layout;
}

/**
 * The table for one context. Pure: `{ density: 'comfortable', input: 'pointer' }`
 * is `COMFORTABLE`, deeply equal. Density scales `space` and `control`;
 * input floors `control` through `max`; `charWidth`, `layer` and `layout`
 * never move (ADR 0046 §3).
 */
export function metricsFor({ density, input }: Pick<Axes, 'density' | 'input'>): Metrics {
  const compact = density === 'compact';
  const touch = input === 'touch';
  const height = compact ? COMPACT.control.height : COMFORTABLE.control.height;
  return {
    space: compact ? COMPACT.space : COMFORTABLE.space,
    control: {
      height: touch ? Math.max(height, TOUCH.height) : height,
      padX: compact ? COMPACT.control.padX : COMFORTABLE.control.padX,
      check: touch ? TOUCH.check : COMFORTABLE.control.check,
      hit: touch ? TOUCH.hit : COMFORTABLE.control.hit,
    },
    charWidth: COMFORTABLE.charWidth,
    layer: COMFORTABLE.layer,
    layout: COMFORTABLE.layout,
  };
}

/** The current table; re-decided only when a sizing axis moves, never on a scheme flip. */
const current = computed(() => metricsFor(sizing.value));

/**
 * The door: one object, every group a live read of the current table. A read
 * inside a reactive scope (a `host` effect, a `ctx.part()` thunk, a computed)
 * follows the axes; a read outside one holds the table of that moment.
 */
export const metrics: Metrics = {
  get space() { return current.value.space; },
  get control() { return current.value.control; },
  get charWidth() { return current.value.charWidth; },
  get layer() { return current.value.layer; },
  get layout() { return current.value.layout; },
};
