/**
 * Appearance — the skin layer.
 *
 * The contract, in four sentences:
 *   1. The engine places *parts*; a skin dresses them. A block never names a
 *      colour, font, border, radius or shadow — it asks `look('button.primary')`.
 *   2. A skin is a map from every part to a style record, or a function of the
 *      context axes (scheme, density, input — `engine/axes.ts`) returning that
 *      map. A complete skin defines EVERY part; `skin.test.ts` enforces it for
 *      the default skin.
 *   3. A skin never contains layout. Widths, gaps, columns, what is shown or
 *      hidden belong to the engine and its metrics; a skin that sets `display`
 *      or `width` is lying about what it is.
 *   4. The engine owns the eyes-decision "is it dark?" (`engine/axes.ts`):
 *      with no preference set it follows the platform, reactively, and this
 *      module sets `color-scheme` on the document so native controls follow
 *      the skin.
 *
 * With no skin installed every `look()` is empty and blocks render bare —
 * correct, plain, fully laid out.
 */
import { signal, computed, effect } from '@nisli/core';
import { axes, scheme, setScheme, setDensity, setInput, type Axes, type Scheme, type Density, type Input } from './engine/axes.js';
import type { StyleRecord } from './style.js';

// ── The part vocabulary ────────────────────────────────────────────────
// Names are stable API: blocks reference them, skins define them. Grouped by
// family; each family is one kind of thing the engine places.

/** Surface — the planes things sit on. */
export type SurfacePart =
  | 'surface' | 'surface.sunken' | 'surface.raised'
  | 'card' | 'card.nested' | 'divider'
  | 'overlay' | 'dialog' | 'skeleton';
/** Text — roles a run of text can have, plus the tones that colour a meaning. */
export type TextPart =
  | 'text' | 'text.muted' | 'text.faint' | 'text.code' | 'text.heading' | 'text.title' | 'text.display' | 'text.label'
  | 'tone.positive' | 'tone.negative' | 'tone.warning' | 'tone.neutral'
  | 'brand' | 'link';
/** Control — things a person operates. */
export type ControlPart =
  | 'button' | 'button.primary' | 'button.plain' | 'button.quiet' | 'button.danger' | 'button.busy'
  | 'input' | 'input.invalid' | 'input.readonly';
/** Navigation — how a person moves between screens. */
export type NavigationPart =
  | 'nav.link' | 'nav.link.active' | 'nav.side' | 'bar'
  | 'menu' | 'menu.item' | 'menu.item.danger';
/** Data — tables, meters and charts. */
export type DataPart =
  | 'table.header' | 'table.cell' | 'table.row.hover'
  | 'meter.track' | 'meter.fill' | 'meter.fill.warning' | 'meter.fill.negative'
  | 'chart.axis' | 'chart.bar' | 'chart.bar.positive' | 'chart.bar.negative' | 'chart.bar.warning';
/** Feedback — what the engine says back to the person. */
export type FeedbackPart =
  | 'notice' | 'notice.positive' | 'notice.negative' | 'notice.warning';

export type Part = SurfacePart | TextPart | ControlPart | NavigationPart | DataPart | FeedbackPart;

/** Every part, in family order. A complete skin defines each one. */
export const PARTS: readonly Part[] = [
  // Surface
  'surface', 'surface.sunken', 'surface.raised', 'card', 'card.nested', 'divider', 'overlay', 'dialog', 'skeleton',
  // Text
  'text', 'text.muted', 'text.faint', 'text.code', 'text.heading', 'text.title', 'text.display', 'text.label',
  'tone.positive', 'tone.negative', 'tone.warning', 'tone.neutral', 'brand', 'link',
  // Control
  'button', 'button.primary', 'button.plain', 'button.quiet', 'button.danger', 'button.busy', 'input', 'input.invalid', 'input.readonly',
  // Navigation
  'nav.link', 'nav.link.active', 'nav.side', 'bar', 'menu', 'menu.item', 'menu.item.danger',
  // Data
  'table.header', 'table.cell', 'table.row.hover', 'meter.track', 'meter.fill', 'meter.fill.warning', 'meter.fill.negative',
  'chart.axis', 'chart.bar', 'chart.bar.positive', 'chart.bar.negative', 'chart.bar.warning',
  // Feedback
  'notice', 'notice.positive', 'notice.negative', 'notice.warning',
];

// ── Context axes ───────────────────────────────────────────────────────
// The axes are the engine's (`engine/axes.ts`); re-exported here so a skin
// author and `index.ts` need one import.

export { scheme, setScheme, type Axes, type Scheme };

/** What a skin may vary on: the resolved axes. */
export type SkinAxes = Axes;

export type SkinParts = Partial<Record<Part, StyleRecord>>;

/** A skin is either a fixed set of parts or a function of the context axes. */
export type Skin = SkinParts | ((axes: Axes) => SkinParts);

export interface SkinOptions {
  /** `'system'` (default) follows the platform preference, live. */
  scheme?: Scheme | 'system';
  /** `'system'` (default) is `comfortable`. */
  density?: Density | 'system';
  /** `'system'` (default) follows `(pointer: coarse)`, live. */
  input?: Input | 'system';
}

// ── State ──────────────────────────────────────────────────────────────

const installed = signal<Skin | null>(null);

const parts = computed<SkinParts>(() => {
  const skin = installed.value;
  if (!skin) return {};
  return typeof skin === 'function' ? skin(axes.value) : skin;
});

// Native controls, scrollbars and form widgets follow the skin's scheme: one
// effect over the axes and the install. Re-created on install so an install
// is synchronous; a later scheme change re-runs it with the flush.
let stopSync: (() => void) | null = null;
function syncDocument(): void {
  stopSync?.();
  stopSync = effect(() => {
    const s = axes.value.scheme;
    const on = installed.value !== null;
    if (typeof document === 'undefined') return;
    const root = document.documentElement.style;
    if (on) root.setProperty('color-scheme', s); else root.removeProperty('color-scheme');
  });
}

/** Install a skin (or `null` for bare) and, optionally, the axes preferences. Blocks re-style live. */
export function useSkin(skin: Skin | null, options: SkinOptions = {}): void {
  if (options.scheme !== undefined) setScheme(options.scheme);
  if (options.density !== undefined) setDensity(options.density);
  if (options.input !== undefined) setInput(options.input);
  installed.value = skin;
  syncDocument();
}

/** The style a skin gives a part; empty when no skin, or the skin says nothing. */
export function look(...names: Part[]): StyleRecord {
  const p = parts.value;
  return Object.assign({}, ...names.map((n) => p[n] ?? {}));
}
