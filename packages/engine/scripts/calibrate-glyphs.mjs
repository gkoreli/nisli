/**
 * calibrate-glyphs.mjs — measure the default skin's font in real Chromium and
 * write the result to src/test/glyphs.ts, so the estimating measurer sums
 * real glyph advances instead of a flat characters × 7.2.
 *
 *   node packages/engine/scripts/calibrate-glyphs.mjs        # from anywhere
 *
 * Playwright is resolved from packages/www (where it is a devDependency); the
 * engine itself does not depend on it. Re-run when the default skin's font
 * stack or the metrics text sizes change; commit the generated file.
 *
 * What is measured, per text style the default skin uses:
 *   - the advance width of every ASCII printable glyph plus the currency,
 *     dash, quote, ellipsis and arrow glyphs the engine or a ledger writes
 *     (canvas measureText, the same shaping the DOM uses for one glyph);
 *   - the laid-out width of every string the engine's own tests measure
 *     (a real <span>'s bounding box), which the calibration test compares
 *     against the glyph-sum estimate.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'test', 'glyphs.ts');
const require = createRequire(join(HERE, '..', '..', 'www', 'package.json'));
const pw = await import(pathToFileURL(require.resolve('playwright')).href);
const chromium = (pw.chromium ?? pw.default?.chromium);

/** The default skin's font stack (skin/default.ts `family`). */
const FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The monospace stack `text.code` uses (skin/default.ts). */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** The text styles the default skin dresses parts with: key → [size px, weight, family]. */
const STYLES = {
  'body': [14, 400, FAMILY],      // surface, text, table.cell, input
  'control': [14, 500, FAMILY],   // button, nav.link
  'small': [12, 400, FAMILY],     // text.muted, text.faint, chart.axis
  'small.medium': [12, 500, FAMILY], // table.header, text.label
  'title': [16, 600, FAMILY],     // text.title, brand
  'heading': [20, 600, FAMILY],   // text.heading
  'display': [28, 600, FAMILY],   // text.display (a Stat's value)
  'code': [14, 400, MONO],        // text.code
};

const ascii = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));
const extra = [...' €£¥₾–—…‘’“”•·×÷↑↓⋯✕−'];
const GLYPHS = [...ascii, ...extra];

/** Strings the engine's own tests and blocks put on screen; the calibration test checks these. */
const STRINGS = [
  // toolbar.test.ts
  'Grandmother’s lasagne al forno', 'Share', 'Export', 'Edit', 'Save recipe', '⋯', 'T', 'Alpha', 'Bravo', 'Title', 'X',
  'A very long label indeed', 'Another long one', 'More actions',
  // table.test.ts
  'Date', 'Payee', 'Category', 'Account', 'Note', 'Amount', 'Aug 1', 'REI', 'Shopping', 'Card', 'REIShopping · Card',
  'Date ↑', 'Amount ↓',
  // engine chrome and ledger-shaped text
  'Show 60 more of 140', 'Updating…', 'Retry', 'Cancel', 'Confirm', 'Close', 'Menu', 'Loading', 'Nothing here yet.',
  'Transactions', 'Accounts', 'Budgets', 'Settings', '−$1,234.56', '$12,340.00', '2026-08-30', 'Whole Foods Market #10235',
];
/** Figures the engine sets in `font-variant-numeric: tabular-nums` (table numeric and date cells, Stat values, meters, bars). */
const TABULAR = ['0', '1', '7', '1111111111', '$1,234.56', '−$1,234.56', '$12,340.00', '$1,234,567,890.00', '2026-08-30', '11/12/2026', '48%', '1,000 of 1,111', '−12'];
/** Text the skin sets `uppercase` with `letter-spacing: 0.04em` (`text.label`). */
const LABELS = ['Spent', 'Income', 'Safe to spend', 'Net worth', 'This month', 'Grandmother’s lasagne al forno', 'Balance across 3 accounts'];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
const result = await page.evaluate(({ FAMILY, STYLES, GLYPHS, STRINGS, TABULAR, LABELS }) => {
  const canvas = document.createElement('canvas');
  const cx = canvas.getContext('2d');
  const span = document.createElement('span');
  span.style.cssText = `position:absolute;white-space:pre;font-family:${FAMILY};line-height:1.4`;
  document.body.appendChild(span);
  const out = {};
  const r3 = (n) => Math.round(n * 1000) / 1000;
  const laid = (list, css) => {
    span.style.cssText += css;
    const widths = {};
    for (const s of list) { span.textContent = s; widths[s] = r3(span.getBoundingClientRect().width); }
    return widths;
  };
  for (const [key, [size, weight, family]] of Object.entries(STYLES)) {
    cx.font = `${weight} ${size}px ${family}`;
    const glyphs = {};
    for (const g of GLYPHS) glyphs[g] = r3(cx.measureText(g).width);
    const base = `position:absolute;white-space:pre;line-height:1.4;font-family:${family};font-size:${size}px;font-weight:${weight};`;
    span.style.cssText = base;
    const strings = laid(STRINGS, '');
    span.style.cssText = base;
    const tabular = laid(TABULAR, 'font-variant-numeric:tabular-nums;');
    span.textContent = '0000000000';
    const tabularDigit = r3(span.getBoundingClientRect().width / 10);
    span.style.cssText = base;
    const labels = laid(LABELS, 'text-transform:uppercase;letter-spacing:0.04em;');
    out[key] = { size, weight, family, glyphs, strings, tabular, tabularDigit, labels };
  }
  span.style.cssText = `font-family:${FAMILY}`;
  return { out, family: getComputedStyle(span).fontFamily, ua: navigator.userAgent };
}, { FAMILY, STYLES, GLYPHS, STRINGS, TABULAR, LABELS });
const version = browser.version();
await browser.close();

