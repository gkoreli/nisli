/**
 * sections/hero.ts — the home hero. Framework-led: nisli (@nisli/core) is the
 * product; @nisli/ui is the batteries-included second beat.
 */
import { html, type TemplateResult } from '@nisli/core';
import { Badge } from '../nisli-ui/ui/badge.js';
import { buttonVariants } from '../nisli-ui/ui/button.js';

// Real nisli — a signal + a component + an html template. `\`` and `\${` are
// escaped so the sample text survives this template literal intact; it renders
// through a text binding (escaped) in <code> below.
const heroCode = `import { component, signal, html } from '@nisli/core';

const Counter = component('my-counter', () => {
  const count = signal(0);

  return html\`
    <button @click=\${() => count.value++}>
      count is \${count}
    </button>
  \`;
});`;

export function hero(): TemplateResult {
  return html`<section class="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-2 lg:pt-28 lg:pb-24">
    <div class="min-w-0">
      ${Badge({ variant: 'outline', children: 'The reactive web-component framework' })}
      <h1 class="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Reactive web components. No build step, no virtual DOM.
      </h1>
      <p class="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
        nisli is a reactive framework for the native platform — signals,
        tagged-template components, dependency injection, static rendering.
        Batteries included:
        <span class="text-foreground">@nisli/ui</span>, a shadcn-style component
        library you copy in and own.
      </p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="/docs" class="${buttonVariants({ size: 'lg' })}">Get started</a>
        <a href="/ui" class="${buttonVariants({ size: 'lg', variant: 'outline' })}"
          >Browse components</a
        >
        <a
          href="https://github.com/gkoreli/nisli"
          class="${buttonVariants({ size: 'lg', variant: 'ghost' })}"
          >GitHub</a
        >
      </div>
    </div>
    <div class="relative min-w-0">
      <div
        class="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm"
      >
        <div class="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-3">
          <span class="h-3 w-3 rounded-full bg-muted-foreground/25"></span>
          <span class="h-3 w-3 rounded-full bg-muted-foreground/25"></span>
          <span class="h-3 w-3 rounded-full bg-muted-foreground/25"></span>
          <span class="ml-2 text-xs text-muted-foreground">counter.ts</span>
        </div>
        <pre
          class="overflow-x-auto p-4 text-[13px] leading-relaxed"
        ><code class="font-mono">${heroCode}</code></pre>
      </div>
    </div>
  </section>`;
}
