/**
 * pages/ui-index.ts — the component gallery index.
 * Registry-driven: the grids below are enumerated from the registry (see
 * src/registry.ts), so a new registry item appears here with no edit.
 */
import { html, type TemplateResult } from '@nisli/core';
import { components, primitives, itemPath, type RegistryItem } from '../registry.js';

function ItemCard(item: RegistryItem): TemplateResult {
  return html`<a
    href="${itemPath(item.name)}"
    class="group flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-foreground/30 hover:bg-accent/40"
  >
    <div class="flex items-center justify-between">
      <span class="font-medium tracking-tight">${item.name}</span>
      <span class="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
    </div>
    ${item.description
      ? html`<p class="mt-2 line-clamp-3 text-sm text-muted-foreground text-pretty">${item.description}</p>`
      : ''}
  </a>`;
}

export function uiIndexPage(): TemplateResult {
  return html`<div class="mx-auto max-w-6xl px-6 py-12 sm:py-16">
    <div class="max-w-2xl">
      <h1 class="text-4xl font-bold tracking-tight">Components</h1>
      <p class="mt-3 text-lg text-muted-foreground text-pretty">
        ${String(components.length)} components you copy into your project and own — real
        @nisli/ui, ported from shadcn/ui. Install any of them with
        <code class="rounded bg-muted px-1.5 py-0.5 text-sm">npx @nisli/ui add &lt;name&gt;</code>.
      </p>
    </div>

    <div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${components.map((item) => ItemCard(item))}
    </div>

    <div class="mt-16 max-w-2xl">
      <h2 class="text-2xl font-semibold tracking-tight">Primitives</h2>
      <p class="mt-2 text-muted-foreground text-pretty">
        Behavioral building blocks the components depend on — keyboard navigation, dismissal,
        floating positioning. Not visual components; installed automatically as
        dependencies, or on their own.
      </p>
    </div>
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${primitives.map((item) => ItemCard(item))}
    </div>
  </div>`;
}
