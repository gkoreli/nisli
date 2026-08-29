/**
 * The layout decisions the shell, grid and dialog make at width — proven
 * with a measurer, no browser.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects, html } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { metrics } from '../metrics.js';
import './app.js'; import './grid.js'; import './dialog.js'; import './form.js';

let width = 1280;
beforeEach(() => { document.body.innerHTML = ''; document.body.style.overflow = ''; setMeasurer(() => width); });
afterEach(() => setMeasurer(null));

const make = (tag: string, props: Record<string, unknown>, w: number) => {
  width = w;
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) (el as any)._setProp(k, v);
  document.body.appendChild(el);
  flushEffects();
  return el;
};
const nav = [{ label: 'Overview', href: '/' }, { label: 'Accounts', href: '/accounts' }];
const content = html`<p>content</p>`;

describe('App shell', () => {
  const sidebarAt = (w: number) => {
    const el = make('nisli-app', { brand: 'B', nav, location: '/accounts', content }, w);
    return el.querySelector<HTMLElement>('nav[aria-label=Primary]')!.style.display !== 'none';
  };
  it('has a sidebar when a useful content column fits beside it', () => {
    expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin)).toBe(true);
    expect(sidebarAt(1280)).toBe(true);
  });
  it('becomes a top bar one pixel narrower', () => {
    expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin - 1)).toBe(false);
    expect(sidebarAt(360)).toBe(false);
  });
  it('marks the current section and treats / as exact', () => {
    const el = make('nisli-app', { brand: 'B', nav, location: '/accounts/x', content }, 1280);
    const current = [...el.querySelectorAll<HTMLElement>('nav')].filter((n) => n.style.display !== 'none').flatMap((n) => [...n.querySelectorAll('a[aria-current=page]')]).map((a) => a.textContent);
    expect(current).toEqual(['Accounts']);
  });
});

describe('Grid', () => {
  const cols = (w: number, n: number) => {
    const el = make('nisli-grid', { children: Array.from({ length: n }, () => html`<i></i>`) }, w);
    return el.style.gridTemplateColumns;
  };
  it('one column on a phone, four on a desktop, never more than there are cells', () => {
    expect(cols(360, 4)).toBe('repeat(1, minmax(0, 1fr))');
    expect(cols(1100, 4)).toBe('repeat(4, minmax(0, 1fr))');
    expect(cols(1100, 2)).toBe('repeat(2, minmax(0, 1fr))');
  });
});

describe('Dialog', () => {
  const dialogAt = (w: number) => {
    const el = make('nisli-dialog', { title: 'T', open: true, onClose: () => {}, children: html`<b>x</b>` }, w);
    return el.querySelector<HTMLElement>('[role=dialog]')!;
  };
  it('is a centred card with room and a full-width sheet on a phone', () => {
    expect(dialogAt(1024).style.width).toBe(`${metrics.layout.dialogWidth}px`);
    expect(dialogAt(360).style.width).toBe('100%');
  });
  it('locks page scroll while open and releases it when closed', () => {
    const el = make('nisli-dialog', { title: 'T', open: true, onClose: () => {}, children: html`<b>x</b>` }, 1024);
    expect(document.body.style.overflow).toBe('hidden');
    (el as any)._setProp('open', false); flushEffects();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Form', () => {
  it('lays fields out in as many columns as fit, textarea spanning all', () => {
    const fields = [
      { key: 'a', label: 'A', kind: 'text' }, { key: 'b', label: 'B', kind: 'money' },
      { key: 'c', label: 'C', kind: 'select', options: [] }, { key: 'n', label: 'N', kind: 'textarea' },
    ];
    const grid = (w: number) => make('nisli-form', { fields, value: {}, onChange: () => {}, onSubmit: () => {} }, w).querySelector<HTMLElement>('form > div')!;
    expect(grid(360).style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    expect(grid(800).style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(grid(800).querySelectorAll('label')[3]!.style.gridColumn).toBe('1 / -1');
  });
  it('refuses to submit with a required field empty and says which', () => {
    let submitted = 0;
    const el = make('nisli-form', { fields: [{ key: 'payee', label: 'Payee', kind: 'text', required: true }], value: { payee: '' }, onChange: () => {}, onSubmit: () => submitted++ }, 800);
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); flushEffects();
    expect(submitted).toBe(0);
    expect(el.textContent).toContain('Payee is required.');
  });
});
