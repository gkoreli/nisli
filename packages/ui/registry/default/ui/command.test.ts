/**
 * command.test.ts — command palette filtering, highlight, and selection.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { html, type TemplateResult } from '@nisli/core';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './command.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  return container;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function mountPalette(): HTMLElement {
  return mount(
    html`${Command({
      children: html`${CommandInput({ placeholder: 'Type a command…' })}
      ${CommandList({
        children: html`${CommandEmpty({ children: 'No results found.' })}
        ${CommandGroup({
          heading: 'Suggestions',
          children: html`${CommandItem({ value: 'calendar', children: 'Calendar' })}
          ${CommandItem({ value: 'search-emoji', keywords: 'smiley', children: 'Search Emoji' })}`,
        })}
        ${CommandGroup({
          heading: 'Settings',
          children: html`${CommandItem({ value: 'profile', children: 'Profile' })}
          ${CommandItem({ value: 'billing', disabled: true, children: 'Billing' })}`,
        })}`,
      })}`,
    })}`,
  );
}

const input = (c: ParentNode): HTMLInputElement =>
  c.querySelector('[data-slot="command-input"]') as HTMLInputElement;
const visibleValues = (c: ParentNode): string[] =>
  [...c.querySelectorAll('[data-slot="command-item"]:not([hidden])')].map(
    (el) => el.getAttribute('data-value') ?? '',
  );
const selectedValue = (c: ParentNode): string | undefined =>
  c.querySelector('[data-slot="command-item"][data-selected="true"]')?.getAttribute('data-value') ?? undefined;

function type(c: ParentNode, text: string): void {
  const el = input(c);
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(c: ParentNode, k: string): void {
  (c.querySelector('[data-slot="command"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true }),
  );
}

describe('Command palette', () => {
  it('shows everything initially with the first enabled item highlighted', async () => {
    const c = mountPalette();
    await settle();

    expect(visibleValues(c)).toEqual(['calendar', 'search-emoji', 'profile', 'billing']);
    expect(selectedValue(c)).toBe('calendar');
    expect(
      (c.querySelector('[data-slot="command-empty"]') as HTMLElement).hasAttribute('hidden'),
    ).toBe(true);
  });

  it('filters by value, text, and keywords; hides empty groups', async () => {
    const c = mountPalette();
    await settle();

    type(c, 'prof');
    expect(visibleValues(c)).toEqual(['profile']);
    const groups = c.querySelectorAll('[data-slot="command-group"]');
    expect((groups[0] as HTMLElement).hasAttribute('hidden')).toBe(true); // Suggestions emptied
    expect((groups[1] as HTMLElement).hasAttribute('hidden')).toBe(false);

    type(c, 'smiley'); // keyword match
    expect(visibleValues(c)).toEqual(['search-emoji']);
  });

  it('shows the empty state when nothing matches', async () => {
    const c = mountPalette();
    await settle();
    type(c, 'zzz');

    expect(visibleValues(c)).toEqual([]);
    expect(
      (c.querySelector('[data-slot="command-empty"]') as HTMLElement).hasAttribute('hidden'),
    ).toBe(false);
  });

  it('moves highlight with arrows, skipping disabled items, and selects with Enter', async () => {
    const c = mountPalette();
    await settle();
    const onSelect = vi.fn();
    document.body.addEventListener('ui-select', onSelect as EventListener);

    key(c, 'ArrowDown');
    expect(selectedValue(c)).toBe('search-emoji');
    key(c, 'ArrowDown');
    expect(selectedValue(c)).toBe('profile');
    key(c, 'ArrowDown'); // billing is disabled — stays on profile
    expect(selectedValue(c)).toBe('profile');

    key(c, 'Enter');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect((onSelect.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ value: 'profile' });
  });

  it('re-clamps the highlight when filtering removes it', async () => {
    const c = mountPalette();
    await settle();
    key(c, 'End');
    expect(selectedValue(c)).toBe('profile');

    type(c, 'cal');
    expect(selectedValue(c)).toBe('calendar');
  });

  it('highlights on pointerenter and selects on click', async () => {
    const c = mountPalette();
    await settle();
    const onSelect = vi.fn();
    document.body.addEventListener('ui-select', onSelect as EventListener);

    const items = c.querySelectorAll<HTMLElement>('[data-slot="command-item"]');
    items[1]?.dispatchEvent(new Event('pointerenter', { bubbles: false }));
    expect(selectedValue(c)).toBe('search-emoji');

    items[1]?.click();
    expect((onSelect.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ value: 'search-emoji' });
  });

  it('renders cmdk marker attributes for upstream selector classes', async () => {
    const c = mountPalette();
    await settle();
    expect(c.querySelector('[cmdk-item]')).not.toBeNull();
    expect(c.querySelector('[cmdk-group]')).not.toBeNull();
    expect(c.querySelector('[cmdk-group-heading]')?.textContent).toBe('Suggestions');
    expect(c.querySelector('[cmdk-input]')).not.toBeNull();
  });
});
