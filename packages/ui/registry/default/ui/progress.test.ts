/**
 * progress.test.ts — Progress: progressbar ARIA + indicator transform.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Progress } from './progress.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function bar(container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector('[data-slot="progress"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

function indicator(container: ParentNode = document.body): HTMLElement {
  return container.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
}

describe('Progress', () => {
  it('renders a progressbar with the ARIA contract', () => {
    const c = mount(html`${Progress({ value: 60 })}`);
    const b = bar(c);

    expect(b.getAttribute('role')).toBe('progressbar');
    expect(b.getAttribute('aria-valuemin')).toBe('0');
    expect(b.getAttribute('aria-valuemax')).toBe('100');
    expect(b.getAttribute('aria-valuenow')).toBe('60');
    expect(b.getAttribute('data-state')).toBe('loading');
    expect(b.getAttribute('data-value')).toBe('60');
    expect(b.className).toContain('rounded-full');
  });

  it('host is layout-transparent', () => {
    const c = mount(html`${Progress({ value: 10 })}`);
    expect((c.querySelector('ui-progress') as HTMLElement).style.display).toBe('contents');
  });

  it('translates the indicator by -(100 - value)%', () => {
    const c = mount(html`${Progress({ value: 60 })}`);
    expect(indicator(c).getAttribute('style')).toContain('translateX(-40%)');
    expect(indicator(c).className).toContain('bg-primary');
  });

  it('updates aria-valuenow and the transform reactively', () => {
    const value = signal<number | undefined>(25);
    const c = mount(html`${Progress({ value })}`);
    expect(bar(c).getAttribute('aria-valuenow')).toBe('25');
    expect(indicator(c).getAttribute('style')).toContain('translateX(-75%)');

    value.value = 100;
    flushEffects();
    flushEffects();

    expect(bar(c).getAttribute('aria-valuenow')).toBe('100');
    expect(bar(c).getAttribute('data-state')).toBe('complete');
    expect(indicator(c).getAttribute('style')).toContain('translateX(-0%)');
  });

  it('is indeterminate with no value', () => {
    const c = mount(html`${Progress({})}`);
    const b = bar(c);
    expect(b.hasAttribute('aria-valuenow')).toBe(false);
    expect(b.getAttribute('data-state')).toBe('indeterminate');
  });

  it('reads value/max from host attributes (plain HTML)', () => {
    const host = document.createElement('ui-progress');
    host.setAttribute('value', '30');
    host.setAttribute('max', '50');
    document.body.appendChild(host);

    const b = bar(host);
    expect(b.getAttribute('aria-valuenow')).toBe('30');
    expect(b.getAttribute('aria-valuemax')).toBe('50');
  });
});

describe('Progress — live attributes (UI-30 attrs{})', () => {
  it('reacts to post-mount value / max attribute changes', () => {
    document.body.innerHTML = '<ui-progress value="20"></ui-progress>';
    flushEffects();
    const host = document.querySelector('ui-progress')!;
    const b = bar();
    expect(b.getAttribute('aria-valuenow')).toBe('20');
    expect(b.getAttribute('data-state')).toBe('loading');

    host.setAttribute('value', '100');
    flushEffects();
    expect(b.getAttribute('aria-valuenow')).toBe('100');
    expect(b.getAttribute('data-state')).toBe('complete');

    host.setAttribute('max', '200');
    flushEffects();
    expect(b.getAttribute('aria-valuemax')).toBe('200');
    expect(b.getAttribute('data-state')).toBe('loading'); // 100 < 200 again

    // Removing value → indeterminate (no aria-valuenow).
    host.removeAttribute('value');
    flushEffects();
    expect(b.hasAttribute('aria-valuenow')).toBe(false);
    expect(b.getAttribute('data-state')).toBe('indeterminate');
  });
});
