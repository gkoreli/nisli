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

// ── Completeness: every part a block asks for, both schemes define ──────
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARTS, scheme, setScheme, type Part } from './skin.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Template-literal families a block builds at runtime, with every variant it can produce. */
const FAMILIES: Record<string, string[]> = {
  'tone.': ['positive', 'negative', 'warning', 'neutral'],
  'chart.bar.': ['positive', 'negative', 'warning'],
  'meter.fill.': ['warning', 'negative'],
  'notice.': ['positive', 'negative', 'warning'],
  'menu.item.': ['danger'],
  'button.': ['primary', 'plain', 'quiet', 'danger', 'busy'],
};

function partsAskedFor(): Set<string> {
  const files = [
    ...readdirSync(join(here, 'blocks')).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => join(here, 'blocks', f)),
    join(here, 'style.ts'),
  ];
  const asked = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const call of src.matchAll(/look\(([\s\S]*?)\)/g)) {
      const args = call[1]!;
      // A bare word inside look(...) may be a key into a role map ('body'); only part-shaped literals count.
      for (const lit of args.matchAll(/'([a-z][a-z.]*)'/g)) {
        const name = lit[1]!;
        if (name.includes('.') || PARTS.includes(name as Part)) asked.add(name);
      }
      for (const tpl of args.matchAll(/`([a-z][a-z.]*\.)\$\{/g)) {
        const family = tpl[1]!;
        for (const v of FAMILIES[family] ?? []) asked.add(family + v);
        if (!FAMILIES[family]) throw new Error(`unknown template family ${family} in ${file}`);
      }
    }
  }
  return asked;
}

describe('the default skin is complete', () => {
  const light = (defaultSkin as (a: { scheme: 'light' | 'dark' }) => Record<string, unknown>)({ scheme: 'light' });
  const dark = (defaultSkin as (a: { scheme: 'light' | 'dark' }) => Record<string, unknown>)({ scheme: 'dark' });
  it('defines every part a block can ask for, in both schemes', () => {
    const asked = [...partsAskedFor()].sort();
    expect(asked.length).toBeGreaterThan(30);
    expect(asked.filter((p) => !(p in light))).toEqual([]);
    expect(asked.filter((p) => !(p in dark))).toEqual([]);
    expect(asked.filter((p) => !PARTS.includes(p as Part))).toEqual([]);
  });
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
