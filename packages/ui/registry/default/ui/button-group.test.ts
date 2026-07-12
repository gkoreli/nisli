/**
 * button-group.test.ts — ButtonGroup component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import { Button } from './button.js';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupSeparatorClasses,
  buttonGroupTextClasses,
  buttonGroupVariants,
} from './button-group.js';

beforeEach(() => { document.body.innerHTML = ''; });

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

describe('ButtonGroup via factory', () => {
  it('renders a horizontal group with exact default classes', () => {
    const group = bySlot('button-group', mount(html`${ButtonGroup({ children: 'Actions' })}`));
    expect(group.tagName).toBe('DIV');
    expect(group.getAttribute('role')).toBe('group');
    expect(group.hasAttribute('data-orientation')).toBe(false);
    expect(group.className).toBe(buttonGroupVariants({}));
    expect(group.className).toContain('rounded-l-none');
  });

  it('applies vertical orientation and merges className last', () => {
    const group = bySlot(
      'button-group',
      mount(html`${ButtonGroup({ orientation: 'vertical', className: 'w-full' })}`),
    );
    expect(group.getAttribute('data-orientation')).toBe('vertical');
    expect(group.className).toBe(`${buttonGroupVariants({ orientation: 'vertical' })} w-full`);
    expect(group.className).toContain('flex-col');
  });

  it('uses a transparent host and composes text and separator children', () => {
    const c = mount(html`${ButtonGroup({
      children: html`${ButtonGroupText({ children: '$' })}${ButtonGroupSeparator({})}`,
    })}`);
    const host = c.querySelector('ui-button-group') as HTMLElement;
    const group = bySlot('button-group', host);
    const text = bySlot('button-group-text', group);
    const separator = bySlot('button-group-separator', group);
    expect(host.style.display).toBe('contents');
    expect(group.parentElement).toBe(host);
    expect(text.className).toBe(buttonGroupTextClasses);
    expect(separator.className).toContain(buttonGroupSeparatorClasses);
    expect(separator.getAttribute('data-orientation')).toBe('vertical');
    expect(separator.getAttribute('role')).toBe('none');
  });

  it('keeps button hosts direct while targeting their painted inner buttons', () => {
    const c = mount(html`${ButtonGroup({
      children: html`${Button({ variant: 'outline', children: 'Cut' })}
      ${Button({ variant: 'outline', children: 'Copy' })}
      ${Button({ variant: 'outline', children: 'Paste' })}`,
    })}`);
    const group = bySlot('button-group', c);
    const hosts = [...group.children];
    expect(hosts.map((host) => host.tagName)).toEqual(['UI-BUTTON', 'UI-BUTTON', 'UI-BUTTON']);
    expect(hosts.map((host) => host.querySelector('[data-slot="button"]')?.textContent)).toEqual([
      'Cut', 'Copy', 'Paste',
    ]);
    expect(group.className).toContain(
      '[&>ui-button:not(:first-child)>[data-slot=button]]:border-l-0',
    );
    expect(group.className).toContain(
      '[&>ui-button:not(:last-child)>[data-slot=button]]:rounded-r-none',
    );
  });

  it('translates nested-group gap and both orientation contracts through transparent hosts', () => {
    expect(buttonGroupVariants({})).toContain(
      'has-[>ui-button-group>[data-slot=button-group]]:gap-2',
    );
    expect(buttonGroupVariants({ orientation: 'horizontal' })).toContain(
      '[&>ui-button-group-text:not(:first-child)>[data-slot=button-group-text]]:rounded-l-none',
    );
    expect(buttonGroupVariants({ orientation: 'vertical' })).toContain(
      '[&>ui-button:not(:first-child)>[data-slot=button]]:border-t-0',
    );
  });
});

describe('ButtonGroup as plain custom elements', () => {
  it('reads orientation and className from host attributes', () => {
    const host = document.createElement('ui-button-group');
    host.setAttribute('orientation', 'vertical');
    host.setAttribute('class-name', 'w-full');
    document.body.appendChild(host);
    const group = bySlot('button-group', host);
    expect(group.getAttribute('data-orientation')).toBe('vertical');
    expect(group.className).toBe(`${buttonGroupVariants({ orientation: 'vertical' })} w-full`);
  });

  it('projects pre-existing children into the inner group', () => {
    const host = document.createElement('ui-button-group');
    const button = document.createElement('button');
    button.textContent = 'Save';
    host.append(button);
    document.body.appendChild(host);
    const group = bySlot('button-group', host);
    expect(group.contains(button)).toBe(true);
    expect([...host.childNodes].every((node) => node === group)).toBe(true);
  });

  it('projects text content and reads separator orientation', () => {
    const textHost = document.createElement('ui-button-group-text');
    textHost.append('https://');
    document.body.appendChild(textHost);
    expect(bySlot('button-group-text', textHost).textContent).toBe('https://');
    const separatorHost = document.createElement('ui-button-group-separator');
    separatorHost.setAttribute('orientation', 'horizontal');
    document.body.appendChild(separatorHost);
    expect(bySlot('button-group-separator', separatorHost).getAttribute('data-orientation')).toBe('horizontal');
  });
});
