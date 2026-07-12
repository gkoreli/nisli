/**
 * hydrate-examples/scroll-area.ts — the scroll-area preview (WWW-14).
 * The styled thin scrollbar is injected into the document by the component at
 * RUNTIME (scroll-area.ts injects its stylesheet once on first mount), so a
 * static SSG preview never shows it. Living in the hydrate-set registers the
 * component and runs the injector, so the real scrollbar is exercised.
 */
import { html, type TemplateResult } from '@nisli/core';
import { ScrollArea } from '../nisli-ui/ui/scroll-area.js';

export default function scrollAreaExample(): TemplateResult {
  return html`${ScrollArea({
    className: 'h-56 w-56 rounded-md border',
    children: html`<div class="p-4">
      <h4 class="mb-3 text-sm font-medium leading-none">Tags</h4>
      ${[...Array(28).keys()].map(
        (i) => html`<div class="border-b py-2 text-sm">v0.3.0-beta.${String(i + 1)}</div>`,
      )}
    </div>`,
  })}`;
}
