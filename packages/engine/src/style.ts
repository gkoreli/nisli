/**
 * Style records and the structural boxes blocks share. Nothing here carries a
 * visual value: a box is size and alignment from `metrics`, and the kernel
 * layers the skin's look over it in `ctx.part()`. Boxes are read at call time
 * so an axis (density) can move them.
 */
import { metrics } from './metrics.js';

export type StyleRecord = Partial<Record<keyof CSSStyleDeclaration & string, string | number>>;

const UNITLESS = /^(opacity|flex|flexGrow|flexShrink|zIndex|lineHeight|fontWeight|order|gridColumn|gridRow)$/;
const px = (k: string, v: string | number) => (typeof v === 'number' && !UNITLESS.test(k) ? `${v}px` : String(v));

/** Serialise a record to a `style` attribute value (kebab-cased). */
export function css(record: StyleRecord): string {
  return Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${px(k, v!)}`)
    .join(';');
}

/** Apply a record directly to an element. */
export function apply(el: HTMLElement, record: StyleRecord): void {
  for (const [k, v] of Object.entries(record)) {
    (el.style as unknown as Record<string, string>)[k] = v == null || v === '' ? '' : px(k, v);
  }
}

// ── Structure (visual-less) ───────────────────────────────────────────

/** Text that must stay on one line and truncate with an ellipsis. */
export const truncate: StyleRecord = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

/** A control's box: size and alignment from metrics, un-buttoned; no look. */
export const buttonBox = (): StyleRecord => ({
  flex: 'none',
  height: metrics.control.height,
  padding: `0 ${metrics.control.padX}px`,
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: metrics.space[2],
  cursor: 'pointer',
  font: 'inherit',
  background: 'none',
  border: 'none',
  color: 'inherit',
});

/** A menu item's box: a left-aligned, un-buttoned row; no look. */
export const menuItemBox = (): StyleRecord => ({
  textAlign: 'left',
  padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
  border: 'none',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
});

/** A text control's box: control height, full width, un-styled; the look is `input` (+ `.invalid`, `.readonly`). */
export const inputBox = (): StyleRecord => ({
  height: metrics.control.height,
  padding: `0 ${metrics.space[3]}px`,
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
});

/** A surface's box. Nested inside another surface it stops being a card (engine rule); no look. */
export const cardBox = (nested: boolean): StyleRecord => ({
  padding: nested ? 0 : metrics.space[4],
  boxSizing: 'border-box',
  minWidth: 0,
});

/** The part a surface asks for at this nesting. */
export const cardPart = (nested: boolean): 'card' | 'card.nested' => (nested ? 'card.nested' : 'card');
