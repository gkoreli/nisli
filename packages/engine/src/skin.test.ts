/**
 * The split that keeps the engine honest: with no skin installed, no block
 * emits a visual property. Layout, yes; colour, font, border, radius, shadow —
 * never. If this fails, a visual leaked into the scaffolding.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { flushEffects, html, signal } from '@nisli/core';
import { useSkin } from './skin.js';
import { defaultSkin } from './skin/default.js';
import { setMeasurer } from './engine/measure.js';
import './index.js';

const VISUAL = /(^|;)\s*(color|background[a-z-]*|border(?!-collapse|-spacing)[a-z-]*|border-radius|box-shadow|font-family|font-size|font-weight|text-decoration|letter-spacing|text-transform|outline)\s*:/;
// A reset carries no visual: a control must un-button itself to be laid out at all.
const RESET = /^[a-z-]+:(none|inherit|transparent|0)$/;
const normalise = (d: string) => d.replace(/\s+/g, '').replace(/(none)(none)+/g, 'none');

const everyStyle = (root: HTMLElement) =>
  [root, ...root.querySelectorAll<HTMLElement>('*')]
    .flatMap((e) => (e.getAttribute('style') ?? '').split(';').map((d) => d.trim()).filter(Boolean));

const mountAll = () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const props: Record<string, Record<string, unknown>> = {
    'nisli-app': { brand: 'B', nav: [{ label: 'A', href: '/a' }], location: '/a', content: html`<i></i>` },
    'nisli-page': { title: 'T', actions: [{ id: 'x', label: 'X', priority: 'primary' }, { id: 'y', label: 'Y', destructive: true }], children: html`<i></i>` },
    'nisli-section': { title: 'S', children: html`<i></i>` },
    'nisli-section-pending': { title: 'S', children: html`<i></i>`, status: { loading: signal(true), error: signal(null) } },
    'nisli-grid': { children: [html`<i></i>`, html`<i></i>`] },
    'nisli-stat': { label: 'L', value: 'V', delta: { text: 'd', tone: 'negative' }, hint: 'h' },
    'nisli-table': { columns: [{ id: 'a', header: 'A', cell: () => 'a', kind: 'money' }], rows: [{ id: 1 }], key: (r: { id: number }) => String(r.id), onSelect: () => {} },
    'nisli-form': { fields: [{ key: 'a', label: 'A', kind: 'text', required: true, hint: 'h' }, { key: 's', label: 'S', kind: 'select', options: [] }, { key: 'n', label: 'N', kind: 'textarea' }], value: {}, onChange: () => {}, onSubmit: () => {}, onCancel: () => {}, destructive: { id: 'd', label: 'D' } },
    'nisli-dialog': { title: 'D', open: true, onClose: () => {}, children: html`<i></i>` },
    'nisli-meter': { label: 'M', value: 120, max: 100, detail: 'x' },
    'nisli-bars': { items: [{ label: 'a', value: 1, text: '1' }] },
    'nisli-empty': { title: 'E', hint: 'h', action: { id: 'a', label: 'A' } },
    'nisli-text': { text: 't', role: 'code', tone: 'warning' },
    'nisli-link': { href: '/', label: 'l' },
  };
  for (const [tag, p] of Object.entries(props)) {
    const e = document.createElement(tag.replace('-pending', ''));
    for (const [k, v] of Object.entries(p)) (e as any)._setProp(k, v);
    host.appendChild(e);
  }
  flushEffects();
  return host;
};

beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; setMeasurer(() => 800); });

describe('the engine is visual-less', () => {
  it('bare: no block emits a visual property', () => {
    useSkin(null);
    const leaks = everyStyle(mountAll()).map(normalise).filter((d) => VISUAL.test(d) && !RESET.test(d));
    expect(leaks).toEqual([]);
  });
  it('skinned: the same blocks pick up the skin, live', () => {
    useSkin(null);
    const host = mountAll();
    expect(everyStyle(host).some((d) => d.startsWith('background:#'))).toBe(false);
    useSkin(defaultSkin);
    flushEffects();
    expect(everyStyle(host).some((d) => d.startsWith('background:#'))).toBe(true);
    useSkin(null);
  });
});

// ── Completeness: the default skin defines every declared part ──────────
// Which parts a block may ask for is enforced by the types: `ctx.part()` and
// `look()` take `Part`, and a skin is `Record<Part, …>`; the seam holds in
// both directions without a scanner.
import { PARTS, scheme, setScheme, type SkinParts } from './skin.js';

describe('the default skin is complete', () => {
  const light = (defaultSkin as (a: { scheme: 'light' | 'dark' }) => Record<string, unknown>)({ scheme: 'light' });
  const dark = (defaultSkin as (a: { scheme: 'light' | 'dark' }) => Record<string, unknown>)({ scheme: 'dark' });
  it('defines every declared part and nothing else', () => {
    expect(Object.keys(light).sort()).toEqual([...PARTS].sort());
    expect(Object.keys(dark).sort()).toEqual([...PARTS].sort());
  });
  it('never contains layout', () => {
    const LAYOUT = /^(display|width|height|min-width|max-width|gap|grid.*|flex.*|position|top|left|right|bottom|margin.*|padding.*)$/;
    const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    const offenders = [light, dark].flatMap((p) => Object.entries(p).flatMap(([part, rec]) => Object.keys(rec as object).filter((k) => LAYOUT.test(kebab(k))).map((k) => `${part}.${k}`)));
    expect(offenders).toEqual([]);
  });
});

// ── Contrast: every pair the blocks render reads, in both schemes ────────
// The pairs are read off the blocks' `ctx.part()` calls (`skin/contrast.ts`);
// the requirement is WCAG 2.x: 4.5 for body and 12px text, 3 for large text
// (text.heading 20px/600, text.display 28px) and non-text edges and fills.
import { measure, PAIRS, parseColor } from './skin/contrast.js';

describe('the default skin holds contrast', () => {
  it('names every pair the blocks render', () => { expect(PAIRS.length).toBeGreaterThan(100); });
  it('parseColor reads percentage alpha and refuses what it cannot read', () => {
    expect(parseColor('rgba(0,0,0,50%)')?.a).toBeCloseTo(0.5);
    expect(parseColor('rgba(0,0,0,0.5)')?.a).toBeCloseTo(0.5);
    expect(parseColor('rgba(0,0,0,50)')).toBeNull();
    expect(parseColor('rgb(0 0 0 / .5)')).toBeNull();
  });
  it.each(['light', 'dark'] as const)('every rendered pair meets its contrast requirement in %s', (s) => {
    const parts = (defaultSkin as (a: { scheme: 'light' | 'dark' }) => SkinParts)({ scheme: s });
    const failing = measure(parts).filter((m) => !m.ok)
      .map((m) => `${s}: ${m.where} — ${m.ink_} on ${m.ground_} is ${m.ratio.toFixed(2)}:1, needs ${m.requirement}:1`);
    expect(failing).toEqual([]);
  });
});

describe('the engine owns the scheme', () => {
  it('dresses for dark, flips live on setScheme, and clears color-scheme on uninstall', () => {
    useSkin(defaultSkin, { scheme: 'dark' });
    expect(scheme.value).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('dark');
    const host = document.createElement('div'); document.body.appendChild(host);
    const section = document.createElement('nisli-section');
    (section as any)._setProp('title', 'S'); (section as any)._setProp('children', html`<i></i>`);
    host.appendChild(section); flushEffects();
    const bg = () => section.style.background || section.style.backgroundColor;
    expect(bg()).toContain('#232428');
    setScheme('light'); flushEffects();
    expect(scheme.value).toBe('light');
    expect(bg()).toContain('#ffffff');
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('light');
    useSkin(null);
    expect(document.documentElement.style.getPropertyValue('color-scheme')).toBe('');
    setScheme('system');
  });
});
