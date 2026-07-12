/**
 * toggle-group.test.ts — ToggleGroup single/multiple selection + roving.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal, flushEffects, html, type TemplateResult } from '@nisli/core';
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

  it('BARE-PARSE single: authored value="italic" presses at connect; component-path click reflects the new value attr', async () => {
    document.body.innerHTML =
      '<ui-toggle-group type="single" value="italic">' +
      '<ui-toggle-group-item value="bold">B</ui-toggle-group-item>' +
      '<ui-toggle-group-item value="italic">I</ui-toggle-group-item>' +
      '<ui-toggle-group-item value="underline">U</ui-toggle-group-item>' +
      '</ui-toggle-group>';
    await Promise.resolve();
    await Promise.resolve();

    const group = document.querySelector('ui-toggle-group')!;
    expect(states(group)).toEqual(['off', 'on', 'off']);

    item(group, 0).click(); // component-path select 'bold'
    flushEffects();
    flushEffects();
    expect(states(group)).toEqual(['on', 'off', 'off']);
    expect(group.getAttribute('value')).toBe('bold'); // ROOT attr reflects the new single value
  });

  it('CONTROLLED single: component-path click fires ui-value-change but the guard preserves the pinned attr; parent signal drives selection', () => {
    const value = signal<string | undefined>('bold');
    const c = mountGroup({ type: 'single', value });
    const host = c.querySelector('ui-toggle-group')!.parentElement as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', onChange as EventListener);
    flushEffects();
    const groupHost = c.querySelector('ui-toggle-group') as HTMLElement;
    expect(groupHost.getAttribute('value')).toBe('bold'); // reflect effect mirrors the pinned signal
    expect(states(c)).toEqual(['on', 'off', 'off']);

    item(c, 1).click(); // toggleValue('italic') → setValue, guarded (controlled)
    flushEffects();
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: 'italic' });
    expect(groupHost.getAttribute('value')).toBe('bold'); // guard held
    expect(states(c)).toEqual(['on', 'off', 'off']); // selection unchanged

    value.value = 'italic';
    flushEffects();
    flushEffects();
    expect(groupHost.getAttribute('value')).toBe('italic');
    expect(states(c)).toEqual(['off', 'on', 'off']);
  });

  it('BARE-PARSE multiple: authored value="bold,italic" presses both at connect; component-path toggle-off reflects the comma-joined remainder', async () => {
    document.body.innerHTML =
      '<ui-toggle-group type="multiple" value="bold,italic">' +
      '<ui-toggle-group-item value="bold">B</ui-toggle-group-item>' +
      '<ui-toggle-group-item value="italic">I</ui-toggle-group-item>' +
      '<ui-toggle-group-item value="underline">U</ui-toggle-group-item>' +
      '</ui-toggle-group>';
    await Promise.resolve();
    await Promise.resolve();

    const group = document.querySelector('ui-toggle-group')!;
    expect(states(group)).toEqual(['on', 'on', 'off']);

    item(group, 0).click(); // toggle 'bold' off
    flushEffects();
    flushEffects();
    expect(states(group)).toEqual(['off', 'on', 'off']);
    expect(group.getAttribute('value')).toBe('italic'); // comma-joined remainder
  });

  it('CONTROLLED multiple: component-path click fires the array detail but the guard preserves the pinned attr; parent signal drives selection', () => {
    const value = signal<string[] | undefined>(['bold']);
    const c = mountGroup({ type: 'multiple', value });
    const groupHost = c.querySelector('ui-toggle-group') as HTMLElement;
    const onChange = vi.fn();
    groupHost.parentElement!.addEventListener('ui-value-change', onChange as EventListener);
    flushEffects();
    expect(groupHost.getAttribute('value')).toBe('bold');
    expect(states(c)).toEqual(['on', 'off', 'off']);

    item(c, 1).click(); // toggleValue('italic') → setValue(['bold','italic']), guarded
    flushEffects();
    expect(onChange.mock.calls[0]?.[0].detail).toEqual({ value: ['bold', 'italic'] });
    expect(groupHost.getAttribute('value')).toBe('bold'); // guard held
    expect(states(c)).toEqual(['on', 'off', 'off']); // selection unchanged

    value.value = ['bold', 'italic'];
    flushEffects();
    flushEffects();
    expect(groupHost.getAttribute('value')).toBe('bold,italic'); // comma-joined via reflect effect
    expect(states(c)).toEqual(['on', 'on', 'off']);
  });

  it('errors items used outside a group (setup boundary)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('ui-toggle-group-item');
    document.body.appendChild(host);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ToggleGroup parity (UI-36B)', () => {
  it('group-level disabled disables every item and blocks toggling', () => {
    const c = mountGroup({ disabled: true });
    expect([...c.querySelectorAll('button')].every((b) => b.hasAttribute('disabled'))).toBe(true);

    item(c, 0).click();
    flushEffects();
    expect(states(c)).toEqual(['off', 'off', 'off']);
  });

  it('group disabled works as a live attribute', () => {
    const c = mountGroup({});
    const groupHost = c.querySelector('ui-toggle-group') as HTMLElement;
    expect(item(c, 0).hasAttribute('disabled')).toBe(false);

    groupHost.setAttribute('disabled', '');
    flushEffects();
    expect([...c.querySelectorAll('button')].every((b) => b.hasAttribute('disabled'))).toBe(true);

    groupHost.setAttribute('disabled', 'false');
    flushEffects();
    expect(item(c, 0).hasAttribute('disabled')).toBe(false);
  });

  it('omits data-variant/data-size when unset (upstream DOM contract)', () => {
    const c = mountGroup({});
    const root = c.querySelector('[data-slot="toggle-group"]')!;
    expect(root.hasAttribute('data-variant')).toBe(false);
    expect(root.hasAttribute('data-size')).toBe(false);
    expect(item(c, 0).hasAttribute('data-variant')).toBe(false);
    expect(item(c, 0).hasAttribute('data-size')).toBe(false);
  });

  it('per-item variant applies when the group sets none, and the group wins when set', () => {
    // Item-level variant honored.
    const c1 = mount(
      html`${ToggleGroup({
        children: html`${ToggleGroupItem({ value: 'a', variant: 'outline', children: 'A' })}`,
      })}`,
    );
    const i1 = c1.querySelector<HTMLButtonElement>('[data-slot="toggle-group-item"]')!;
    expect(i1.getAttribute('data-variant')).toBe('outline');
    expect(i1.className).toContain('border-input');

    // Group variant overrides the item's own (upstream `context.variant || variant`).
    const c2 = mount(
      html`${ToggleGroup({
        variant: 'outline',
        children: html`${ToggleGroupItem({ value: 'a', variant: 'default', children: 'A' })}`,
      })}`,
    );
    const i2 = c2.querySelector<HTMLButtonElement>('[data-slot="toggle-group-item"]')!;
    expect(i2.getAttribute('data-variant')).toBe('outline');
    expect(i2.className).toContain('border-input');
  });
});

describe('ToggleGroupItem — aria-invalid forwarding', () => {
  it('forwards the item factory prop, while the root has no invalid-state fan-out', () => {
    const c = mount(html`${ToggleGroup({
      children: html`${ToggleGroupItem({ value: 'a', ariaInvalid: true, children: 'A' })}${ToggleGroupItem({ value: 'b', children: 'B' })}`,
    })}`);
    expect(item(c, 0).getAttribute('aria-invalid')).toBe('true');
    expect(item(c, 1).getAttribute('aria-invalid')).toBeNull();

    const groupHost = c.querySelector('ui-toggle-group') as HTMLElement;
    groupHost.setAttribute('aria-invalid', 'true');
    flushEffects();
    expect(item(c, 1).getAttribute('aria-invalid')).toBeNull();
  });

  it('reacts to live item-host aria-invalid changes', () => {
    const c = mountGroup();
    const host = c.querySelector('ui-toggle-group-item') as HTMLElement;
    const button = item(c, 0);
    host.setAttribute('aria-invalid', 'true');
    flushEffects();
    expect(button.getAttribute('aria-invalid')).toBe('true');
    host.setAttribute('aria-invalid', 'false');
    flushEffects();
    expect(button.getAttribute('aria-invalid')).toBeNull();
  });
});
