/**
 * alert.test.ts — Alert / AlertTitle / AlertDescription rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import {
  Alert,
  AlertTitle,
  AlertDescription,
  alertVariants,
  type AlertVariant,
} from './alert.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Mount a template into a connected container and return it. */
function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function bySlot(slot: string, container: ParentNode = document.body): HTMLElement {
  const el = container.querySelector(`[data-slot="${slot}"]`);
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

describe('Alert via factory', () => {
  it('renders a themed alert with role and defaults', () => {
    const c = mount(html`${Alert({ children: 'Heads up!' })}`);
    const alert = bySlot('alert', c);

    expect(alert.tagName).toBe('DIV');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.getAttribute('data-slot')).toBe('alert');
    expect(alert.textContent).toBe('Heads up!');
    expect(alert.className).toContain('rounded-lg');
    expect(alert.className).toContain('bg-card');
  });

  it('host is layout-transparent; styling lives on the inner div', () => {
    const c = mount(html`${Alert({ children: 'x' })}`);
    const host = c.querySelector('ui-alert') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(bySlot('alert', host).parentElement).toBe(host);
  });

  it('applies the destructive variant, merging className last', () => {
    const c = mount(html`${Alert({ variant: 'destructive', className: 'mt-4', children: 'Bad' })}`);
    const alert = bySlot('alert', c);

    const expected = new Set(`${alertVariants({ variant: 'destructive' })} mt-4`.split(/\s+/));
    expect(new Set(alert.className.split(/\s+/))).toEqual(expected);
    expect(alert.className).toContain('text-destructive');
    expect(alert.className.endsWith('mt-4')).toBe(true);
  });

  it('updates variant classes reactively', () => {
    const variant = signal<AlertVariant | undefined>('default');
    const c = mount(html`${Alert({ variant, children: 'x' })}`);
    const alert = bySlot('alert', c);
    expect(alert.className).toContain('bg-card');

    variant.value = 'destructive';
    flushEffects();
    flushEffects();

    expect(alert.className).toContain('text-destructive');
  });

  it('composes title and description factories as children', () => {
    const c = mount(
      html`${Alert({
        children: html`${AlertTitle({ children: 'Error' })}${AlertDescription({ children: 'It broke.' })}`,
      })}`,
    );
    const alert = bySlot('alert', c);
    const title = bySlot('alert-title', alert);
    const desc = bySlot('alert-description', alert);

    expect(title.tagName).toBe('DIV');
    expect(title.textContent).toBe('Error');
    expect(title.className).toContain('font-medium');
    expect(desc.tagName).toBe('DIV');
    expect(desc.textContent).toBe('It broke.');
    expect(desc.className).toContain('text-sm');
    expect(alert.contains(title)).toBe(true);
    expect(alert.contains(desc)).toBe(true);
  });
});

describe('AlertTitle / AlertDescription via factory', () => {
  it('render their own slots and merge className', () => {
    const t = mount(html`${AlertTitle({ className: 'text-lg', children: 'T' })}`);
    expect(bySlot('alert-title', t).className.endsWith('text-lg')).toBe(true);

    const d = mount(html`${AlertDescription({ className: 'opacity-80', children: 'D' })}`);
    expect(bySlot('alert-description', d).className.endsWith('opacity-80')).toBe(true);
  });
});

describe('Alert as plain custom elements', () => {
  it('reads variant from host attribute and projects nested children', () => {
    document.body.innerHTML =
      '<ui-alert variant="destructive"><ui-alert-title>Error</ui-alert-title><ui-alert-description>Failed.</ui-alert-description></ui-alert>';

    const alert = bySlot('alert');
    expect(alert.className).toContain('text-destructive');
    expect(alert.getAttribute('role')).toBe('alert');

    // Projection happens in a microtask for parser-appended children.
    return Promise.resolve().then(() => {
      const title = bySlot('alert-title', alert);
      const desc = bySlot('alert-description', alert);
      expect(title.textContent).toBe('Error');
      expect(desc.textContent).toBe('Failed.');
      expect(alert.contains(title)).toBe(true);
    });
  });

  it('projects pre-existing light-DOM children into the inner div', () => {
    const host = document.createElement('ui-alert');
    const strong = document.createElement('strong');
    strong.textContent = 'Note';
    host.append(strong, ' pay attention');
    document.body.appendChild(host);

    const alert = bySlot('alert', host);
    expect(alert.contains(strong)).toBe(true);
    expect(alert.textContent).toBe('Note pay attention');
    expect([...host.childNodes].every((n) => n === alert)).toBe(true);
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-alert');
    host.setAttribute('variant', 'default');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp(
      'variant',
      'destructive',
    );
    document.body.appendChild(host);

    expect(bySlot('alert', host).className).toContain('text-destructive');
  });
});
