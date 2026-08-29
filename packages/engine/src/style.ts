/**
 * The engine's only way to touch appearance: a typed style record applied to
 * an element. Structural helpers here carry no visual value; visuals come
 * from `look()` (the installed skin) and are layered on top.
 */
import { metrics } from './metrics.js';
import { look } from './skin.js';

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

export type ButtonVariant = 'primary' | 'plain' | 'quiet' | 'danger';

/** A control's box: size and alignment from metrics; look from the skin. */
export function buttonStyle(variant: ButtonVariant): StyleRecord {
  return {
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
    ...look('button', `button.${variant}`),
  };
}

export const inputStyle = (invalid = false): StyleRecord => ({
  height: metrics.control.height,
  padding: `0 ${metrics.space[3]}px`,
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
  ...look('input'),
  ...(invalid ? look('input.invalid') : {}),
});

/** A surface. Nested inside another surface it stops being a card (engine rule). */
export const cardStyle = (nested: boolean): StyleRecord => ({
  padding: nested ? 0 : metrics.space[4],
  boxSizing: 'border-box',
  minWidth: 0,
  ...look(nested ? 'card.nested' : 'card'),
});
