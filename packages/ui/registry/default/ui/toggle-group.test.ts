/**
 * toggle-group.test.ts — ToggleGroup single/multiple selection + roving.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushEffects, html, type TemplateResult } from '@nisli/core';
import { ToggleGroup, ToggleGroupItem } from './toggle-group.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountGroup(props: Record<string, unknown> = {}): HTMLElement {
  return mount(
    html`${ToggleGroup({
      ...props,
      children: html`${ToggleGroupItem({ value: 'bold', children: 'B' })}
      ${ToggleGroupItem({ value: 'italic', children: 'I' })}
      ${ToggleGroupItem({ value: 'underline', children: 'U' })}`,
    })}`,
  );
}

function states(c: ParentNode): string[] {
  return [...c.querySelectorAll('[data-slot="toggle-group-item"]')].map(
    (el) => el.getAttribute('data-state') ?? '',
  );
}

function item(c: ParentNode, i: number): HTMLButtonElement {
  return c.querySelectorAll<HTMLButtonElement>('[data-slot="toggle-group-item"]')[i]!;
}

describe('ToggleGroup single', () => {
  it('keeps at most one item pressed and dispatches ui-value-change', () => {
    const onChange = vi.fn();
    const c = mountGroup({});
    c.querySelector('[data-slot="toggle-group"]')!.parentElement!.addEventListener(
      'ui-value-change',
      onChange,
    );

    item(c, 0).click();
    flushEffects();
    expect(states(c)).toEqual(['on', 'off', 'off']);

    item(c, 1).click();
    flushEffects();
    expect(states(c)).toEqual(['off', 'on', 'off']);
    expect(onChange.mock.calls[1]?.[0].detail).toEqual({ value: 'italic' });

    item(c, 1).click(); // toggles off
    flushEffects();
    expect(states(c)).toEqual(['off', 'off', 'off']);
    expect(onChange.mock.calls[2]?.[0].detail).toEqual({ value: '' });
  });
});

describe('ToggleGroup multiple', () => {
  it('allows several pressed items and emits the array value', () => {
    const onChange = vi.fn();
    const c = mountGroup({ type: 'multiple' });
    document.body.addEventListener('ui-value-change', onChange);

    item(c, 0).click();
    item(c, 2).click();
    flushEffects();
    expect(states(c)).toEqual(['on', 'off', 'on']);
    expect(onChange.mock.calls[1]?.[0].detail).toEqual({ value: ['bold', 'underline'] });

    item(c, 0).click();
    flushEffects();
    expect(states(c)).toEqual(['off', 'off', 'on']);
  });
});

describe('ToggleGroup rendering', () => {
  it('carries group data attributes and forwards variant/size to items', () => {
    const c = mountGroup({ variant: 'outline', size: 'sm', defaultValue: 'bold' });
    const group = c.querySelector('[data-slot="toggle-group"]') as HTMLElement;

    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('data-variant')).toBe('outline');
    expect(group.getAttribute('data-spacing')).toBe('0');
    expect(states(c)).toEqual(['on', 'off', 'off']);
    expect(item(c, 0).className).toContain('border-input'); // outline via context
    expect(item(c, 0).className).toContain('min-w-0');
  });

  it('roves focus with arrow keys', () => {
    const c = mountGroup({});
    const group = c.querySelector('[data-slot="toggle-group"]') as HTMLElement;
    item(c, 0).focus();

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(item(c, 1));
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(item(c, 2));
  });

  it('errors items used outside a group (setup boundary)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-toggle-group-item');
    document.body.appendChild(host);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
