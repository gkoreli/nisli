/**
 * Appearance — the skin layer.
 *
 * The contract, in four sentences:
 *   1. The engine places *parts*; a skin dresses them. A block never names a
 *      colour, font, border, radius or shadow — it asks `look('button.primary')`.
 *   2. A skin is a map from every part to a style record, or a function of the
 *      context axes (today: colour scheme) returning that map. A complete skin
 *      defines EVERY part; `skin.test.ts` enforces it for the default skin.
 *   3. A skin never contains layout. Widths, gaps, columns, what is shown or
 *      hidden belong to the engine and its metrics; a skin that sets `display`
 *      or `width` is lying about what it is.
 *   4. The engine owns the eyes-decision "is it dark?": with no preference set
 *      it follows the platform, reactively, and sets `color-scheme` on the
 *      document so native controls follow the skin.
 *
 * With no skin installed every `look()` is empty and blocks render bare —
 * correct, plain, fully laid out.
 */
import { signal, computed, type ReadonlySignal } from '@nisli/core';
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
  | 'input' | 'input.invalid';
/** Navigation — how a person moves between screens. */
export type NavigationPart =
  | 'nav.link' | 'nav.link.active' | 'bar'
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
  'button', 'button.primary', 'button.plain', 'button.quiet', 'button.danger', 'button.busy', 'input', 'input.invalid',
  // Navigation
  'nav.link', 'nav.link.active', 'bar', 'menu', 'menu.item', 'menu.item.danger',
  // Data
  'table.header', 'table.cell', 'table.row.hover', 'meter.track', 'meter.fill', 'meter.fill.warning', 'meter.fill.negative',
  'chart.axis', 'chart.bar', 'chart.bar.positive', 'chart.bar.negative', 'chart.bar.warning',
  // Feedback
  'notice', 'notice.positive', 'notice.negative', 'notice.warning',
];

// ── Context axes ───────────────────────────────────────────────────────

export type Scheme = 'light' | 'dark';

/** What a skin may vary on. More axes (density, contrast) join here. */
export interface SkinAxes {
  readonly scheme: Scheme;
}

export type SkinParts = Partial<Record<Part, StyleRecord>>;

/** A skin is either a fixed set of parts or a function of the context axes. */
export type Skin = SkinParts | ((axes: SkinAxes) => SkinParts);

export interface SkinOptions {
  /** `'system'` (default) follows the platform preference, live. */
  scheme?: Scheme | 'system';
}

// ── State ──────────────────────────────────────────────────────────────

const installed = signal<Skin | null>(null);
const preference = signal<Scheme | 'system'>('system');
const platform = signal<Scheme>('light');

let watching = false;
function watchPlatform(): void {
  if (watching || typeof matchMedia !== 'function') return;
  watching = true;
  const query = matchMedia('(prefers-color-scheme: dark)');
  platform.value = query.matches ? 'dark' : 'light';
  const onChange = (e: { matches: boolean }) => { platform.value = e.matches ? 'dark' : 'light'; syncDocument(); };
  if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
  else (query as { addListener?: (cb: (e: { matches: boolean }) => void) => void }).addListener?.(onChange);
}

/** The resolved colour scheme: the preference, or the platform's when `'system'`. */
export const scheme: ReadonlySignal<Scheme> = computed(() => (preference.value === 'system' ? platform.value : preference.value));

const parts = computed<SkinParts>(() => {
  const skin = installed.value;
  if (!skin) return {};
  return typeof skin === 'function' ? skin({ scheme: scheme.value }) : skin;
});

// Native controls, scrollbars and form widgets follow the skin's scheme.
function syncDocument(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (installed.value) root.setProperty('color-scheme', scheme.value); else root.removeProperty('color-scheme');
}

/** Install a skin (or `null` for bare). Blocks re-style live. */
export function useSkin(skin: Skin | null, options: SkinOptions = {}): void {
  if (options.scheme !== undefined) preference.value = options.scheme;
  installed.value = skin;
  if (skin) watchPlatform();
  syncDocument();
}

/** Change the scheme preference without reinstalling the skin. */
export function setScheme(s: Scheme | 'system'): void {
  preference.value = s;
  if (s === 'system') watchPlatform();
  syncDocument();
}

/** The style a skin gives a part; empty when no skin, or the skin says nothing. */
export function look(...names: Part[]): StyleRecord {
  const p = parts.value;
  return Object.assign({}, ...names.map((n) => p[n] ?? {}));
}
