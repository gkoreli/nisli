/**
 * sections/install.ts — copy-in install flow. (Stub — SITE-2/eng1 replaces this file.)
 */
import { html, type TemplateResult } from '@nisli/core';

export function install(): TemplateResult {
  return html`<section id="install" class="mx-auto max-w-4xl px-6 py-16">
    <h2 class="text-3xl font-semibold tracking-tight">Install by owning</h2>
    <pre class="mt-6 overflow-x-auto rounded-lg border bg-muted p-4 text-sm"><code>npx @nisli/ui init
npx @nisli/ui add button</code></pre>
  </section>`;
}
