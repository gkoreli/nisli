/**
 * pages/ui-component.ts — a single /ui/<name> page.
 * Everything except the optional preview is rendered from registry metadata, so
 * the page is correct by construction for any item: title, description, the
 * exact add command, dependencies (linked), and the files you own.
 */
import { html, type TemplateResult } from '@nisli/core';
import { addCommand, getItem, itemPath, type RegistryItem } from '../registry.js';
import { getExample } from '../examples.js';

function typeLabel(item: RegistryItem): string {
  return item.type === 'lib' ? 'Primitive' : 'Component';
}

function DepLinks(names: readonly string[]): TemplateResult {
  return html`${names.map((name, i) => {
    const known = getItem(name);
    const sep = i > 0 ? html`<span class="text-muted-foreground">, </span>` : '';
    return known
      ? html`${sep}<a href="${itemPath(name)}" class="underline-offset-4 hover:underline">${name}</a>`
      : html`${sep}<span>${name}</span>`;
  })}`;
}

export function uiComponentPage(item: RegistryItem): TemplateResult {
  const example = getExample(item.name);
  const registryDeps = item.registryDependencies ?? [];
  const npmDeps = item.dependencies ?? [];

  return html`<div class="mx-auto max-w-4xl px-6 py-12 sm:py-16">
    <a href="/ui" class="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >← Components</a
    >
    <div class="mt-4 flex items-center gap-3">
      <h1 class="text-4xl font-bold tracking-tight">${item.name}</h1>
      <span
        class="rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
        >${typeLabel(item)}</span
      >
    </div>
    ${item.description
      ? html`<p class="mt-3 max-w-2xl text-lg text-muted-foreground text-pretty">${item.description}</p>`
      : ''}

    ${example
      ? html`<div class="mt-8">
          <h2 class="text-sm font-medium text-muted-foreground">Preview</h2>
          <div
            class="mt-2 flex min-h-40 items-center justify-center rounded-xl border bg-card p-8"
          >
            ${example()}
          </div>
        </div>`
      : ''}

    <div class="mt-8">
      <h2 class="text-sm font-medium text-muted-foreground">Installation</h2>
      <pre
        class="mt-2 overflow-x-auto rounded-lg border bg-card p-4 text-[13px]"
      ><code class="font-mono">${addCommand(item)}</code></pre>
    </div>

    <div class="mt-8 grid gap-6 sm:grid-cols-2">
      <div>
        <h2 class="text-sm font-medium text-muted-foreground">Dependencies</h2>
        <p class="mt-2 text-sm">
          ${registryDeps.length ? DepLinks(registryDeps) : html`<span class="text-muted-foreground">None</span>`}
        </p>
        ${npmDeps.length
          ? html`<p class="mt-2 text-sm text-muted-foreground">
              npm: ${npmDeps.map((d, i) => html`${i > 0 ? ', ' : ''}<code class="rounded bg-muted px-1 py-0.5">${d}</code>`)}
            </p>`
          : ''}
      </div>
      <div>
        <h2 class="text-sm font-medium text-muted-foreground">Files you own</h2>
        <ul class="mt-2 space-y-1 text-sm">
          ${item.files.map(
            (f) => html`<li><code class="rounded bg-muted px-1.5 py-0.5">${f}</code></li>`,
          )}
        </ul>
      </div>
    </div>
  </div>`;
}
