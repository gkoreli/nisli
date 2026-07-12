/**
 * input-group.test.ts — InputGroup component rendering and interop.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { html, flushEffects, type TemplateResult } from '@nisli/core';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  inputGroupAddonVariants,
  inputGroupButtonVariants,
  inputGroupClasses,
  inputGroupInputClasses,
  inputGroupTextClasses,
  inputGroupTextareaClasses,
} from './input-group.js';

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

describe('InputGroup via factory', () => {
  it('renders the exact group classes and composed parts', () => {
    const c = mount(html`${InputGroup({
      className: 'max-w-sm',
      children: html`${InputGroupAddon({ children: '$' })}${InputGroupInput({ placeholder: 'Amount' })}`,
    })}`);
    const group = bySlot('input-group', c);
    const addon = bySlot('input-group-addon', group);
    const input = bySlot('input-group-control', group) as HTMLInputElement;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.className).toBe(`${inputGroupClasses} max-w-sm`);
    expect(addon.className).toBe(inputGroupAddonVariants({ align: 'inline-start' }));
    expect(input.placeholder).toBe('Amount');
    for (const token of inputGroupInputClasses.split(/\s+/)) {
      expect(input.classList).toContain(token);
    }
  });

  it('renders addon alignment and button size variants', () => {
    const c = mount(html`${InputGroup({
      children: html`${InputGroupAddon({
        align: 'inline-end',
        children: InputGroupButton({ size: 'icon-sm', children: 'X' }),
      })}`,
    })}`);
    const addon = bySlot('input-group-addon', c);
    const button = bySlot('button', c) as HTMLButtonElement;
    expect(addon.getAttribute('data-align')).toBe('inline-end');
    expect(addon.className).toBe(inputGroupAddonVariants({ align: 'inline-end' }));
    expect(button.getAttribute('data-size')).toBe('icon-sm');
    for (const token of inputGroupButtonVariants({ size: 'icon-sm' }).split(/\s+/)) {
      expect(button.classList).toContain(token);
    }
    expect(button.type).toBe('button');
  });

  it('renders text and textarea classes and native form fields', () => {
    const c = mount(html`<form>${InputGroup({
      children: html`${InputGroupText({ children: 'Message' })}${InputGroupTextarea({
        name: 'message',
        value: 'Hello',
      })}`,
    })}</form>`);
    expect(bySlot('input-group-text', c).className).toBe(inputGroupTextClasses);
    const textarea = bySlot('input-group-control', c) as HTMLTextAreaElement;
    for (const token of inputGroupTextareaClasses.split(/\s+/)) {
      expect(textarea.classList).toContain(token);
    }
    expect(textarea.value).toBe('Hello');
    expect((c.querySelector('form') as HTMLFormElement).elements.namedItem('message')).toBe(textarea);
  });

  it('uses layout-transparent hosts', () => {
    const c = mount(html`${InputGroup({ children: InputGroupInput({}) })}`);
    expect((c.querySelector('ui-input-group') as HTMLElement).style.display).toBe('contents');
    expect((c.querySelector('ui-input-group-input') as HTMLElement).style.display).toBe('contents');
  });
});

describe('InputGroup as plain custom elements', () => {
  it('reads attributes and forwards id/name to the native input', () => {
    const host = document.createElement('ui-input-group-input');
    host.setAttribute('id', 'email');
    host.setAttribute('name', 'email');
    host.setAttribute('placeholder', 'you@example.com');
    host.setAttribute('class-name', 'text-right');
    document.body.appendChild(host);
    const input = bySlot('input-group-control', host) as HTMLInputElement;
    expect(host.hasAttribute('id')).toBe(false);
    expect(input.id).toBe('email');
    expect(input.name).toBe('email');
    expect(input.placeholder).toBe('you@example.com');
    expect(input.className.endsWith('text-right')).toBe(true);
  });

  it('projects children and addon clicks focus the input', () => {
    const groupHost = document.createElement('ui-input-group');
    const addonHost = document.createElement('ui-input-group-addon');
    addonHost.append('https://');
    const inputHost = document.createElement('ui-input-group-input');
    groupHost.append(addonHost, inputHost);
    document.body.appendChild(groupHost);
    const group = bySlot('input-group', groupHost);
    const addon = bySlot('input-group-addon', group);
    const input = bySlot('input-group-control', group) as HTMLInputElement;
    addon.click();
    expect(document.activeElement).toBe(input);
    expect(group.contains(addon)).toBe(true);
    expect(group.contains(input)).toBe(true);
  });

  it('uses plain textarea content as the initial value', () => {
    const host = document.createElement('ui-input-group-textarea');
    host.append('Initial message');
    document.body.appendChild(host);
    expect((bySlot('input-group-control', host) as HTMLTextAreaElement).value).toBe(
      'Initial message',
    );
  });
});

// ── Live rows attribute (UI-30 batch-1, rev delta) ──────────────────
describe('InputGroupTextarea — live rows attribute', () => {
  it('rows is live: setAttribute after mount updates the inner textarea', () => {
    document.body.innerHTML = '<ui-input-group-textarea rows="4"></ui-input-group-textarea>';
    flushEffects();
    const ta = document.body.querySelector('[data-slot="input-group-control"]') as HTMLTextAreaElement;
    expect(ta.getAttribute('rows')).toBe('4');
    (document.body.querySelector('ui-input-group-textarea') as HTMLElement).setAttribute('rows', '8');
    flushEffects();
    expect(ta.getAttribute('rows')).toBe('8');
  });
});
