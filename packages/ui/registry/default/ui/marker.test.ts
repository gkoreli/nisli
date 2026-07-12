/**
 * marker.test.ts — Marker component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Marker,
  MarkerContent,
  MarkerIcon,
  markerVariants,
} from './marker.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

describe('Marker via factory', () => {
  it('renders the default variant with exact classes and slots', () => {
    const container = mount(
      html`${Marker({
        className: 'mt-2',
        children: html`${MarkerIcon({ children: '*' })}${MarkerContent({ children: 'Note' })}`,
      })}`,
    );
    const marker = container.querySelector('[data-slot="marker"]') as HTMLElement;
    const expected = new Set(`${markerVariants({ variant: 'default' })} mt-2`.split(/\s+/));

    expect(marker.getAttribute('data-variant')).toBe('default');
    expect(new Set(marker.className.split(/\s+/))).toEqual(expected);
    expect(marker.className.endsWith('mt-2')).toBe(true);
    expect(marker.querySelector('[data-slot="marker-icon"]')?.getAttribute('aria-hidden')).toBe('true');
    expect(marker.querySelector('[data-slot="marker-content"]')?.textContent).toBe('Note');
  });

  it('applies separator and border variant classes', () => {
    const separator = mount(html`${Marker({ variant: 'separator', children: 'Or' })}`)
      .querySelector('[data-slot="marker"]') as HTMLElement;
    const border = mount(html`${Marker({ variant: 'border', children: 'More' })}`)
      .querySelector('[data-slot="marker"]') as HTMLElement;

    expect(separator.className).toContain('before:flex-1');
    expect(separator.className).toContain('after:bg-border');
    expect(border.className).toContain('border-b');
    expect(border.className).toContain('pb-2');
  });
});

describe('Marker as a plain custom element', () => {
  it('reads variant and class-name host attributes', () => {
    const host = document.createElement('ui-marker');
    host.setAttribute('variant', 'border');
    host.setAttribute('class-name', 'text-foreground');
    host.append('Details');
    document.body.appendChild(host);

    const marker = host.querySelector('[data-slot="marker"]') as HTMLElement;
    expect(marker.getAttribute('data-variant')).toBe('border');
    expect(marker.className).toContain('border-border');
    expect(marker.className.endsWith('text-foreground')).toBe(true);
  });

  it('projects pre-existing light-DOM children for every part', () => {
    const host = document.createElement('ui-marker');
    const iconHost = document.createElement('ui-marker-icon');
    const icon = document.createElement('svg');
    iconHost.appendChild(icon);
    const contentHost = document.createElement('ui-marker-content');
    const label = document.createElement('a');
    label.textContent = 'Learn more';
    contentHost.appendChild(label);
    host.append(iconHost, contentHost);
    document.body.appendChild(host);

    expect(host.querySelector('[data-slot="marker-icon"]')?.contains(icon)).toBe(true);
    expect(host.querySelector('[data-slot="marker-content"]')?.contains(label)).toBe(true);
    expect(host.querySelector('[data-slot="marker"]')?.contains(iconHost)).toBe(true);
  });
});
