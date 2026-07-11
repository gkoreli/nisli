/**
 * sections/hero.ts — landing hero. (Stub — SITE-2/eng1 replaces this file.)
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button } from '../nisli-ui/ui/button.js';
import { Badge } from '../nisli-ui/ui/badge.js';

export function hero(): TemplateResult {
  return html`<section class="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
    ${Badge({ variant: 'outline', children: 'shadcn for nisli' })}
    <h1 class="mt-4 text-5xl font-bold tracking-tight">Own your components.</h1>
    <p class="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
      nisli is a reactive web-component framework — signals, tagged templates,
      DI, no build step. @nisli/ui is its component library, copied into your
      project as source you own.
    </p>
    <div class="mt-8 flex justify-center gap-3">
      ${Button({ size: 'lg', children: 'Get started' })}
      ${Button({ size: 'lg', variant: 'outline', children: 'GitHub' })}
    </div>
  </section>`;
}
