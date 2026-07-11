/**
 * sections/framework.ts — nisli framework pitch. (Stub — SITE-2/eng1 replaces this file.)
 */
import { html, type TemplateResult } from '@nisli/core';

export function framework(): TemplateResult {
  return html`<section id="framework" class="mx-auto max-w-4xl px-6 py-16">
    <h2 class="text-3xl font-semibold tracking-tight">The nisli framework</h2>
    <p class="mt-2 text-muted-foreground">Signals, tagged templates, dependency injection — compiled to nothing.</p>
  </section>`;
}
