/**
 * layout/site-shell.ts — SiteShell: the persistent site chrome.
 *
 * The top bar (brand, top-level nav, theme toggle) + the <main> landmark +
 * footer that EVERY page renders inside, home included (ADR 0024 WWW-12
 * amendment). Docs pages render a DocsLayout inside `content`; the home page
 * renders inside SiteShell alone. A reusable component, never page-local markup.
 *
 * Static-first: links are real anchors; only the theme toggle needs the
 * hydration runtime (progressively enhanced by the inline boot script until
 * then, matching the existing site-nav behavior).
 */
import { html, type TemplateResult } from '@nisli/core';
import { SiteFooter } from '../components/site-footer.js';

const TOP_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/docs', label: 'Docs' },
  { href: '/ui', label: 'Components' },
  { href: '/themes', label: 'Themes' },
];

function topActive(current: string | undefined, href: string): boolean {
  if (!current) return false;
  return href === '/' ? current === '/' : current.startsWith(href);
}

export interface SiteShellOptions {
  /** Current route path, so the top-level nav can highlight the active link. */
  current?: string;
}

export function SiteShell(
  content: TemplateResult,
  { current }: SiteShellOptions = {},
): TemplateResult {
  // --header-height is the single source of the top-bar height: it sizes the
  // bar here and is consumed (via cascade) by DocsLayout's fixed sidebar offset
  // and the content min-heights, so the header/sidebar coupling lives in one place.
  return html`<div style="--header-height:3.5rem">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >Skip to content</a
    >
    <header
      class="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="mx-auto flex h-(--header-height) max-w-6xl items-center gap-6 px-6">
        <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded bg-foreground text-[13px] font-bold text-background"
            >n</span
          >
          nisli
        </a>
        <nav aria-label="Main" class="flex items-center gap-5 text-sm">
          ${TOP_LINKS.map((link) => {
            const active = topActive(current, link.href);
            return html`<a
              href="${link.href}"
              aria-current="${active ? 'page' : undefined}"
              class="${active
                ? 'text-foreground'
                : 'text-muted-foreground'} transition-colors hover:text-foreground"
              >${link.label}</a
            >`;
          })}
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/gogakoreli/nisli"
            class="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >GitHub</a
          >
          <button
            id="theme-toggle"
            type="button"
            aria-label="Toggle dark mode"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
          >
            <span class="dark:hidden">☀</span>
            <span class="hidden dark:inline">☾</span>
          </button>
        </div>
      </div>
    </header>
    <main id="main-content" class="min-h-[calc(100vh-var(--header-height)-1px)]">${content}</main>
    ${SiteFooter()}
  </div>`;
}
