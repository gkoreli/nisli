/**
 * pages/not-found.ts — the 404 page. Rendered by the AppRouter's notFound and
 * emitted to dist/404.html by @nisli/ssg.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';

export function notFoundPage(): TemplateResult {
  return html`<div class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
    <p class="text-sm font-medium text-muted-foreground">404</p>
    <h1 class="mt-2 text-4xl font-bold tracking-tight">Page not found</h1>
    <p class="mt-3 text-lg text-muted-foreground text-pretty">
      That route doesn’t exist. Check the URL, or head back to the framework.
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <a href="/" class="${buttonVariants({ size: 'lg' })}">Home</a>
      <a href="/docs" class="${buttonVariants({ size: 'lg', variant: 'outline' })}">Docs</a>
      <a href="/ui" class="${buttonVariants({ size: 'lg', variant: 'ghost' })}">Components</a>
    </div>
  </div>`;
}