const date = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push('/**');
lines.push(' * GENERATED by scripts/calibrate-glyphs.mjs — do not edit by hand.');
lines.push(` * Date: ${date} · Chromium ${version} · ${process.platform} ${process.arch}`);
lines.push(` * Font stack: ${FAMILY}`);
lines.push(' *');
lines.push(' * Per-glyph advance widths (CSS px) of the default skin\'s fonts at every text');
lines.push(' * style the skin uses, the tabular digit advance, and the laid-out widths of');
lines.push(' * the strings the engine\'s tests measure — plain, as tabular figures, and as');
lines.push(' * uppercase letter-spaced labels. The estimating measurer (test/estimate.ts)');
lines.push(' * sums the advances; glyphs.test.ts holds the sum to the browser\'s width.');
lines.push(' */');
lines.push('');
lines.push('export interface GlyphTable {');
lines.push('  readonly size: number;');
lines.push('  readonly weight: number;');
lines.push('  /** the font stack the style is measured in */');
lines.push('  readonly family: string;');
lines.push('  /** glyph → advance width, px */');
lines.push('  readonly glyphs: Readonly<Record<string, number>>;');
lines.push('  /** string → laid-out width in Chromium, px (a real span\'s bounding box) */');
lines.push('  readonly strings: Readonly<Record<string, number>>;');
lines.push('  /** string → laid-out width under `font-variant-numeric: tabular-nums` */');
lines.push('  readonly tabular: Readonly<Record<string, number>>;');
lines.push('  /** the advance every digit shares under tabular-nums, px */');
lines.push('  readonly tabularDigit: number;');
lines.push('  /** string → laid-out width under `text-transform: uppercase; letter-spacing: 0.04em` */');
lines.push('  readonly labels: Readonly<Record<string, number>>;');
lines.push('}');
lines.push('');
lines.push(`export const CHROMIUM = ${JSON.stringify(version)};`);
lines.push(`export const CALIBRATED = ${JSON.stringify(date)};`);
lines.push(`export const FAMILY = ${JSON.stringify(FAMILY)};`);
lines.push(`export const MONO = ${JSON.stringify(MONO)};`);
lines.push('');
lines.push('export const GLYPHS = {');
for (const [key, t] of Object.entries(result.out)) {
  lines.push(`  ${JSON.stringify(key)}: {`);
  lines.push(`    size: ${t.size}, weight: ${t.weight}, family: ${t.family === MONO ? 'MONO' : 'FAMILY'},`);
  lines.push(`    glyphs: ${JSON.stringify(t.glyphs)} as Readonly<Record<string, number>>,`);
  lines.push(`    strings: ${JSON.stringify(t.strings)} as Readonly<Record<string, number>>,`);
  lines.push(`    tabular: ${JSON.stringify(t.tabular)} as Readonly<Record<string, number>>,`);
  lines.push(`    tabularDigit: ${t.tabularDigit},`);
  lines.push(`    labels: ${JSON.stringify(t.labels)} as Readonly<Record<string, number>>,`);
  lines.push('  },');
}
lines.push('} satisfies Record<string, GlyphTable>;');
lines.push('');
lines.push('export type GlyphStyle = keyof typeof GLYPHS;');
lines.push('');
writeFileSync(OUT, lines.join('\n'));

const body = result.out.body;
const avg = Object.values(body.glyphs).reduce((a, b) => a + b, 0) / GLYPHS.length;
const lower = [...'abcdefghijklmnopqrstuvwxyz'].reduce((a, g) => a + body.glyphs[g], 0) / 26;
console.log(`Chromium ${version} · ${result.family}`);
console.log(`wrote ${OUT}`);
console.log(`styles: ${Object.keys(STYLES).join(', ')} · glyphs: ${GLYPHS.length} · strings: ${STRINGS.length} + ${TABULAR.length} tabular + ${LABELS.length} labels`);
console.log(`body 14px tabular digit ${body.tabularDigit}px vs proportional 1 ${body.glyphs['1']}px, 0 ${body.glyphs['0']}px`);
console.log(`body 14px: mean advance ${avg.toFixed(2)}px over the set, ${lower.toFixed(2)}px over a–z (metrics.charWidth is 7.2)`);
