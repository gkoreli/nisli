/**
 * Structural metrics — the numbers the engine needs to *decide*: spacing,
 * control size, layout thresholds. Nothing here is a colour, a font, a border
 * or a shadow; those live in a skin, and the engine works without one.
 */
export const metrics = {
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 },
  /** A control's height and horizontal padding; `check` is a checkbox's side. */
  control: { height: 32, padX: 12, check: 16 },
  /** Average glyph width at body size; used only for estimates. */
  charWidth: 7.2,
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
    /** Rows a table shows before asking; a long list is a decision, not a scroll. */
    tablePage: 60,
  },
} as const;

export type Metrics = typeof metrics;
