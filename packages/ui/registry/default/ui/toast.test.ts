/**
 * toast.test.ts — toast() store and <ui-toaster> rendering.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import { Toaster, toast, toasts } from './toast.js';

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function titles(c: ParentNode = document.body): string[] {
  return [...c.querySelectorAll('[data-slot="toast-title"]')].map((el) => el.textContent ?? '');
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  toast.dismiss(); // clear the module-level store between tests
  flushEffects();
  vi.useRealTimers();
});

describe('toast() store', () => {
  it('pushes items with types and returns ids', () => {
    const id = toast('Hello');
    toast.success('Saved');
    expect(toasts.value.map((t) => t.type)).toEqual(['default', 'success']);
    toast.dismiss(id);
    expect(toasts.value.map((t) => t.title)).toEqual(['Saved']);
  });
});

describe('<ui-toaster>', () => {
  it('renders toasts with slots, type, and role', () => {
    const c = mount(html`${Toaster({})}`);
    toast('Plain');
    toast.error('Boom', { description: 'It broke.' });
    flushEffects();

    expect(titles(c)).toEqual(['Plain', 'Boom']);
    const items = c.querySelectorAll('[data-slot="toast"]');
    expect(items[0]?.getAttribute('role')).toBe('status');
    expect(items[1]?.getAttribute('role')).toBe('alert');
    expect(items[1]?.getAttribute('data-type')).toBe('error');
    expect(c.querySelector('[data-slot="toast-description"]')?.textContent).toBe('It broke.');
  });

  it('limits visible toasts to visibleToasts, keeping the newest', () => {
    const c = mount(html`${Toaster({ visibleToasts: 2 })}`);
    toast('one');
    toast('two');
    toast('three');
    flushEffects();

    expect(titles(c)).toEqual(['two', 'three']);
    expect(toasts.value).toHaveLength(3); // store keeps all
  });

  it('auto-dismisses after duration', () => {
    const c = mount(html`${Toaster({})}`);
    toast('bye', { duration: 1000 });
    flushEffects();
    expect(titles(c)).toEqual(['bye']);

    vi.advanceTimersByTime(1100);
    flushEffects();
    expect(titles(c)).toEqual([]);
  });

  it('dismisses only the newest toast on Escape', () => {
    const c = mount(html`${Toaster({})}`);
    toast('older', { duration: Infinity });
    toast('newer', { duration: Infinity });
    flushEffects();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    flushEffects();

    expect(event.defaultPrevented).toBe(true);
    expect(titles(c)).toEqual(['older']);
  });

  it('consumes Escape once when multiple positioned toasters are connected', () => {
    const first = mount(html`${Toaster({ position: 'top-left' })}`);
    const second = mount(html`${Toaster({ position: 'bottom-right' })}`);
    toast('older', { duration: Infinity });
    toast('newer', { duration: Infinity });
    flushEffects();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flushEffects();

    expect(titles(first)).toEqual(['older']);
    expect(titles(second)).toEqual(['older']);
    expect(toasts.value.map((item) => item.title)).toEqual(['older']);
  });

  it('removes the Escape listener when the toaster disconnects', async () => {
    const c = mount(html`${Toaster({})}`);
    toast('still active', { duration: Infinity });
    flushEffects();
    (c.querySelector('ui-toaster') as HTMLElement).remove();
    await Promise.resolve(); // component teardown is move-safe and microtask-deferred

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    flushEffects();

    expect(event.defaultPrevented).toBe(false);
    expect(toasts.value.map((item) => item.title)).toEqual(['still active']);
  });

  it('does not steal or disturb focus while rendering and dismissing', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const c = mount(html`${Toaster({})}`);

    toast('background notice', { duration: Infinity });
    flushEffects();
    expect(document.activeElement).toBe(button);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushEffects();
    expect(titles(c)).toEqual([]);
    expect(document.activeElement).toBe(button);
  });

  it('keeps Infinity-duration toasts until dismissed', () => {
    const c = mount(html`${Toaster({})}`);
    const id = toast('sticky', { duration: Infinity });
    flushEffects();

    vi.advanceTimersByTime(60_000);
    flushEffects();
    expect(titles(c)).toEqual(['sticky']);

    toast.dismiss(id);
    flushEffects();
    expect(titles(c)).toEqual([]);
  });

  it('pauses auto-dismiss while hovered and resumes on leave', () => {
    const c = mount(html`${Toaster({})}`);
    toast('wait', { duration: 1000 });
    flushEffects();

    const region = c.querySelector('[data-slot="toaster"]') as HTMLElement;
    region.dispatchEvent(new Event('pointerenter'));
    flushEffects();
    vi.advanceTimersByTime(5000);
    flushEffects();
    expect(titles(c)).toEqual(['wait']); // paused

    region.dispatchEvent(new Event('pointerleave'));
    flushEffects();
    vi.advanceTimersByTime(1100);
    flushEffects();
    expect(titles(c)).toEqual([]);
  });

  it('dismisses a toast on click', () => {
    const c = mount(html`${Toaster({})}`);
    toast('clickme');
    flushEffects();

    (c.querySelector('[data-slot="toast"]') as HTMLElement).click();
    flushEffects();
    expect(titles(c)).toEqual([]);
  });

  it('respects the position attribute in plain HTML', () => {
    document.body.innerHTML = '<ui-toaster position="top-center"></ui-toaster>';
    const region = document.querySelector('[data-slot="toaster"]') as HTMLElement;
    expect(region.getAttribute('data-position')).toBe('top-center');
    expect(region.className).toContain('top-4');
  });
});

describe('Toaster parity (UI-36B)', () => {
  it('honors the visible-toasts attribute (live, declared attr)', () => {
    const c = mount(html`${Toaster({})}`);
    const host = c.querySelector('ui-toaster') as HTMLElement;
    host.setAttribute('visible-toasts', '1');
    flushEffects();

    toast('one');
    toast('two');
    flushEffects();
    const visible = [...c.querySelectorAll('[data-slot="toast"]')];
    expect(visible.length).toBe(1);
  });
});
