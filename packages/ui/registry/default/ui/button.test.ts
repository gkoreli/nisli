/**
 * button.test.ts — Button component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Button, buttonVariants, type ButtonVariant } from './button.js';

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

function getButton(container: ParentNode = document.body): HTMLButtonElement {
  const btn = container.querySelector('button');
  expect(btn).not.toBeNull();
  return btn as HTMLButtonElement;
}

describe('Button via factory', () => {
  it('renders a themed <button> with defaults', () => {
    const c = mount(html`${Button({ children: 'Save' })}`);
    const btn = getButton(c);

    expect(btn.textContent).toBe('Save');
    expect(btn.getAttribute('data-slot')).toBe('button');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('h-9');
  });

  it('host is layout-transparent; styling lives on the inner button', () => {
    const c = mount(html`${Button({ children: 'Save' })}`);
    const host = c.querySelector('ui-button') as HTMLElement;

    expect(host).not.toBeNull();
    expect(host.style.display).toBe('contents');
    expect(host.className).toBe('');
    expect(getButton(host).parentElement).toBe(host);
  });

  it('applies variant and size classes, merging className last', () => {
    const c = mount(
      html`${Button({ variant: 'outline', size: 'sm', className: 'w-full', children: 'Go' })}`,
    );
    const btn = getButton(c);

    // The class attribute binding applies tokens via classList, which
    // dedupes repeats (e.g. rounded-md in both base and size-sm) —
    // compare token sets, not the raw string.
    const expected = new Set(`${buttonVariants({ variant: 'outline', size: 'sm' })} w-full`.split(/\s+/));
    expect(new Set(btn.className.split(/\s+/))).toEqual(expected);
    expect(btn.className).toContain('border-input');
    expect(btn.className).toContain('h-8');
    expect(btn.className.endsWith('w-full')).toBe(true);
  });

  it('updates classes reactively when a variant signal changes', () => {
    const variant = signal<ButtonVariant | undefined>('default');
    const c = mount(html`${Button({ variant, children: 'X' })}`);
    const btn = getButton(c);
    expect(btn.className).toContain('bg-primary');

    variant.value = 'destructive';
    flushEffects();
    flushEffects();

    expect(btn.className).toContain('bg-destructive');
    expect(btn.className).not.toContain('bg-primary ');
  });

  it('reflects disabled and type props onto the native button', () => {
    const c = mount(html`${Button({ disabled: true, type: 'submit', children: 'Send' })}`);
    const btn = getButton(c);

    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.getAttribute('type')).toBe('submit');
  });

  it('renders TemplateResult children', () => {
    const c = mount(html`${Button({ children: html`<span data-testid="icon">*</span> Add` })}`);
    const btn = getButton(c);

    expect(btn.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(btn.textContent).toContain('Add');
  });

  it('native click bubbles out of the light DOM', () => {
    const onClick = vi.fn();
    const c = mount(html`<div @click=${onClick}>${Button({ children: 'Hit' })}</div>`);

    getButton(c).click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Button as a plain custom element', () => {
  it('reads variant/size/disabled from host attributes', () => {
    const host = document.createElement('ui-button');
    host.setAttribute('variant', 'secondary');
    host.setAttribute('size', 'lg');
    host.setAttribute('disabled', '');
    host.append('Delete');
    document.body.appendChild(host);

    const btn = getButton(host);
    expect(btn.className).toContain('bg-secondary');
    expect(btn.className).toContain('px-6');
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('projects pre-existing light-DOM children into the inner button', () => {
    const host = document.createElement('ui-button');
    const icon = document.createElement('span');
    icon.textContent = '!';
    host.append(icon, ' Warn');
    document.body.appendChild(host);

    const btn = getButton(host);
    expect(btn.contains(icon)).toBe(true);
    expect(btn.textContent).toBe('! Warn');
    // Nothing left dangling directly under the host besides the button.
    expect([...host.childNodes].every((n) => n === btn)).toBe(true);
  });

  it('works via innerHTML parsing (children appended after upgrade)', async () => {
    document.body.innerHTML = '<ui-button variant="destructive">Nuke</ui-button>';

    const btn = getButton();
    expect(btn.className).toContain('bg-destructive');
    // happy-dom connects the element before parsing its children — the
    // projectChildren() microtask sweep picks the label up afterwards.
    await Promise.resolve();
    expect(btn.textContent).toBe('Nuke');
  });

  it('explicit prop wins over host attribute', () => {
    const host = document.createElement('ui-button');
    host.setAttribute('variant', 'outline');
    (host as unknown as { _setProp(k: string, v: unknown): void })._setProp(
      'variant',
      'destructive',
    );
    document.body.appendChild(host);

    const btn = getButton(host);
    expect(btn.className).toContain('bg-destructive');
    expect(btn.className).not.toContain('border-input');
  });
});
