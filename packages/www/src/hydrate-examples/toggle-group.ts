/**
 * hydrate-examples/toggle-group.ts — the toggle-group preview (WWW-15).
 *
 * Single-select alignment group (Center pre-selected). Hydrated, clicking a
 * NOT-selected `[data-slot="toggle-group-item"]` (Left/Right) flips it
 * `aria-pressed="true"`. Per-file for code-splitting + auto-hydration.
 */
import { html, type TemplateResult } from '@nisli/core';
import { ToggleGroup, ToggleGroupItem } from '../nisli-ui/ui/toggle-group.js';

export default function toggleGroupExample(): TemplateResult {
  return html`${ToggleGroup({
    type: 'single',
    variant: 'outline',
    defaultValue: 'center',
    children: html`${ToggleGroupItem({ value: 'left', children: 'Left' })}
    ${ToggleGroupItem({ value: 'center', children: 'Center' })}
    ${ToggleGroupItem({ value: 'right', children: 'Right' })}`,
  })}`;
}
