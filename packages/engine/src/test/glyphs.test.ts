/**
 * Calibration: the estimating measurer's glyph sums against the widths real
 * Chromium laid the same strings out at — the strings toolbar.test.ts,
 * table.test.ts and the engine's own chrome put on screen, at every text
 * style the default skin uses. Regenerate glyphs.ts with
 * scripts/calibrate-glyphs.mjs when the font stack or sizes change.
 */
import { describe, it, expect } from 'vitest';
import { GLYPHS, CHROMIUM, MONO, type GlyphStyle } from './glyphs.js';
import { textWidth, tableFor, textStyleOf, columnWidth, estimator } from './estimate.js';
import { metrics } from '../metrics.js';

const TOLERANCE = 0.03;

describe(`glyph calibration (Chromium ${CHROMIUM})`, () => {
  const styles = Object.keys(GLYPHS) as GlyphStyle[];
  it('covers the sizes the skin uses: body 14, small 12, title 16', () => {
    expect(styles.map((k) => GLYPHS[k].size)).toEqual(expect.arrayContaining([14, 12, 16]));
    expect(Object.keys(GLYPHS.body.glyphs).length).toBeGreaterThanOrEqual(95);   // ASCII printable at least
  });

  for (const key of styles) {
    const t = GLYPHS[key];
    it(`${key} (${t.size}px/${t.weight}): every recorded string estimates within ${TOLERANCE * 100}% of the browser`, () => {
      const off: string[] = [];
      for (const [s, real] of Object.entries(t.strings)) {
        const est = textWidth(s, { size: t.size, weight: t.weight, mono: t.family === MONO });
        const diff = Math.abs(est - real) / real;
        if (diff > TOLERANCE) off.push(`${JSON.stringify(s)}: estimated ${est.toFixed(1)}, browser ${real} (${(diff * 100).toFixed(1)}%)`);
      }
      expect(off).toEqual([]);
      expect(Object.keys(t.strings).length).toBeGreaterThan(20);
    });

    it(`${key}: tabular figures and uppercase letter-spaced labels estimate within ${TOLERANCE * 100}% too`, () => {
      const off: string[] = [];
      const style = { size: t.size, weight: t.weight, mono: t.family === MONO };
      for (const [s, real] of Object.entries(t.tabular)) {
        const est = textWidth(s, { ...style, tabular: true });
        const diff = Math.abs(est - real) / real;
        if (diff > TOLERANCE) off.push(`tabular ${JSON.stringify(s)}: estimated ${est.toFixed(1)}, browser ${real} (${(diff * 100).toFixed(1)}%)`);
      }
      for (const [s, real] of Object.entries(t.labels)) {
        const est = textWidth(s, { ...style, uppercase: true, spacing: 0.04 });
        const diff = Math.abs(est - real) / real;
        if (diff > TOLERANCE) off.push(`label ${JSON.stringify(s)}: estimated ${est.toFixed(1)}, browser ${real} (${(diff * 100).toFixed(1)}%)`);
      }
      expect(off).toEqual([]);
      expect(Object.keys(t.tabular).length).toBeGreaterThan(10);
      expect(Object.keys(t.labels).length).toBeGreaterThan(5);
    });
  }

  it('the tabular digit is wider than the proportional 1 and the estimate knows it; uppercase and spacing widen a label', () => {
    expect(GLYPHS.body.tabularDigit).toBeGreaterThan(GLYPHS.body.glyphs['1']! + 1);
    expect(textWidth('1111', { tabular: true })).toBeGreaterThan(textWidth('1111'));
    expect(textWidth('Spent', { uppercase: true, spacing: 0.04 })).toBeGreaterThan(textWidth('Spent') * 1.1);
    expect(tableFor({ size: 14, mono: true })).toBe('code');
    expect(tableFor({ size: 28, weight: 600 })).toBe('display');
  });

  it('the flat charWidth the tests use (8) and the metric (7.2) bracket the real body average', () => {
    const lower = [...'abcdefghijklmnopqrstuvwxyz'].reduce((a, g) => a + GLYPHS.body.glyphs[g]!, 0) / 26;
    expect(lower).toBeGreaterThan(metrics.charWidth - 0.5);
    expect(lower).toBeLessThan(8.5);
  });

  it('tableFor picks the nearest size, then weight; textStyleOf reads the skin\'s inline font', () => {
    expect(tableFor({ size: 14, weight: 400 })).toBe('body');
    expect(tableFor({ size: 14, weight: 500 })).toBe('control');
    expect(tableFor({ size: 12, weight: 500 })).toBe('small.medium');
    expect(tableFor({ size: 16, weight: 600 })).toBe('title');
    expect(tableFor({ size: 15, weight: 600 })).toBe('title');
    const el = document.createElement('div');
    el.style.fontSize = '12px'; el.style.fontWeight = '500';
    const span = document.createElement('span');
    el.appendChild(span);
    expect(textStyleOf(span)).toEqual({ size: 12, weight: 500 });
    el.setAttribute('style', 'font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; font-variant-numeric: tabular-nums');
    span.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    expect(textStyleOf(span)).toEqual({ size: 12, weight: 500, mono: true, tabular: true, uppercase: true, spacing: 0.04 });
    expect(textWidth('Amount', { size: 12, weight: 500 })).toBeCloseTo(GLYPHS['small.medium'].strings['Amount']!, -1);
  });

  it('a header cell in a measuring (auto) table is as wide as its widest cell; pinned (fixed) it is its own text', () => {
    const root = document.createElement('div');
    root.innerHTML = '<table style="table-layout:auto"><thead><tr><th style="padding:0 12px">Date</th><th style="padding:0 12px">Payee</th></tr></thead><tbody><tr><td style="padding:0 12px;font-variant-numeric:tabular-nums">2026-08-30</td><td style="padding:0 12px">REI</td></tr></tbody></table>';
    document.body.appendChild(root);
    const [date, payee] = [...root.querySelectorAll<HTMLElement>('th')];
    expect(columnWidth(date!)).toBeCloseTo(textWidth('2026-08-30', { tabular: true }, 24), 3);
    expect(columnWidth(payee!)).toBeCloseTo(textWidth('Payee', {}, 24), 3);
    expect(estimator(800)(date!)).toBe(columnWidth(date!));
    root.querySelector('table')!.style.tableLayout = 'fixed';
    expect(columnWidth(date!)).toBeCloseTo(textWidth('Date', {}, 24), 3);
    root.remove();
  });

  it('an unknown glyph falls back to the metric, scaled to the size', () => {
    expect(textWidth('中', { size: 14 })).toBeCloseTo(metrics.charWidth, 5);
    expect(textWidth('中', { size: 28 })).toBeCloseTo(metrics.charWidth * 2, 5);
  });
});
