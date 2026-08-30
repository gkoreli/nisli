/**
 * Contrast — the one thing a skin can lie about that a person cannot read past.
 *
 * Pure: relative luminance and the WCAG 2.x contrast ratio from the colour
 * strings a skin writes (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`), plus PAIRS —
 * every (ink, ground) combination the blocks actually render, read off their
 * `ctx.part()` calls. `skin.test.ts` proves the default skin meets each
 * pair's requirement in both schemes; a third-party skin can run the same
 * proof. No new part is named here: a pair is a list of existing parts for
 * the ink and a list for the ground, layered exactly as the block layers them.
 */
import type { Part, SkinParts } from '../skin.js';

export interface RGBA { readonly r: number; readonly g: number; readonly b: number; readonly a: number }

/**
 * Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb(r,g,b)`, `rgba(r,g,b,a)` with a numeric
 * alpha (0..1) or a percentage (`50%`); `transparent`; else null. The modern forms —
 * `rgb(0 0 0 / .5)`, `hsl()`, `oklch()`, named colours — are not parsed: a pair whose ink or
 * ground is written that way measures as `none` and fails loudly, which is the point: a skin
 * author sees exactly which value the proof could not read, rather than a silently passed pair.
 */
export function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1]!;
    const n = h.length === 3 || h.length === 4 ? h.split('').map((c) => c + c).join('') : h;
    if (n.length !== 6 && n.length !== 8) return null;
    const v = (i: number) => parseInt(n.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: n.length === 8 ? v(6) / 255 : 1 };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)(%?)\s*)?\)$/.exec(s);
  if (fn) {
    const a = fn[4] === undefined ? 1 : fn[5] === '%' ? +fn[4] / 100 : +fn[4];
    if (a < 0 || a > 1) return null;
    return { r: +fn[1]!, g: +fn[2]!, b: +fn[3]!, a };
  }
  return null;
}

/** Source-over: `top` (with alpha) composited onto an opaque `under`. */
export function composite(top: RGBA, under: RGBA): RGBA {
  const a = top.a + under.a * (1 - top.a);
  const ch = (t: number, u: number) => (a === 0 ? 0 : (t * top.a + u * under.a * (1 - top.a)) / a);
  return { r: ch(top.r, under.r), g: ch(top.g, under.g), b: ch(top.b, under.b), a };
}

