/**
 * hydrate-examples/toggle.ts — the toggle preview (WWW-15).
 *
 * Three toggles (Bold pressed, Italic + list not). Hydrated, clicking a NOT-
 * pressed `[data-slot="toggle"]` flips it `aria-pressed="true"` / `data-state=
 * "on"`. Per-file for code-splitting + auto-hydration.
 */
import { html, type TemplateResult } from '@nisli/core';
import { Toggle } from '../nisli-ui/ui/toggle.js';

export default function toggleExample(): TemplateResult {
  return html`<div class="flex items-center gap-2">
    ${Toggle({
      pressed: true,
      children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>`,
    })}
    ${Toggle({
      variant: 'outline',
      children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" /></svg>`,
    })}
    ${Toggle({
      children: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg> Aa`,
    })}
  </div>`;
}
