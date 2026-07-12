/**
 * hydrate-examples/collapsible.ts — the collapsible preview (WWW-15).
 *
 * Starts CLOSED (so the WWW-15 touch is a clean expand): hydrated, clicking
 * `[data-slot="collapsible-trigger"]` opens `[data-slot="collapsible-content"]`
 * (`data-state` closed→open). Per-file for code-splitting + auto-hydration.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../nisli-ui/ui/collapsible.js';

export default function collapsibleExample(): TemplateResult {
  return html`<div class="w-full max-w-sm">
    ${Collapsible({
      children: html`<div class="flex items-center justify-between gap-4">
        <span class="text-sm font-semibold">@nisli starred 3 repositories</span>
        ${CollapsibleTrigger({
          className: buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          children: '⌄',
        })}
      </div>
      ${CollapsibleContent({
        children: html`<div class="mt-2 grid gap-2">
          <div class="rounded-md border px-4 py-2 text-sm">@nisli/core</div>
          <div class="rounded-md border px-4 py-2 text-sm">@nisli/ui</div>
        </div>`,
      })}`,
    })}
  </div>`;
}
