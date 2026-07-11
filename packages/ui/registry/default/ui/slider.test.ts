/**
 * slider.test.ts — Slider: native range input, value split, fill, form.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Slider, sliderClasses } from './slider.js';
import './label.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult, into: HTMLElement = document.body): HTMLElement {
  const container = document.createElement('div');
  into.appendChild(container);
  template.mount(container);
  return container;
}

function getRange(container: ParentNode = document.body): HTMLInputElement {
  const el = container.querySelector('input[type="range"]');
  expect(el).not.toBeNull();
  return el as HTMLInputElement;
}

describe('Slider via factory', () => {
  it('renders a native range input styled via pseudo-elements', () => {
    const c = mount(html`${Slider({ defaultValue: 50 })}`);
    const r = getRange(c);

    expect(r.type).toBe('range');
    expect(r.getAttribute('data-slot')).toBe('slider');
    expect(r.getAttribute('min')).toBe('0');
    expect(r.getAttribute('max')).toBe('100');
    expect(r.getAttribute('step')).toBe('1');
    // Track + thumb are styled through pseudo-element variants.
    expect(sliderClasses).toContain('[&::-webkit-slider-thumb]');
    expect(sliderClasses).toContain('[&::-moz-range-thumb]');
  });

  it('host is layout-transparent', () => {
    const c = mount(html`${Slider({ defaultValue: 10 })}`);
    expect((c.querySelector('ui-slider') as HTMLElement).style.display).toBe('contents');
  });

  it('forwards min/max/step and disabled', () => {
    const c = mount(html`${Slider({ min: 10, max: 20, step: 2, disabled: true })}`);
    const r = getRange(c);
    expect(r.getAttribute('min')).toBe('10');
    expect(r.getAttribute('max')).toBe('20');
    expect(r.getAttribute('step')).toBe('2');
    expect(r.disabled).toBe(true);
  });

  it('sets the initial value + reset target and computes the fill', () => {
    const c = mount(html`${Slider({ defaultValue: 25 })}`);
    const r = getRange(c);
    flushEffects();

    expect(r.value).toBe('25');
    expect(r.getAttribute('value')).toBe('25');
    // 25 of [0,100] → 25% fill.
    expect(r.getAttribute('style')).toContain('--slider-fill: 25%');
  });

  it('recomputes the fill on native input', () => {
    const c = mount(html`${Slider({ defaultValue: 0 })}`);
    const r = getRange(c);

    r.value = '75';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    flushEffects();

    expect(r.getAttribute('style')).toContain('--slider-fill: 75%');
  });

  it('maps the fill against a custom min/max range', () => {
    const c = mount(html`${Slider({ min: 0, max: 200, defaultValue: 50 })}`);
    const r = getRange(c);
    flushEffects();
    // 50 of [0,200] → 25%.
    expect(r.getAttribute('style')).toContain('--slider-fill: 25%');
  });

  it('applies programmatic value updates to the property', () => {
    const value = signal<number | undefined>(10);
    const c = mount(html`${Slider({ value })}`);
    const r = getRange(c);
    expect(r.value).toBe('10');

    value.value = 90;
    flushEffects();
    flushEffects();

    expect(r.value).toBe('90');
  });

  it('bubbles native input events out of the light DOM', () => {
    const onInput = vi.fn();
    const c = mount(html`<div @input=${onInput}>${Slider({ defaultValue: 5 })}</div>`);
    getRange(c).dispatchEvent(new Event('input', { bubbles: true }));
    expect(onInput).toHaveBeenCalled();
  });
});

describe('Slider native form participation', () => {
  it('forwards id/name and associates with a label', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    form.innerHTML =
      '<ui-label for="vol">Volume</ui-label><ui-slider id="vol" name="vol"></ui-slider>';

    const r = getRange(form);
    const label = form.querySelector('label') as HTMLLabelElement;
    expect(r.id).toBe('vol');
    expect(label.control).toBe(r);
    expect(form.elements.namedItem('vol')).toBe(r);
  });

  it('restores the initial value on form.reset()', () => {
    const form = document.createElement('form');
    document.body.appendChild(form);
    mount(html`${Slider({ name: 'vol', defaultValue: 30 })}`, form);

    const r = getRange(form);
    r.value = '80';
    expect(r.value).toBe('80');

    form.reset();
    expect(r.value).toBe('30');
  });
});
