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
import { INTENT_SURFACES } from './nav-model.js';
import { SiteFooter } from '../components/site-footer.js';

// The top bar. `/intent`'s entry is taken from the surface catalog rather than
// retyped, because that catalog is what the router expands its routes from — and
// the pitch page is reachable ONLY from here: it renders in SiteShell alone, so
// it has no sidebar to appear in, and its two study surfaces are the sidebar
// leaves. Label is shortened from the catalog's nav label ('Derived appearance'
// reads as a sentence in a sidebar group and as clutter in a top bar).
const intentPitch = INTENT_SURFACES.find((surface) => surface.chrome === 'shell')!;

/**
 * The top bar's links — EXPORTED because `nav-coverage.test.ts` asserts against
 * them. A top-bar route is one that is real, is NOT a sidebar leaf, and IS
 * anchored in the chrome of every page; a hand-written copy of this list in the
 * test could satisfy the first two while the third silently failed, which is
 * exactly how `/intent` first shipped unreachable from the top bar.
 */
export const TOP_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/docs', label: 'Docs' },
  { href: '/ui', label: 'Components' },
  { href: '/themes', label: 'Themes' },
  { href: intentPitch.href, label: 'Intent' },
];

/**
 * The main nav's class, named because two of its utilities are load-bearing
 * rather than styling and a future tidy-up would otherwise drop them.
 *
 * `min-w-0` and `overflow-x-auto`: a flex item defaults to `min-width: auto`,
 * so without these the nav cannot shrink below the min-content width of its
 * labels — every one a single unbreakable word — and the overflow escapes the
 * row to WIDEN THE DOCUMENT. Under mobile emulation that produces no
 * scrollbar; Chromium shrinks to fit, handing the phone a zoomed-out page
 * while `scrollWidth <= innerWidth` still holds. `preview-sweep.mjs` catches it
 * only through its absolute `innerWidth !== 390` check, which is why that check
 * exists alongside the relative one.
 *
 * MEASURED at 390px against the built stylesheet: the header row needed 368px
 * inside a 358px content box, so slack was already -10px and survived only by
 * spilling into its own padding. Adding one top-bar link spent the remainder,
 * and CI — whose font metrics are wider than macOS's — went to 407px on every
 * phone page at once while every local check passed. Emulating +0.4px/char
 * reproduces it at 399px, +0.8px at 413px.
 *
 * Deliberately NOT `overflow-x-clip` and NOT an `sm:`-only visibility rule:
 * both would trade a widened page for a silently unreachable link. Shrinking
 * and scrolling keeps every link focusable at any width, and makes the fit
 * independent of the font the runner happens to have.
 */
const MAIN_NAV_CLASS = 'flex min-w-0 items-center gap-4 overflow-x-auto text-sm sm:gap-5';

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
      <div class="mx-auto flex h-(--header-height) max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <a href="/" class="flex items-center gap-2 font-semibold tracking-tight">
          <span
            class="inline-flex h-6 w-6 items-center justify-center rounded bg-foreground text-[13px] font-bold text-background"
            >n</span
          >
          nisli
        </a>
        <nav aria-label="Main" class="${MAIN_NAV_CLASS}">
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
            href="https://github.com/gkoreli/nisli"
            class="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
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
