/**
 * layout/mobile-nav.ts — the www-local mobile docs drawer (WWW-15 option B).
 *
 * A registry SHEET (still dogfooding sheet) + nav links DERIVED from nav-model,
 * replace-hydrated as a chrome unit like every preview frame. This is a
 * documented consumer WORKAROUND for the SSG-prerender-then-upgrade adopt-in-
 * place gap (ADR 0025 item 17): the registry Sidebar's mobile Sheet branch works
 * on the pure-client path, but upgrading it over prerendered DOM double-renders
 * (the drawer nav duplicated + unpainted — Goga's empty-drawer P0). So mobile
 * uses THIS instead of the registry Sidebar's mobile branch; desktop keeps the
 * registry Sidebar as static zero-JS anchors, unchanged. It RESTORES to the
 * registry sidebar's mobile branch once adopt-in-place graduates to @nisli/core.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '../nisli-ui/ui/sheet.js';
import { buildNav } from './nav-model.js';

export function MobileNav(current?: string): TemplateResult {
  const model = buildNav(current);
  return Sheet({
    children: html`${SheetTrigger({
      className: buttonVariants({ variant: 'outline', size: 'sm' }),
      children: html`<svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4"
          aria-hidden="true"
        ><path d="M4 12h16" /><path d="M4 6h16" /><path d="M4 18h16" /></svg>
        Menu`,
    })}
    ${SheetContent({
      side: 'left',
      className: 'w-72 overflow-y-auto',
      children: html`${SheetTitle({ className: 'sr-only', children: 'Documentation navigation' })}
      <nav aria-label="Documentation" class="flex flex-col gap-4 px-2 py-4 text-sm">
        ${model.groups.map(
          (group) => html`<div>
            <div class="px-2 text-xs font-medium text-muted-foreground">${group.title}</div>
            <ul class="mt-1 space-y-0.5">
              ${group.items.map(
                (item) => html`<li>
                  <a
                    href="${item.href}"
                    aria-current="${item.active ? 'page' : undefined}"
                    class="block rounded-md px-2 py-1.5 ${item.active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                    >${item.label}</a
                  >
                </li>`,
              )}
            </ul>
          </div>`,
        )}
      </nav>`,
    })}`,
  });
}
