/**
 * hydrate-examples/accordion.ts — the accordion preview (WWW-15).
 *
 * Static in SSG (resting: all items collapsed); once hydrated, tapping a trigger
 * expands its content (`data-state="open"`, `aria-expanded="true"`) — the touch
 * the WWW-15 guard asserts. Per-file so the client runtime code-splits it and
 * `hydrate-set.ts` auto-includes `accordion` in the hydration set.
 */
import { html, type TemplateResult } from '@nisli/core';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../nisli-ui/ui/accordion.js';

export default function accordionExample(): TemplateResult {
  return html`<div class="w-full max-w-md">
    ${Accordion({
      type: 'single',
      collapsible: true,
      children: html`${AccordionItem({
        value: 'a11y',
        children: html`${AccordionTrigger({ children: 'Is it accessible?' })}
        ${AccordionContent({
          children: 'Yes. It follows the WAI-ARIA accordion pattern.',
        })}`,
      })}
      ${AccordionItem({
        value: 'own',
        children: html`${AccordionTrigger({ children: 'Do I own the code?' })}
        ${AccordionContent({
          children: 'Yes. nisli-ui add copies the source into your project.',
        })}`,
      })}`,
    })}
  </div>`;
}
