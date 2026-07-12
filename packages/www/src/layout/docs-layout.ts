/**
 * layout/docs-layout.ts — DocsLayout: the three-region docs frame.
 *
 * Sidebar (registry-dogfooded SidebarNav) / content / optional TOC rail (ADR
 * 0024 WWW-12 amendment). Rendered inside SiteShell's <main>, so it does NOT
 * introduce its own <main> (SidebarInset is a <main> — nesting it would be
 * invalid); the content region is a plain flex column. The SidebarProvider
 * wraps both the sidebar and the mobile SidebarTrigger so the drawer toggles.
 *
 * Static-first: sidebar links are real anchors; only the mobile drawer toggle
 * needs the hydration runtime (the drawer's portaled Sheet is in the hydrate
 * set per the ADR 0025 item-6 SSG limit).
 */
import { html, type TemplateResult } from '@nisli/core';
import { SidebarProvider } from '../nisli-ui/ui/sidebar.js';
import { SidebarNav } from './sidebar-nav.js';
import { MobileNav } from './mobile-nav.js';
import { PageToc, type TocEntry } from './page-toc.js';
import { buildNav } from './nav-model.js';

export interface DocsLayoutOptions {
  /** Current route path — highlights the active nav item. */
  current?: string;
  /** Optional "on this page" entries for the right rail. */
  toc?: readonly TocEntry[];
}

export function DocsLayout(
  content: TemplateResult,
  { current, toc = [] }: DocsLayoutOptions = {},
): TemplateResult {
  return SidebarProvider({
    // Not a full-viewport app shell — it lives under the sticky top bar inside
    // SiteShell's <main>. Override the frame's min-h-svh (via --header-height,
    // set on SiteShell) and top-align.
    className: 'min-h-[calc(100svh-var(--header-height)-1px)]! items-start',
    children: html`${SidebarNav({ model: buildNav(current) })}
    <div class="flex min-w-0 flex-1 flex-col">
      <div
        class="flex items-center gap-2 border-b px-4 py-2 md:hidden"
        data-hydrate="mobile-nav"
      >
        ${MobileNav(current)}
      </div>
      <div class="mx-auto flex w-full max-w-6xl gap-12 px-6 py-10">
        <div class="min-w-0 flex-1">${content}</div>
        ${toc.length
          ? html`<aside class="hidden w-56 shrink-0 xl:block">${PageToc(toc)}</aside>`
          : ''}
      </div>
    </div>`,
  });
}