/** WCAG 2.x relative luminance of an opaque colour. */
export function luminance(c: RGBA): number {
  const lin = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG 2.x contrast ratio, 1..21. `ink` may carry alpha; it is composited over `ground`. */
export function contrastRatio(ink: RGBA, ground: RGBA): number {
  const fg = composite(ink, ground);
  const l1 = luminance(fg), l2 = luminance(ground);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ── The pairs the engine renders ────────────────────────────────────────

/**
 * What the ink is: 4.5 for text below 18.67px bold / 24px regular (WCAG "large text" starts there),
 * 3 for large text and for a non-text edge or fill. In the default skin `text.heading` (20px/600)
 * and `text.display` (28px) are large; everything else is body or 12px.
 */
export type Requirement = 4.5 | 3;

export interface Pair {
  /** Parts layered for the ink, in the block's order; the last `color` (or `borderColor`/`background` for non-text) wins. */
  readonly ink: readonly Part[];
  /** Parts layered for the ground, outermost first; the innermost non-transparent `background` wins. */
  readonly ground: readonly Part[];
  readonly requirement: Requirement;
  /** Which property of the ink to read: text `color` (default), a `border`, or a `background` fill. */
  readonly reads?: 'color' | 'border' | 'background';
  /** Where the block puts it — the file:part call it was read from. */
  readonly where: string;
}

const TEXT: readonly Part[] = ['text', 'text.muted', 'text.faint', 'text.title', 'text.label'];
/** Large text (WCAG ≥18.67px bold / ≥24px): `text.heading` is 20px/600, `text.display` 28px/600. */
const LARGE: readonly Part[] = ['text.heading', 'text.display'];
const GROUNDS: readonly (readonly Part[])[] = [
  ['surface'], ['surface', 'surface.raised'], ['surface', 'surface.sunken'],
  ['surface', 'card'], ['surface', 'card', 'card.nested'], ['surface', 'dialog'],
  ['surface', 'surface.raised', 'menu'], ['surface', 'bar'],
];
/** A hovered/focused table row: on a card (table.ts:152 inside section.ts) or straight on the page (App host is sunken, app.ts:44). */
const HOVER_GROUNDS: readonly (readonly Part[])[] = [
  ['surface', 'card', 'table.row.hover'], ['surface', 'surface.sunken', 'table.row.hover'],
];
/** Where a data block (Table, Columns) may sit: a card, a nested card, or the page itself. */
const DATA_GROUNDS: readonly (readonly Part[])[] = [
  ['surface', 'card'], ['surface', 'card', 'card.nested'], ['surface', 'surface.sunken'],
];
const TONES: readonly Part[] = ['tone.positive', 'tone.negative', 'tone.warning', 'tone.neutral'];

const pairs: Pair[] = [];
const add = (ink: readonly Part[], ground: readonly Part[], requirement: Requirement, where: string, reads?: Pair['reads']) =>
  pairs.push({ ink, ground, requirement, where, ...(reads ? { reads } : {}) });

// Text roles on every plane (text.ts, section.ts, stat.ts, dialog.ts, empty.ts, table.ts, form.ts, toolbar.ts).
for (const g of GROUNDS) {
  for (const t of TEXT) add([t], g, 4.5, `${t} on ${g.join('>')}`);
  for (const t of LARGE) add([t], g, 3, `${t} on ${g.join('>')}`);
}
// A hovered row: every cell's text, the fold line (text.muted, table.ts:178), and a toned cell (Text({ tone }), e.g. an amount).
for (const g of HOVER_GROUNDS) {
  for (const t of ['text', 'text.muted', 'text.faint'] as const) add([t], g, 4.5, `${t} on ${g.join('>')}`);
  for (const tone of TONES) add(['text', tone], g, 4.5, `${tone} on ${g.join('>')}`);
}
// Navigation links: on the bar, and the active link on its own tint (app.ts:108).
add(['nav.link'], ['surface', 'bar'], 4.5, 'nav.link on bar');
add(['nav.link', 'nav.link.active'], ['surface', 'bar', 'nav.link', 'nav.link.active'], 4.5, 'nav.link.active on its tint');
// Tones: Stat delta (12px muted+tone on card), Meter value, form errors, kernel error (stat.ts:26, meter.ts:25, form.ts:320,342, kernel.ts:226).
for (const tone of TONES) {
  add(['text.muted', tone], ['surface', 'surface.raised'], 4.5, `${tone} on raised (stat delta)`);
  add(['text.muted', tone], ['surface', 'surface.sunken'], 4.5, `${tone} on sunken`);
  add(['text', tone], ['surface', 'card'], 4.5, `${tone} on card`);
  add(['text', tone], ['surface', 'surface.sunken'], 4.5, `${tone} on sunken (Text tone on the page)`);
}
// Buttons: text on their own ground (toolbar.ts:127, confirm.ts:29, dialog.ts:72, empty.ts:24).
for (const b of ['button.primary', 'button.plain', 'button.quiet', 'button.danger'] as const) {
  add(['button', b], ['surface', 'surface.raised', 'button', b], 4.5, `${b} text on ${b}`);
}
// Notices: ink on their tinted ground; mounted outside the App on the overlay layer (notice.ts:104).
add(['notice'], ['notice'], 4.5, 'notice text on notice');
for (const n of ['notice.positive', 'notice.negative', 'notice.warning'] as const) add(['notice', n], ['notice', n], 4.5, `${n} text on ${n}`);
// Input: text on its ground; its edge against the card it sits in (form.ts:178).
add(['input'], ['surface', 'surface.raised', 'input'], 4.5, 'input text on input');
add(['input', 'input.readonly'], ['surface', 'surface.raised', 'input', 'input.readonly'], 4.5, 'input.readonly text on input.readonly');
// A read-only segmented option (form.ts:268): button.primary/plain with input.readonly layered last, on its own ground.
for (const b of ['button.primary', 'button.plain'] as const) add(['button', b, 'input.readonly'], ['surface', 'card', 'button', b, 'input.readonly'], 4.5, `${b} read-only segment text on its ground`);
add(['input'], ['surface', 'surface.raised'], 3, 'input border vs raised', 'border');
add(['input', 'input.invalid'], ['surface', 'surface.raised'], 3, 'input.invalid border vs raised', 'border');
// Meter and chart fills against the track / the card (meter.ts:37, bars.ts:32, columns.ts:62).
for (const f of ['meter.fill', 'meter.fill.warning', 'meter.fill.negative'] as const) add(['meter.fill', f], ['surface', 'surface.raised', 'meter.track'], 3, `${f} vs meter.track`, 'background');
for (const c of ['chart.bar', 'chart.bar.positive', 'chart.bar.negative', 'chart.bar.warning'] as const) add(['chart.bar', c], ['surface', 'surface.raised'], 3, `${c} vs raised`, 'background');
// Link (text.ts:32): on the page, in a Section, in a nested card.
for (const g of [['surface'], ['surface', 'surface.sunken'], ['surface', 'card'], ['surface', 'card', 'card.nested']] as const) add(['link'], g, 4.5, `link on ${g.join('>')}`);
// Table header (table.ts:117) and chart axis (columns.ts) wherever a data block sits.
for (const g of DATA_GROUNDS) {
  add(['table.header'], g, 4.5, `table.header on ${g.join('>')}`);
  add(['chart.axis'], g, 4.5, `chart.axis on ${g.join('>')}`);
}
// Menu items on the menu (toolbar.ts:170).
add(['menu.item'], ['surface', 'surface.raised', 'menu'], 4.5, 'menu.item on menu');
add(['menu.item', 'menu.item.danger'], ['surface', 'surface.raised', 'menu'], 4.5, 'menu.item.danger on menu');

/** Every (ink, ground) pair the blocks render. */
export const PAIRS: readonly Pair[] = pairs;

// ── Measuring a skin ────────────────────────────────────────────────────

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const colorIn = (v: string | undefined): RGBA | null => {
  if (!v) return null;
  // `1px solid #d9d9d9` → the colour token; a bare colour parses as-is.
  const tok = v.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\btransparent\b/i);
  return tok ? parseColor(tok[0]) : null;
};

/** The ground a list of parts lays down: innermost opaque background, alpha layers composited outward. */
export function groundOf(parts: SkinParts, layers: readonly Part[]): RGBA | null {
  let ground: RGBA | null = null;
  for (const p of layers) {
    const c = colorIn(str(parts[p]?.background) ?? str(parts[p]?.backgroundColor));
    if (!c || c.a === 0) continue;
    ground = ground && c.a < 1 ? composite(c, ground) : c.a < 1 ? null : c;
  }
  return ground;
}

/** The ink a list of parts lays down for `reads`: the last part that says so wins. */
export function inkOf(parts: SkinParts, layers: readonly Part[], reads: Pair['reads'] = 'color'): RGBA | null {
  let ink: RGBA | null = null;
  for (const p of layers) {
    const rec = parts[p] ?? {};
    const v = reads === 'color' ? str(rec.color)
      : reads === 'border' ? (str(rec.borderColor) ?? str(rec.border))
      : (str(rec.background) ?? str(rec.backgroundColor));
    const c = colorIn(v);
    if (c) ink = c;
  }
  return ink;
}

export interface Measurement extends Pair { readonly ratio: number; readonly ok: boolean; readonly ink_: string; readonly ground_: string }

const hex = (c: RGBA) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Measure every pair against a resolved skin. Text pairs inherit `surface`'s colour when no ink part sets one. */
export function measure(parts: SkinParts, table: readonly Pair[] = PAIRS): Measurement[] {
  return table.map((pair) => {
    const ground = groundOf(parts, pair.ground);
    const ink = inkOf(parts, pair.ink, pair.reads) ?? (pair.reads === 'color' || !pair.reads ? inkOf(parts, ['surface']) : null);
    if (!ground || !ink) return { ...pair, ratio: 0, ok: false, ink_: ink ? hex(ink) : 'none', ground_: ground ? hex(ground) : 'none' };
    const ratio = contrastRatio(ink, ground);
    return { ...pair, ratio, ok: ratio >= pair.requirement, ink_: hex(composite(ink, ground)), ground_: hex(ground) };
  });
}
