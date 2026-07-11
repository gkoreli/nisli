/**
 * sections/framework.ts — the framework pitch: nisli's core primitives.
 * The framework beat of the home page (before the @nisli/ui second beat).
 */
import { html, type TemplateResult } from '@nisli/core';

interface Pillar {
  title: string;
  body: string;
}

const PILLARS: readonly Pillar[] = [
  {
    title: 'Signals',
    body: 'Fine-grained reactivity — signal(), computed(), effect(). No re-renders, no diffing; only what changed updates.',
  },
  {
    title: 'Tagged-template components',
    body: 'Author UI with the html`` tag. No JSX, no compiler, no build step — templates are just JavaScript.',
  },
  {
    title: 'Native custom elements',
    body: 'component() defines a real custom element. Interoperable everywhere, framework-agnostic, no runtime lock-in.',
  },
  {
    title: 'Dependency injection',
    body: 'provide() / inject() with typed tokens. Share services down the tree without prop-drilling or globals.',
  },
  {
    title: 'Declarative data',
    body: 'query() loads async data with caching and loading state, wired straight into the reactivity graph.',
  },
  {
    title: 'Static rendering',
    body: '@nisli/ssg renders components to static HTML — this very site is nisli, rendered to a static bundle.',
  },
];

export function framework(): TemplateResult {
  return html`<section id="framework" class="border-t border-border/60 bg-muted/20">
    <div class="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div class="max-w-2xl">
        <h2 class="text-3xl font-semibold tracking-tight text-balance">
          A framework, not a library of workarounds
        </h2>
        <p class="mt-3 text-lg text-muted-foreground text-pretty">
          Everything you need to build reactive interfaces on the web platform —
          compiled to nothing.
        </p>
      </div>
      <div class="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
        ${PILLARS.map(
          (p) => html`<div class="bg-card p-6">
            <h3 class="font-semibold tracking-tight">${p.title}</h3>
            <p class="mt-2 text-sm text-muted-foreground text-pretty">${p.body}</p>
          </div>`,
        )}
      </div>
    </div>
  </section>`;
}
