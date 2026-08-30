/**
 * The default skin: one competent, plain look, in a light and a dark scheme.
 * Entirely optional — the engine lays out identically without it. Replace it
 * with your own `Skin`; a complete skin defines every `Part`.
 *
 * Contrast is held by construction: `skin.test.ts` measures every (ink, ground)
 * pair the blocks render (`skin/contrast.ts` PAIRS) in both schemes. The
 * values below were tuned against that proof on 2026-08-30; the light palette
 * is the accepted look and moved only where it failed. Before → after, WCAG 2.x:
 *
 *   light textFaint   #8a8a8a → #707070   on raised 3.45 → 4.95, on sunken 3.20 → 4.59 (12px, needs 4.5)
 *   light warning     #b7791f → #9a6410   tone.warning on raised 3.64 → 4.99, on sunken 3.37 → 4.62 (12px)
 *                                         notice.warning ink #ffffff: 3.64 → 4.99
 *   light hover       #f2f2f2 → #f5f5f5   a hovered table row is a text ground: tone.positive 4.49 → 4.61,
 *                                         tone.warning 4.46 → 4.58, text.faint 4.42 → 4.54 (12px/toned cells, need 4.5);
 *                                         hover vs raised 1.12 → 1.09, still a visible row tint
 *   light inputBorder (new) #8c8c8c       input edge vs raised: border #d9d9d9 1.41 → 3.36 (non-text, needs 3)
 *                                         `border`/`borderFaint` are unchanged: dividers and card edges keep the look
 *   dark  textFaint   #7c7f88 → #8f929b   on raised 3.87 → 4.99, on surface 4.25 → 5.47
 *   dark  notice inks #ffffff → #0b1020   on positive #4cc38a 2.22 → 8.55; negative #ff6b6b 2.78 → 6.82; warning #e3b341 1.95 → 9.73
 *   dark  inputBorder (new) #6f727c       input edge vs raised: border #2e3036 1.18 → 3.23
 *
 * Tinted notices take a per-tone ink (`positiveText`, `negativeText`,
 * `warningText`) instead of a hard-coded white: light tones are deep enough
 * for white ink (5.02 / 5.44 / 4.99), dark tones are pastel and take dark ink.
 */
import type { Part, Skin, SkinParts } from '../skin.js';
import type { StyleRecord } from '../style.js';

interface Palette {
  text: string; textMuted: string; textFaint: string;
  /** The page ground, the plane content sits on, and the plane that floats above it. */
  sunken: string; surface: string; raised: string;
  border: string; borderFaint: string;
  /** The edge of a text control: must read as an edge (3:1) against the plane it sits in. */
  inputBorder: string;
  accent: string; accentText: string; accentSoft: string;
  hover: string;
  positive: string; negative: string; warning: string;
  /** Ink on a tone used as a ground (tinted notices). */
  positiveText: string; negativeText: string; warningText: string;
  overlay: string; skeleton: string;
  /** Feedback notices: ground and ink. */
  noticeBg: string; noticeText: string;
  shadow: string; shadowLarge: string;
}

export const lightPalette: Palette = {
  text: '#1a1a1a', textMuted: '#5c5c5c', textFaint: '#707070',
  sunken: '#f6f6f7', surface: '#ffffff', raised: '#ffffff',
  border: '#d9d9d9', borderFaint: '#ececec', inputBorder: '#8c8c8c',
  accent: '#2f5fd8', accentText: '#ffffff', accentSoft: '#e8eefc',
  hover: '#f5f5f5',
  positive: '#1a7f4b', negative: '#c0392b', warning: '#9a6410',
  positiveText: '#ffffff', negativeText: '#ffffff', warningText: '#ffffff',
  overlay: 'rgba(0,0,0,0.4)', skeleton: '#ececec',
  noticeBg: '#1a1a1a', noticeText: '#ffffff',
  shadow: '0 4px 16px rgba(0,0,0,0.12)', shadowLarge: '0 16px 48px rgba(0,0,0,0.2)',
};

export const darkPalette: Palette = {
  text: '#ececec', textMuted: '#a9abb3', textFaint: '#8f929b',
  sunken: '#121316', surface: '#1b1c20', raised: '#232428',
  border: '#2e3036', borderFaint: '#26282d', inputBorder: '#6f727c',
  accent: '#6b93ff', accentText: '#0b1020', accentSoft: '#1c2745',
  hover: '#24262b',
  positive: '#4cc38a', negative: '#ff6b6b', warning: '#e3b341',
  positiveText: '#0b1020', negativeText: '#0b1020', warningText: '#0b1020',
  overlay: 'rgba(0,0,0,0.6)', skeleton: '#2a2c31',
  noticeBg: '#232428', noticeText: '#ececec',
  shadow: '0 4px 16px rgba(0,0,0,0.5)', shadowLarge: '0 16px 48px rgba(0,0,0,0.6)',
};

