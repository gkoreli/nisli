/**
 * The default skin: one competent, plain look, in a light and a dark scheme.
 * Entirely optional — the engine lays out identically without it. Replace it
 * with your own `Skin`; a complete skin defines every `Part`.
 */
import type { Part, Skin, SkinParts } from '../skin.js';
import type { StyleRecord } from '../style.js';

interface Palette {
  text: string; textMuted: string; textFaint: string;
  /** The page ground, the plane content sits on, and the plane that floats above it. */
  sunken: string; surface: string; raised: string;
  border: string; borderFaint: string;
  accent: string; accentText: string; accentSoft: string;
  hover: string;
  positive: string; negative: string; warning: string;
  overlay: string; skeleton: string;
  /** Feedback notices: ground and ink. */
  noticeBg: string; noticeText: string;
  shadow: string; shadowLarge: string;
}

export const lightPalette: Palette = {
  text: '#1a1a1a', textMuted: '#5c5c5c', textFaint: '#8a8a8a',
  sunken: '#f6f6f7', surface: '#ffffff', raised: '#ffffff',
  border: '#d9d9d9', borderFaint: '#ececec',
  accent: '#2f5fd8', accentText: '#ffffff', accentSoft: '#e8eefc',
  hover: '#f2f2f2',
  positive: '#1a7f4b', negative: '#c0392b', warning: '#b7791f',
  overlay: 'rgba(0,0,0,0.4)', skeleton: '#ececec',
  noticeBg: '#1a1a1a', noticeText: '#ffffff',
  shadow: '0 4px 16px rgba(0,0,0,0.12)', shadowLarge: '0 16px 48px rgba(0,0,0,0.2)',
};

export const darkPalette: Palette = {
  text: '#ececec', textMuted: '#a9abb3', textFaint: '#7c7f88',
  sunken: '#121316', surface: '#1b1c20', raised: '#232428',
  border: '#2e3036', borderFaint: '#26282d',
  accent: '#6b93ff', accentText: '#0b1020', accentSoft: '#1c2745',
  hover: '#24262b',
  positive: '#4cc38a', negative: '#ff6b6b', warning: '#e3b341',
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
    input: { border: `1px solid ${c.border}`, borderRadius: radius, background: c.raised, color: c.text, outline: 'none', fontSize: 14 },
    'input.invalid': { borderColor: c.negative },
    'input.readonly': { background: c.sunken, color: c.textMuted },

    // Navigation
    'nav.link': { fontWeight: 500, color: c.text, borderRadius: radius, textDecoration: 'none' },
    'nav.link.active': { fontWeight: 600, color: c.accent, background: c.accentSoft },
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
    'notice.positive': { background: c.positive, color: '#ffffff', borderColor: c.positive },
    'notice.negative': { background: c.negative, color: '#ffffff', borderColor: c.negative },
    'notice.warning': { background: c.warning, color: '#ffffff', borderColor: c.warning },
  } satisfies Record<Part, StyleRecord>;
}

export const lightParts: SkinParts = partsOf(lightPalette);
export const darkParts: SkinParts = partsOf(darkPalette);

export const defaultSkin: Skin = ({ scheme }) => (scheme === 'dark' ? darkParts : lightParts);
