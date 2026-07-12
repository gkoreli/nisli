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

// ── UI-58: transparent-host composition-selector translation ────────
//
// The group's direct children are projected custom-element HOSTS (display:contents),
// so upstream's direct-child layout selectors are dead and were translated to
// descendant form. happy-dom has no layout engine, so these prove the STRUCTURAL
// prerequisites (the applicability regression) + the class-form (built-CSS check);
// the actual painted geometry is browser-verify-gated.
describe('UI-58 — dead direct-child composition selectors translated to descendant', () => {
  const g = (root: ParentNode) => bySlot('input-group', root);

  it('the control input is a DESCENDANT, not a direct child, of the group (why [&>input] was dead)', () => {
    const c = mount(
      html`${InputGroup({
        children: html`${InputGroupAddon({ align: 'inline-start', children: '🔍' })}
        ${InputGroupInput({ placeholder: 'Search…' })}`,
      })}`,
    );
    const group = g(c);
    // Direct children are the transparent hosts, NOT the input / the [data-align] div.
    expect(group.querySelector(':scope > input')).toBeNull();
    expect(group.querySelector(':scope > [data-align]')).toBeNull();
    expect(group.querySelector(':scope > ui-input-group-input')).not.toBeNull();
    expect(group.querySelector(':scope > ui-input-group-addon')).not.toBeNull();
    // The real nodes live one host-level deeper — exactly what the translated
    // `[&>*>input]` and `has-[[data-align=…]]` selectors target.
    const control = group.querySelector('[data-slot="input-group-control"]') as HTMLInputElement;
    expect(control.tagName).toBe('INPUT');
    expect(control.parentElement?.tagName.toLowerCase()).toBe('ui-input-group-input');
    const addon = group.querySelector('[data-slot="input-group-addon"]') as HTMLElement;
    expect(addon.getAttribute('data-align')).toBe('inline-start');
    expect(addon.parentElement?.tagName.toLowerCase()).toBe('ui-input-group-addon');
  });

  it('built-CSS class forms: translated descendant selectors present, dead child forms gone', () => {
    // Root: has-[textarea], has-[[data-align=…]], [&>*>input] — NOT the dead child forms.
    expect(inputGroupClasses).toContain('has-[textarea]:h-auto');
    expect(inputGroupClasses).toContain('has-[[data-align=inline-start]]:[&>*>input]:pl-2');
    expect(inputGroupClasses).toContain('has-[[data-align=block-start]]:flex-col');
    expect(inputGroupClasses).not.toContain('has-[>textarea]');
    expect(inputGroupClasses).not.toContain('has-[>[data-align');
    expect(inputGroupClasses).not.toContain('[&>input]');
    // The already-descendant control tokens are untouched.
    expect(inputGroupClasses).toContain('has-[[data-slot=input-group-control]:focus-visible]:border-ring');

    // Addon: has-[button]/has-[kbd]/[&_kbd]/group-has-[input] — NOT the child forms;
    // native `[&>svg]` icon token kept verbatim.
    const addon = inputGroupAddonVariants({ align: 'inline-start' });
    expect(addon).toContain('has-[button]:ml-[-0.45rem]');
    expect(addon).toContain('has-[kbd]:ml-[-0.35rem]');
    expect(addon).not.toContain('has-[>button]');
    expect(addon).not.toContain('has-[>kbd]');
    const base = inputGroupAddonVariants({ align: 'block-start' });
    expect(base).toContain('group-has-[input]/input-group:pt-2.5');
    expect(base).not.toContain('group-has-[>input]');
    expect(base).toContain('[&_kbd]:rounded-'); // kbd → descendant (covers ui-kbd + native)
    expect(base).toContain("[&>svg:not([class*='size-'])]:size-4"); // native svg kept
    expect(base).not.toContain('[&>kbd]');
  });
});