const family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const radius = 6;

/** Every part, dressed from one palette. */
export function partsOf(c: Palette): Record<Part, StyleRecord> {
  const control: StyleRecord = { borderRadius: radius, fontWeight: 500, fontSize: 14 };
  return {
    // Surface
    surface: { background: c.surface, color: c.text, fontFamily: family, fontSize: 14, lineHeight: 1.4 },
    'surface.sunken': { background: c.sunken },
    'surface.raised': { background: c.raised },
    card: { background: c.raised, border: `1px solid ${c.borderFaint}`, borderRadius: 10 },
    'card.nested': { background: 'transparent', border: 'none', borderRadius: 0 },
    divider: { borderBottom: `1px solid ${c.border}` },
    overlay: { background: c.overlay },
    dialog: { background: c.raised, borderRadius: 10, boxShadow: c.shadowLarge },
    skeleton: { background: c.skeleton, borderRadius: 4 },

    // Text
    text: { color: c.text },
    'text.muted': { color: c.textMuted, fontSize: 12 },
    'text.faint': { color: c.textFaint, fontSize: 12 },
    'text.code': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    'text.heading': { fontSize: 20, fontWeight: 600 },
    'text.title': { fontSize: 16, fontWeight: 600 },
    'text.display': { fontSize: 28, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
    'text.label': { color: c.textMuted, fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
    'tone.positive': { color: c.positive },
    'tone.negative': { color: c.negative },
    'tone.warning': { color: c.warning },
    'tone.neutral': { color: c.textMuted },
    brand: { fontSize: 16, fontWeight: 600 },
    link: { color: c.accent, textDecoration: 'none', fontWeight: 500 },

    // Control
    button: { ...control },
    'button.primary': { background: c.accent, color: c.accentText, border: `1px solid ${c.accent}` },
    'button.plain': { background: c.raised, color: c.text, border: `1px solid ${c.border}` },
    'button.quiet': { background: 'transparent', color: c.text, border: '1px solid transparent' },
    'button.danger': { background: c.raised, color: c.negative, border: `1px solid ${c.negative}` },
    'button.busy': { opacity: 0.6, cursor: 'progress' },
    input: { border: `1px solid ${c.inputBorder}`, borderRadius: radius, background: c.raised, color: c.text, outline: 'none', fontSize: 14 },
    'input.invalid': { borderColor: c.negative },
    'input.readonly': { background: c.sunken, color: c.textMuted },

    // Navigation
    'nav.link': { fontWeight: 500, color: c.text, borderRadius: radius, textDecoration: 'none' },
    'nav.link.active': { fontWeight: 600, color: c.accent, background: c.accentSoft },
    'nav.side': { borderBottom: 'none', borderRight: `1px solid ${c.border}` },
    bar: { background: c.surface, borderBottom: `1px solid ${c.border}` },
    menu: { background: c.raised, border: `1px solid ${c.border}`, borderRadius: radius, boxShadow: c.shadow },
    'menu.item': { borderRadius: radius, color: c.text },
    'menu.item.danger': { color: c.negative },

    // Data
    'table.header': { color: c.textMuted, fontSize: 12, fontWeight: 500, borderBottom: `1px solid ${c.borderFaint}` },
    'table.cell': { borderBottom: `1px solid ${c.borderFaint}` },
    'table.row.hover': { background: c.hover },
    'meter.track': { background: c.sunken, borderRadius: 4 },
    'meter.fill': { background: c.accent, borderRadius: 4 },
    'meter.fill.warning': { background: c.warning },
    'meter.fill.negative': { background: c.negative },
    'chart.axis': { color: c.textFaint, fontSize: 12 },
    'chart.bar': { background: c.accent, borderRadius: 2 },
    'chart.bar.positive': { background: c.positive },
    'chart.bar.negative': { background: c.negative },
    'chart.bar.warning': { background: c.warning },

    // Feedback
    notice: { background: c.noticeBg, color: c.noticeText, border: `1px solid ${c.border}`, borderRadius: radius, boxShadow: c.shadowLarge, fontFamily: family, fontSize: 14, lineHeight: 1.4 },
    'notice.positive': { background: c.positive, color: c.positiveText, borderColor: c.positive },
    'notice.negative': { background: c.negative, color: c.negativeText, borderColor: c.negative },
    'notice.warning': { background: c.warning, color: c.warningText, borderColor: c.warning },
  } satisfies Record<Part, StyleRecord>;
}

export const lightParts: SkinParts = partsOf(lightPalette);
export const darkParts: SkinParts = partsOf(darkPalette);

export const defaultSkin: Skin = ({ scheme }) => (scheme === 'dark' ? darkParts : lightParts);
