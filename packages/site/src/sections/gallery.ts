/**
 * sections/gallery.ts — live component gallery. (Stub — SITE-1/eng2 replaces this file.)
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button } from '../nisli-ui/ui/button.js';

export function gallery(): TemplateResult {
  return html`<section id="gallery" class="mx-auto max-w-5xl px-6 py-16">
    <h2 class="text-3xl font-semibold tracking-tight">Component gallery</h2>
    <p class="mt-2 text-muted-foreground">Every component below is rendered by @nisli/ssg from real @nisli/ui source.</p>
    <div class="mt-8 flex flex-wrap gap-3">
      ${Button({ children: 'Default' })}
      ${Button({ variant: 'outline', children: 'Outline' })}
      ${Button({ variant: 'destructive', children: 'Destructive' })}
    </div>
  </section>`;
}
