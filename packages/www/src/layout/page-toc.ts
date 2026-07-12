/**
 * layout/page-toc.ts — PageToc: the optional "On this page" rail.
 *
 * The right-hand rail of a docs page (ADR 0024 WWW-12 amendment), linking the
 * page's section headings by id. Optional per page: given no entries it renders
 * nothing, so DocsLayout can always place it and let content decide. Static —
 * plain anchors, works with zero JS.
 */
import { html, type TemplateResult } from '@nisli/core';

export interface TocEntry {
  /** The heading element id this entry links to (`#id`). */
  id: string;
  label: string;
}

export function PageToc(entries: readonly TocEntry[]): TemplateResult {
  if (!entries.length) return html``;
  return html`<nav aria-label="On this page" class="sticky top-20 text-sm">
    <p class="mb-3 font-medium">On this page</p>
    <ul class="space-y-2 border-l">
      ${entries.map(
        (entry) => html`<li>
          <a
            href="${`#${entry.id}`}"
            class="-ml-px block border-l border-transparent py-1 pl-4 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >${entry.label}</a
          >
        </li>`,
      )}
    </ul>
  </nav>`;
}
