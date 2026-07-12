/**
 * combobox.test.ts — Combobox (Popover + Command composition), selection.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal, flush, flushEffects, html, type TemplateResult } from '@nisli/core';
import { Combobox, ComboboxItem } from './combobox.js';

beforeEach(async () => {
  document.body.innerHTML = '';
  // Flush deferred disconnect teardown (ADR 0023) from the previous test's
  // popover dismissable-layer/focus-trap.
  await Promise.resolve();
  await Promise.resolve();
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

function mountCombobox(props: Record<string, unknown> = {}): HTMLElement {
  return mount(
    html`${Combobox({
      placeholder: 'Select framework…',
      ...props,
      children: html`${ComboboxItem({ value: 'next', children: 'Next.js' })}
      ${ComboboxItem({ value: 'svelte', children: 'SvelteKit' })}
      ${ComboboxItem({ value: 'astro', children: 'Astro' })}`,
    })}`,
  );
}

const q = (root: ParentNode, sel: string) => root.querySelector<HTMLElement>(sel)!;
const trigger = (r: ParentNode) => q(r, '[data-slot="popover-trigger"]');
const content = (_r: ParentNode) => q(document, '[data-slot="popover-content"]');
const items = (_r: ParentNode): [HTMLElement, HTMLElement, HTMLElement, ...HTMLElement[]] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-slot="command-item"]')) as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
    ...HTMLElement[],
  ];
function flush2(): void {
  flush();
}
function open(r: ParentNode): void {
  trigger(r).click();
  flush2();
}

describe('Combobox — structure', () => {
  it('renders a combobox trigger with the placeholder, popup closed', () => {
    const c = mountCombobox();
    const t = trigger(c);
    expect(t.getAttribute('role')).toBe('combobox');
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(t.textContent).toContain('Select framework…');
    expect(content(c).hasAttribute('hidden')).toBe(true);
    // The command listbox + options exist even while closed.
    expect(items(c)).toHaveLength(3);
  });

  it('hosts are layout-transparent', () => {
    const c = mountCombobox();
    expect((c.querySelector('ui-combobox') as HTMLElement).style.display).toBe('contents');
  });
});

describe('Combobox — single selection', () => {
  it('opens on trigger click', () => {
    const c = mountCombobox();
    open(c);
    expect(content(c).hasAttribute('hidden')).toBe(false);
    expect(trigger(c).getAttribute('aria-expanded')).toBe('true');
  });

  it('selects an option: updates label, closes, marks it, emits', () => {
    const c = mountCombobox();
    const onChange = vi.fn();
    (c.querySelector('ui-combobox') as HTMLElement).addEventListener('ui-value-change', (e) =>
      onChange((e as CustomEvent).detail),
    );
    open(c);

    const svelte = items(c).find((el) => el.getAttribute('data-value') === 'svelte')!;
    svelte.click();
    flush2();

    expect(trigger(c).textContent).toContain('SvelteKit');
    expect(content(c).hasAttribute('hidden')).toBe(true); // single-select closes
    expect(svelte.getAttribute('aria-selected')).toBe('true');
    expect(onChange).toHaveBeenCalledWith({ value: 'svelte' });
  });

  it('preselects from defaultValue', async () => {
    const c = mountCombobox({ defaultValue: 'astro' });
    // The initial label resolves from the projected options a microtask later.
    await Promise.resolve();
    flush2();
    expect(trigger(c).textContent).toContain('Astro');
  });
});

describe('Combobox — multiple selection', () => {
  it('toggles values, shows a count, and stays open', () => {
    const c = mountCombobox({ multiple: true });
    open(c);
    const [next, svelte] = items(c);

    next.click();
    flush2();
    expect(trigger(c).textContent).toContain('1 selected');
    expect(content(c).hasAttribute('hidden')).toBe(false); // multiple stays open

    svelte.click();
    flush2();
    expect(trigger(c).textContent).toContain('2 selected');

    next.click(); // toggle off
    flush2();
    expect(trigger(c).textContent).toContain('1 selected');
    expect(next.getAttribute('aria-selected')).toBe('false');
  });

  it('emits an array on change', () => {
    const c = mountCombobox({ multiple: true });
    const onChange = vi.fn();
    (c.querySelector('ui-combobox') as HTMLElement).addEventListener('ui-value-change', (e) =>
      onChange((e as CustomEvent).detail),
    );
    open(c);
    items(c)[0].click();
    flush2();
    expect(onChange).toHaveBeenCalledWith({ value: ['next'] });
  });
});

describe('Combobox — filtering', () => {
  it('filters options as you type in the command input', () => {
    const c = mountCombobox();
    open(c);
    const input = q(document, '[data-slot="command-input"]') as HTMLInputElement;
    input.value = 'sv';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flush2();

    const visible = items(c).filter((el) => !el.hasAttribute('hidden'));
    expect(visible).toHaveLength(1);
    expect(visible[0]!.getAttribute('data-value')).toBe('svelte');
  });
});

describe('Combobox — portal regressions (UI-40)', () => {
  it('portals by default and command filtering still finds moved items', () => {
    const c = mountCombobox();
    const popup = content(c);
    expect(popup.parentElement).toBe(document.body);
    expect(c.contains(popup)).toBe(false);

    open(c);
    const input = q(document, '[data-slot="command-input"]') as HTMLInputElement;
    input.value = 'sv';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flush2();
    expect(items(c).filter((el) => !el.hasAttribute('hidden')).map((el) => el.dataset.value))
      .toEqual(['svelte']);
  });

  it('preserves trigger aria-controls across the body move', () => {
    const c = mountCombobox();
    const popup = content(c);
    expect(trigger(c).getAttribute('aria-controls')).toBe(popup.id);
    expect(document.getElementById(popup.id)).toBe(popup);
  });

  it('keeps command aria-activedescendant valid inside the portaled popup', async () => {
    const c = mountCombobox();
    await Promise.resolve();
    await Promise.resolve();
    const field = q(document, '[data-slot="command-input"]');
    const activeId = field.getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    const active = document.getElementById(activeId!);
    expect(active?.getAttribute('data-slot')).toBe('command-item');
    expect(c.contains(active)).toBe(false);

    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    flush2();
    const nextId = field.getAttribute('aria-activedescendant');
    expect(nextId).toBeTruthy();
    expect(nextId).not.toBe(activeId);
    expect(document.getElementById(nextId!)).not.toBeNull();
  });

  it('treats pointerdown inside portaled content as inside, then selects normally', () => {
    const c = mountCombobox({ multiple: true });
    const onChange = vi.fn();
    c.querySelector('ui-combobox')!.addEventListener('ui-value-change', (event) =>
      onChange((event as CustomEvent).detail),
    );
    open(c);
    const item = items(c)[0];
    item.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    flush2();
    expect(content(c).hasAttribute('hidden')).toBe(false);
    item.click();
    flush2();
    expect(onChange).toHaveBeenCalledWith({ value: ['next'] });
    expect(content(c).hasAttribute('hidden')).toBe(false);
  });

  it('dispatches selection on the captured combobox host, independent of DOM ancestry', () => {
    const c = mountCombobox();
    const host = c.querySelector('ui-combobox')!;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', (event) =>
      onChange((event as CustomEvent).detail),
    );
    open(c);
    expect(host.contains(items(c)[1])).toBe(false);
    items(c)[1].click();
    flush2();
    expect(onChange).toHaveBeenCalledWith({ value: 'svelte' });
  });

  it('retracks item value signals registered after the parent effect starts', async () => {
    const itemValue = signal<string | undefined>('next');
    const c = mount(
      html`${Combobox({
        defaultValue: 'next',
        children: ComboboxItem({ value: itemValue as unknown as string, children: 'Next.js' }),
      })}`,
    );
    await Promise.resolve();
    flush2();
    expect(trigger(c).textContent).toContain('Next.js');
    itemValue.value = 'renamed';
    flush2();
    // The selected value is still "next", but no registered item now owns it;
    // labelFor correctly falls back to the raw value instead of staying stale.
    expect(trigger(c).textContent).toContain('next');
    expect(trigger(c).textContent).not.toContain('Next.js');
  });

  it('invalidates label lookup when a registered item is removed', async () => {
    const c = mountCombobox({ defaultValue: 'next' });
    await Promise.resolve();
    flush2();
    expect(trigger(c).textContent).toContain('Next.js');
    document.querySelector('ui-combobox-item')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    flush2();
    expect(trigger(c).textContent).toContain('next');
    expect(trigger(c).textContent).not.toContain('Next.js');
  });

  it('portal={false} keeps the composed popup inline', () => {
    const c = mountCombobox({ portal: false });
    expect(c.contains(content(c))).toBe(true);
  });

  it('honours portal="false" in plain HTML', async () => {
    document.body.innerHTML =
      '<ui-combobox portal="false"><ui-combobox-item value="one">One</ui-combobox-item>' +
      '</ui-combobox>';
    await Promise.resolve();
    await Promise.resolve();
    const host = document.querySelector('ui-combobox')!;
    expect(host.contains(q(host, '[data-slot="popover-content"]'))).toBe(true);
  });

  it('removes the portaled popup on combobox teardown', async () => {
    const c = mountCombobox();
    c.querySelector('ui-combobox')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });
});

describe('Combobox — value-root regression matrix, single (UI-30 3A)', () => {
  const byValue = (_root: ParentNode, v: string) =>
    document.querySelector<HTMLElement>(`[data-slot="command-item"][data-value="${v}"]`)!;

  it('BARE-PARSE: authored value="svelte" selects at connect; component-path click reflects the new value attr', async () => {
    document.body.innerHTML =
      '<ui-combobox value="svelte">' +
      '<ui-combobox-item value="next">Next.js</ui-combobox-item>' +
      '<ui-combobox-item value="svelte">SvelteKit</ui-combobox-item>' +
      '<ui-combobox-item value="astro">Astro</ui-combobox-item>' +
      '</ui-combobox>';
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-combobox')!;
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'astro').getAttribute('aria-selected')).toBe('false');

    // Change via the REAL COMPONENT PATH (open + click a different option).
    trigger(host).click();
    flush2();
    byValue(host, 'astro').click();
    flush2();
    expect(byValue(host, 'astro').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('false');
    expect(host.getAttribute('value')).toBe('astro'); // ROOT attr reflects the new single value
  });

  it('CONTROLLED: component-path click fires ui-value-change but the guard preserves the pinned attr; parent signal drives selection', () => {
    const value = signal<string | undefined>('svelte');
    const c = mountCombobox({ value });
    const host = c.querySelector('ui-combobox') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', (e) => onChange((e as CustomEvent).detail));
    flush2();
    expect(host.getAttribute('value')).toBe('svelte'); // reflect effect mirrors the pinned signal
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true');

    open(c);
    byValue(host, 'astro').click(); // select('astro') → setValue guarded (controlled)
    flush2();
    expect(onChange).toHaveBeenCalledWith({ value: 'astro' });
    expect(host.getAttribute('value')).toBe('svelte'); // guard held
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true'); // unchanged

    value.value = 'astro';
    flush2();
    expect(host.getAttribute('value')).toBe('astro');
    expect(byValue(host, 'astro').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('false');
  });
});

describe('Combobox — value-root regression matrix, multiple (UI-30 3A + finding 4 comma-authoring)', () => {
  const byValue = (_root: ParentNode, v: string) =>
    document.querySelector<HTMLElement>(`[data-slot="command-item"][data-value="${v}"]`)!;

  it('BARE-PARSE: literal `<ui-combobox multiple value="next,svelte">` selects both at connect; component-path toggle-off reflects the comma-joined remainder', async () => {
    document.body.innerHTML =
      '<ui-combobox multiple value="next,svelte">' +
      '<ui-combobox-item value="next">Next.js</ui-combobox-item>' +
      '<ui-combobox-item value="svelte">SvelteKit</ui-combobox-item>' +
      '<ui-combobox-item value="astro">Astro</ui-combobox-item>' +
      '</ui-combobox>';
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const host = document.querySelector('ui-combobox')!;
    // Comma-authored `value="next,svelte"` selects BOTH at parse.
    expect(byValue(host, 'next').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'astro').getAttribute('aria-selected')).toBe('false');

    // Component-path toggle ONE off → the reflected host attr is the remainder.
    trigger(host).click();
    flush2();
    byValue(host, 'next').click();
    flush2();
    expect(byValue(host, 'next').getAttribute('aria-selected')).toBe('false');
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true');
    expect(host.getAttribute('value')).toBe('svelte'); // comma-joined remainder
  });

  it('CONTROLLED: component-path click fires the array detail but the guard preserves the pinned attr; parent signal drives selection', () => {
    const value = signal<string[] | undefined>(['next']);
    const c = mountCombobox({ multiple: true, value });
    const host = c.querySelector('ui-combobox') as HTMLElement;
    const onChange = vi.fn();
    host.addEventListener('ui-value-change', (e) => onChange((e as CustomEvent).detail));
    flush2();
    expect(host.getAttribute('value')).toBe('next');
    expect(byValue(host, 'next').getAttribute('aria-selected')).toBe('true');

    open(c);
    byValue(host, 'svelte').click(); // select('svelte') → setValue(['next','svelte']), guarded
    flush2();
    expect(onChange).toHaveBeenCalledWith({ value: ['next', 'svelte'] });
    expect(host.getAttribute('value')).toBe('next'); // guard held
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('false'); // unchanged

    value.value = ['next', 'svelte'];
    flush2();
    expect(host.getAttribute('value')).toBe('next,svelte'); // comma-joined via reflect effect
    expect(byValue(host, 'next').getAttribute('aria-selected')).toBe('true');
    expect(byValue(host, 'svelte').getAttribute('aria-selected')).toBe('true');
  });
});

describe('Combobox — misuse', () => {
  it('renders the setup error boundary for an item outside a combobox', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = mount(html`${ComboboxItem({ value: 'x', children: 'x' })}`);
    expect(c.querySelector('[data-slot="command-item"]')).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
