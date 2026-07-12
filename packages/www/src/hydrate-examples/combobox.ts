import { html, type TemplateResult } from '@nisli/core';
import { Combobox, ComboboxItem } from '../nisli-ui/ui/combobox.js';

export default function comboboxExample(): TemplateResult {
  return html`${Combobox({
    placeholder: 'Select framework…',
    searchPlaceholder: 'Search framework…',
    emptyText: 'No framework found.',
    children: html`${ComboboxItem({ value: 'next', children: 'Next.js' })}
    ${ComboboxItem({ value: 'sveltekit', children: 'SvelteKit' })}
    ${ComboboxItem({ value: 'astro', children: 'Astro' })}
    ${ComboboxItem({ value: 'remix', children: 'Remix' })}`,
  })}`;
}
