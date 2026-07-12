/**
 * sections/install.ts — get started: install the framework, copy in the
 * components. Real, published commands (npm install @nisli/core; npx @nisli/ui
 * init / add) — no "coming soon" hedging.
 */
import { html, type TemplateResult } from '@nisli/core';

interface Step {
  n: number;
  title: string;
  body: string;
  code: string;
}

// The copied source lands at <dir>/ui/<name>.ts (default dir: src/nisli-ui) and
// composes as a typed factory inside an html`` template — the exact usage from
// the @nisli/ui README, so the shown import path and call are what `add` produces.
const importSnippet = `import { html } from '@nisli/core';
import { Button } from './nisli-ui/ui/button.js';

// your owned copy — edit it, it's yours
html\`\${Button({ variant: 'outline', children: 'Ship it' })}\`;`;

const STEPS: readonly Step[] = [
  {
    n: 1,
    title: 'Install the framework',
    body: 'nisli is the product — signals, components, DI, all in @nisli/core.',
    code: 'npm install @nisli/core',
  },
  {
    n: 2,
    title: 'Set up @nisli/ui',
    body: 'One-time init drops the token layer and config into your project.',
    code: 'npx @nisli/ui init',
  },
  {
    n: 3,
    title: 'Copy in the components you want',
    body: 'add copies real source into your repo — you own and edit it.',
    code: 'npx @nisli/ui add button dialog',
  },
];

export function install(): TemplateResult {
  return html`<section id="install" class="border-t border-border/60 bg-muted/20">
    <div class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-semibold tracking-tight text-balance">
          Install the framework, copy in the components
        </h2>
        <p class="mt-3 text-lg text-muted-foreground text-pretty">
          nisli = framework + design language + UI components, all in one. No
          registry account, no lock-in — the components become your source.
        </p>
      </div>

      <ol class="mt-10 grid gap-4 lg:grid-cols-3">
        ${STEPS.map(
          (step) => html`<li class="flex flex-col rounded-xl border bg-card p-6">
            <div class="flex items-center gap-3">
              <span
                class="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >${String(step.n)}</span
              >
              <h3 class="font-semibold tracking-tight">${step.title}</h3>
            </div>
            <p class="mt-2 text-sm text-muted-foreground text-pretty">${step.body}</p>
            <pre
              class="mt-4 overflow-x-auto rounded-lg border bg-background p-3 text-[13px]"
            ><code class="font-mono">${step.code}</code></pre>
          </li>`,
        )}
      </ol>

      <div class="mt-6">
        <p class="text-sm font-medium text-muted-foreground">Then import your copy and go:</p>
        <pre
          class="mt-3 overflow-x-auto rounded-xl border bg-card p-4 text-[13px] leading-relaxed"
        ><code class="font-mono">${importSnippet}</code></pre>
      </div>
    </div>
  </section>`;
}
