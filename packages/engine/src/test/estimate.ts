/**
 * An estimating measurer: widths from the tree and the text, no layout engine.
 * It reads the inline styles the engine itself wrote (widths, grids, padding,
 * the sidebar) and sizes text by character count. Deterministic, and honest
 * enough to find every plan the engine cannot satisfy.
 */
import { metrics } from '../metrics.js';
import { labelWidth } from '../engine/space.js';
import type { Measurer } from '../engine/measure.js';

const px = (v: string | undefined) => (v && v.endsWith('px') ? parseFloat(v) : undefined);

const horizontalPadding = (el: HTMLElement): number => {
  const l = px(el.style.paddingLeft), r = px(el.style.paddingRight);
  if (l !== undefined || r !== undefined) return (l ?? 0) + (r ?? 0);
  const parts = el.style.padding.split(/\s+/).map(px).filter((n): n is number => n !== undefined);
  if (parts.length === 0) return 0;
  return parts.length === 1 ? parts[0]! * 2 : parts.length === 2 ? parts[1]! * 2 : parts.length === 3 ? parts[1]! * 2 : parts[1]! + parts[3]!;
};

const TEXTUAL = new Set(['H1', 'H2', 'H3', 'TH', 'TD', 'BUTTON', 'SPAN', 'A', 'LABEL', 'OPTION']);

export function estimator(frame: number): Measurer {
  const boxWidth = (el: HTMLElement): number => {
    if (el === document.documentElement || el === document.body || !el.parentElement) return frame;
    const own = px(el.style.width) ?? px(el.style.maxWidth);
    const parent = el.parentElement;
    let base = boxWidth(parent) - horizontalPadding(parent);
    // A grid parent shares its width between its columns.
    const grid = /repeat\((\d+)/.exec(parent.style.gridTemplateColumns ?? '');
    if (grid) { const n = Number(grid[1]); const gap = px(parent.style.gap) ?? 0; base = (base - gap * (n - 1)) / n; }
    // A sidebar beside the content takes its width off the content.
    if (parent.tagName === 'NISLI-APP') {
      const nav = parent.querySelector<HTMLElement>(':scope > div > nav');
      if (nav && nav.style.display !== 'none') base -= px(nav.style.width) ?? metrics.layout.sidebarWidth;
    }
    if (el.style.display === 'contents') return base;
    return own !== undefined ? Math.min(own, base) : base;
  };

  return (el) => {
    if (TEXTUAL.has(el.tagName) && el.style.display !== 'block' && el.style.display !== 'flex') {
      const text = (el.textContent ?? '').trim();
      return labelWidth(text, horizontalPadding(el));
    }
    return boxWidth(el);
  };
}
