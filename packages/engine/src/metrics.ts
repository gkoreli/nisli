/**
 * Structural metrics — the numbers the engine needs to *decide*: spacing,
 * control size, layout thresholds. Nothing here is a colour, a font, a border
 * or a shadow; those live in a skin, and the engine works without one.
 */
export const metrics = {
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 },
  /** A control's height and horizontal padding; `check` is a checkbox's side. */
  control: { height: 32, padX: 12, check: 16 },
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

export type Metrics = typeof metrics;
