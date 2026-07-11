/**
 * components/site-nav.ts — the persistent top navigation.
 * A nisli template fragment (the site's own chrome is dogfood too), rendered
 * to static HTML by @nisli/ssg. The theme toggle is progressively enhanced by
 * the inline script in shell.ts until the client runtime lands.
 */
import { html, type TemplateResult } from '@nisli/core';

const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/docs', label: 'Docs' },
  { href: '/ui', label: 'Components' },
  { href: '/themes', label: 'Themes' },
];

export interface SiteNavOptions {
  /** Current route path, so the active link can be highlighted. */
  current?: string;
}

function isActive(current: string | undefined, href: string): boolean {
  if (!current) return false;
  return href === '/' ? current === '/' : current.startsWith(href);
}

export function SiteNav({ current }: SiteNavOptions = {}): TemplateResult {
  return html`<header
    class="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
  >
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
      <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded bg-foreground text-[13px] font-bold text-background"
          >n</span
        >
        nisli
      </a>
      <nav class="flex items-center gap-5 text-sm">
        ${NAV_LINKS.map(
          (link) => html`<a
            href="${link.href}"
            class="${isActive(current, link.href)
              ? 'text-foreground'
              : 'text-muted-foreground'} transition-colors hover:text-foreground"
            >${link.label}</a
          >`,
        )}
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
  </header>`;
}
