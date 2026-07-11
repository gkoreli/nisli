/**
 * spinner.test.ts — Spinner rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { Spinner, spinnerClasses } from './spinner.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function getSpinner(container: ParentNode = document.body): SVGSVGElement {
  const el = container.querySelector('svg[role]');
  expect(el).not.toBeNull();
  return el as SVGSVGElement;
}

describe('Spinner via factory', () => {
  it('renders the accessible Loader2 icon with exact classes', () => {
    const c = mount(html`${Spinner({})}`);
    const spinner = getSpinner(c);

    expect(spinner.getAttribute('role')).toBe('status');
    expect(spinner.getAttribute('aria-label')).toBe('Loading');
    expect(spinner.getAttribute('data-slot')).toBe('spinner');
    expect(spinner.getAttribute('class')).toBe(spinnerClasses);
    expect(spinner.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(spinner.querySelector('path')?.getAttribute('d')).toBe(
      'M21 12a9 9 0 1 1-6.219-8.56',
    );
  });

  it('uses a transparent host and merges className last', () => {
    const c = mount(html`${Spinner({ className: 'text-primary' })}`);
    const host = c.querySelector('ui-spinner') as HTMLElement;
    const spinner = getSpinner(host);

    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(spinner.parentElement).toBe(host);
    expect(spinner.getAttribute('class')).toBe(`${spinnerClasses} text-primary`);
  });

  it('renders TemplateResult children in the svg', () => {
    const c = mount(
      html`${Spinner({ children: html`<circle data-testid="dot" cx="12" cy="12" r="1"></circle>` })}`,
    );

    expect(getSpinner(c).querySelector('[data-testid="dot"]')).not.toBeNull();
  });
});

describe('Spinner as a plain custom element', () => {
  it('reads class and accessible-name overrides from host attributes', () => {
    const host = document.createElement('ui-spinner');
    host.setAttribute('class-name', 'text-destructive');
    host.setAttribute('aria-label', 'Saving');
    document.body.appendChild(host);

    const spinner = getSpinner(host);
    expect(spinner.getAttribute('class')).toBe(`${spinnerClasses} text-destructive`);
    expect(spinner.getAttribute('aria-label')).toBe('Saving');
  });

  it('projects pre-existing svg children', () => {
    const host = document.createElement('ui-spinner');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = 'Loading';
    host.append(title);
    document.body.appendChild(host);

    const spinner = getSpinner(host);
    expect(spinner.contains(title)).toBe(true);
    expect([...host.childNodes].every((node) => node === spinner)).toBe(true);
  });
});
