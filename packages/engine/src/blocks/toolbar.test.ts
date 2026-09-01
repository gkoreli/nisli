/**
 * Proves the Toolbar at five widths with no screenshot: the measurer is
 * replaced by a deterministic one, the engine decides, and the DOM is
 * asserted against the decision.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects } from '@nisli/core';
import { Toolbar, type Action } from './toolbar.js';
import { onReport, type LayoutReport } from '../engine/report.js';
import { setDevMode, devOverride } from '../engine/dev.js';
import { mount as mountBlock, textMeasurer, type Mounted } from '../test/mount.js';
import { setDensity, setInput } from '../engine/axes.js';

// Text is 8px a character; a button adds its padding, so the '⋯' trigger is 8 + 24 = 32.
const text = textMeasurer(8);
let mounted: Mounted | null = null;

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { mounted?.unmount(); mounted = null; });

const actions: Action[] = [
  { id: 'share', label: 'Share', priority: 'tertiary' },
  { id: 'export', label: 'Export', priority: 'tertiary' },
  { id: 'edit', label: 'Edit' },
  { id: 'save', label: 'Save recipe', priority: 'primary' },
];

function mount(width: number, props: { title: string; actions: Action[] } = { title: 'Grandmother’s lasagne al forno', actions }) {
  mounted = mountBlock('nisli-toolbar', props, { width, text });
  const { el } = mounted;
  const shown = [...el.querySelectorAll<HTMLElement>('[data-nisli-action]')]
    .filter((b) => b.style.display !== 'none')
    .map((b) => b.getAttribute('data-nisli-action'));
  const trigger = el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
  const menuItems = () => [...el.querySelectorAll('[role=menuitem]')].map((b) => b.textContent);
  const title = el.querySelector('h2')!;
  return { el, shown, trigger, menuItems, title };
}

// natural widths: title 31*8=248; Share 64, Export 72, Edit 56, Save recipe 112; gap 8; pad 16*2
describe('Toolbar at five widths', () => {
  it('1024: all four actions visible, no overflow trigger', () => {
    const t = mount(1024);
    expect(t.shown).toEqual(['share', 'export', 'edit', 'save']);
    expect(t.trigger.style.display).toBe('none');
    expect(t.title.style.width).toBe('auto');
  });

  it('768: still everything (needs 616)', () => {
    expect(mount(768).shown).toEqual(['share', 'export', 'edit', 'save']);
  });

  it('600: export (tertiary, last) goes to the menu first', () => {
    const t = mount(600);
    expect(t.shown).toEqual(['share', 'edit', 'save']);
    expect(t.menuItems()).toEqual(['Export']);
    expect(t.trigger.style.display).not.toBe('none');
  });

  it('480: both tertiaries gone, then the secondary; title still whole', () => {
    const t = mount(480);
    expect(t.shown).toEqual(['save']);
    expect(t.menuItems()).toEqual(['Share', 'Export', 'Edit']);
    expect(t.title.style.width).toBe('auto');
  });

  it('360: title truncates rather than losing the primary action', () => {
    const t = mount(360);
    expect(t.shown).toEqual(['save']);
    // available 328 = title + 8 + 112 + 8 + 32 → title 168
    expect(t.title.style.width).toBe('168px');
    expect(t.title.style.textOverflow).toBe('ellipsis');
  });
});

describe('Toolbar behaviour', () => {
  it('menu opens on the trigger, closes on Escape, and runs the action', () => {
    let ran = 0;
    // title 8 + Alpha 64 + Bravo 64 + 2 gaps = 152 > 128 available → Alpha to the menu
    const t = mount(160, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary', onSelect: () => { ran++; } }, { id: 'b', label: 'Bravo', priority: 'primary' }] });
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    expect(menu.style.display).toBe('none');
    t.trigger.click(); flushEffects();
    expect(menu.style.display).toBe('flex');
    (t.el.querySelector('[role=menuitem]') as HTMLElement).click(); flushEffects();
    expect(ran).toBe(1);
    expect(menu.style.display).toBe('none');
    t.trigger.click(); flushEffects();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); flushEffects();
    expect(menu.style.display).toBe('none');
  });

  it('re-decides when the actions change', async () => {
    const t = mount(300, { title: 'Title', actions: [{ id: 'x', label: 'X' }] });
    expect(t.trigger.style.display).toBe('none');
    (t.el as any)._setProp('actions', [{ id: 'x', label: 'X' }, { id: 'y', label: 'A very long label indeed' }, { id: 'z', label: 'Another long one' }]);
    flushEffects(); await Promise.resolve(); flushEffects();
    expect(t.trigger.style.display).not.toBe('none');
    expect(t.menuItems().length).toBeGreaterThan(0);
  });

  it('the public type offers no visual escape hatch', () => {
    // @ts-expect-error — there is no className
    Toolbar({ title: 't', actions: [], className: 'x' });
    // @ts-expect-error — there is no style
    Toolbar({ title: 't', actions: [], style: 'color:red' });
    // @ts-expect-error — actions carry no visual fields
    Toolbar({ title: 't', actions: [{ id: 'a', label: 'a', align: 'right' }] });
  });
});

describe('the minimum row: a primary never leaves (ADR 0042 e)', () => {
  // minimum row = minTitle 80 + gap 8 + trigger 32 + gap 8 + Save recipe 112 = 240 available → 272 wide with padding.
  const reporting = (fn: () => void) => { const reports: LayoutReport[] = []; const stop = onReport((r) => reports.push(r)); try { fn(); } finally { stop(); } return reports; };
  it('below the minimum row the primary stays, the title is at minTitle, the trigger shows and FIT_ROW stands', () => {
    const dev = devOverride(); setDevMode(true);
    try {
      const reports = reporting(() => { mount(220); });
      const t = mounted!;
      const shown = [...t.el.querySelectorAll<HTMLElement>('[data-nisli-action]')].filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-nisli-action'));
      expect(shown).toEqual(['save']);
      expect(t.el.querySelector<HTMLElement>('[data-nisli-action="save"]')!.style.display).toBe('inline-flex');
      expect(t.el.querySelector<HTMLElement>('h2')!.style.width).toBe('80px');
      expect(t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!.style.display).toBe('inline-flex');
      expect([...t.el.querySelectorAll('[role=menuitem]')].map((b) => b.textContent)).toEqual(['Share', 'Export', 'Edit']);
      expect(reports.map((r) => r.code)).toContain('FIT_ROW');
      expect(reports.at(-1)!.deficit).toBe(240 - (220 - 32));
      expect(t.el.getAttribute('data-nisli-report')).toBe('FIT_ROW');
    } finally { setDevMode(dev); }
  });
  it('a toolbar with only a primary at that width has no trigger and still reports', () => {
    const reports = reporting(() => { mount(150, { title: 'Grandmother’s lasagne al forno', actions: [{ id: 'save', label: 'Save recipe', priority: 'primary' }] }); });
    const t = mounted!;
    expect(t.el.querySelector<HTMLElement>('[data-nisli-action="save"]')!.style.display).toBe('inline-flex');
    expect(t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!.style.display).toBe('none');
    expect(t.el.querySelectorAll('[role=menuitem]').length).toBe(0);
    expect(reports.map((r) => r.code)).toEqual(['FIT_ROW']);
  });
  it('two primaries are both kept; the later one is not demoted', () => {
    const reports = reporting(() => { mount(200, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'p1', label: 'Publish now', priority: 'primary' }, { id: 'p2', label: 'Save draft', priority: 'primary' }] }); });
    const t = mounted!;
    const shown = [...t.el.querySelectorAll<HTMLElement>('[data-nisli-action]')].filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-nisli-action'));
    expect(shown).toEqual(['p1', 'p2']);
    expect([...t.el.querySelectorAll('[role=menuitem]')].map((b) => b.textContent)).toEqual(['Alpha']);
    expect(reports.map((r) => r.code)).toEqual(['FIT_ROW']);
  });
});

// ADR 0046: the axes size the controls; the block never says which context it is in.
describe('Toolbar under the axes (ADR 0046)', () => {
  afterEach(() => { setInput('system'); setDensity('system'); });
  const button = (t: ReturnType<typeof mount>) => t.el.querySelector<HTMLElement>('[data-nisli-action]')!.style;

  it('touch: every action button is 44px tall, and an overflowed menu item is never shorter than the target', () => {
    setInput('touch');
    expect(button(mount(1024)).height).toBe('44px');
    const t = mount(480);
    expect(t.menuItems()).toEqual(['Share', 'Export', 'Edit']);
    expect(t.el.querySelector<HTMLElement>('[role=menuitem]')!.style.minHeight).toBe('44px');
    expect(t.trigger.style.height).toBe('44px');
  });

  it('compact: a button is 28px tall with 8px side padding; the bar\'s minHeight follows', () => {
    setDensity('compact');
    const t = mount(1024);
    expect(button(t).height).toBe('28px');
    expect(button(t).padding).toBe('0px 8px');
    expect(t.el.style.minHeight).toBe(`${28 + 2 * 6 + 2}px`);
  });

  it('the default is untouched: 32px buttons, 12px side padding — and, by name, never narrower than a 24px target', () => {
    const t = mount(1024);
    expect(button(t).height).toBe('32px');
    expect(button(t).padding).toBe('0px 12px');
    expect(button(t).minWidth).toBe('24px');
    expect(t.el.querySelector<HTMLElement>('[data-nisli-action]')!.getAttribute('style')).toBe('flex:none;height:32px;min-width:24px;padding:0 12px;white-space:nowrap;display:inline-flex;align-items:center;gap:8px;cursor:pointer;font:inherit;background:none;border:none;color:inherit');
  });

  it('touch: the ⋯ trigger — a glyph with padding, 37px wide by its text — is floored to 44 on both sides', () => {
    setInput('touch');
    const t = mount(480);
    expect(t.trigger.style.height).toBe('44px');
    expect(t.trigger.style.minWidth).toBe('44px');
  });
});
