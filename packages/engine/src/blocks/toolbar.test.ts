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
import { setMeasurer } from '../engine/measure.js';
import { metrics } from '../metrics.js';

let viewport = 1024;
const CHAR = 8;

beforeEach(() => {
  document.body.innerHTML = '';
  setMeasurer((el) => {
    if (el.tagName === 'NISLI-TOOLBAR') return viewport;
    if (el.tagName === 'H2') return (el.textContent ?? '').length * CHAR; // natural, ignores width style
    if (el.getAttribute('aria-label') === 'More actions') return 32;
    return (el.textContent ?? '').length * CHAR + 2 * metrics.control.padX;
  });
});
afterEach(() => setMeasurer(null));

const actions: Action[] = [
  { id: 'share', label: 'Share', priority: 'tertiary' },
  { id: 'export', label: 'Export', priority: 'tertiary' },
  { id: 'edit', label: 'Edit' },
  { id: 'save', label: 'Save recipe', priority: 'primary' },
];

function mount(width: number, props: { title: string; actions: Action[] } = { title: 'Grandmother’s lasagne al forno', actions }) {
  viewport = width;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const el = document.createElement('nisli-toolbar');
  for (const [k, v] of Object.entries(props)) (el as any)._setProp?.(k, v);
  host.appendChild(el);
  flushEffects();
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
