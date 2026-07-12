/**
 * layout/content-shell.ts — ContentShell: breadcrumb + title + prose container.
 *
 * The content column of a docs page (ADR 0024 WWW-12 amendment): an optional
 * breadcrumb trail, the page title + optional lead description, then the prose
 * body. A reusable component — pages hand it their rendered body; the title and
 * breadcrumb chrome live here, not in each page.
 */
import { html, type TemplateResult } from '@nisli/core';

export interface Crumb {
  label: string;
  /** Omit for the current (last) crumb — rendered as plain text. */
  href?: string;
}

export interface ContentShellOptions {
  title: string;
  /** Optional lead paragraph under the title. */
  description?: string;
  /** Optional breadcrumb trail above the title. */
  breadcrumbs?: readonly Crumb[];
}

function Breadcrumbs(crumbs: readonly Crumb[]): TemplateResult {
  return html`<nav aria-label="Breadcrumb" class="mb-4 text-sm text-muted-foreground">
    <ol class="flex flex-wrap items-center gap-1.5">
      ${crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        const link = crumb.href
          ? html`<a href="${crumb.href}" class="transition-colors hover:text-foreground"
              >${crumb.label}</a
            >`
          : html`<span aria-current="${last ? 'page' : undefined}" class="text-foreground"
              >${crumb.label}</span
            >`;
        return html`<li class="inline-flex items-center gap-1.5">
          ${link}${last ? '' : html`<span aria-hidden="true" class="text-muted-foreground/60">/</span>`}
        </li>`;
      })}
    </ol>
  </nav>`;
}

export function ContentShell(
  body: TemplateResult,
  { title, description, breadcrumbs }: ContentShellOptions,
): TemplateResult {
  return html`<div class="min-w-0 max-w-3xl">
    ${breadcrumbs && breadcrumbs.length ? Breadcrumbs(breadcrumbs) : ''}
    <h1 class="text-4xl font-bold tracking-tight text-pretty">${title}</h1>
    ${description
      ? html`<p class="mt-3 text-lg text-muted-foreground text-pretty">${description}</p>`
      : ''}
    <div class="mt-8">${body}</div>
  </div>`;
}
