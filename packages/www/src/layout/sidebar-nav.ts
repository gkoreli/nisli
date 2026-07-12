/**
 * layout/sidebar-nav.ts — SidebarNav: the grouped docs navigation.
 *
 * Dogfoods the registry `sidebar` family (ADR 0024 WWW-12 amendment): the
 * provider/frame/menu structure is the registry component, not www-local
 * markup. Groups + items come from the derived NavModel (nav-model.ts) — zero
 * hand lists. Links are real anchors (SidebarMenuButton `href` mode), so the
 * nav works with zero JS; the active item carries data-active + aria-current.
 *
 * The desktop frame is the registry Sidebar's fixed `offcanvas` frame, offset
 * below the sticky SiteShell top bar (h-14); on mobile it becomes the off-canvas
 * Sheet drawer (both from the registry sidebar's mobile branch). Rendered inside
 * a SidebarProvider by DocsLayout.
 */
import { html, type TemplateResult } from '@nisli/core';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '../nisli-ui/ui/sidebar.js';
import type { NavModel } from './nav-model.js';

export interface SidebarNavProps {
  model: NavModel;
}

export function SidebarNav({ model }: SidebarNavProps): TemplateResult {
  return Sidebar({
    collapsible: 'offcanvas',
    // Documented consumption pattern (ADR 0024 WWW-12): offset the registry
    // Sidebar's fixed frame below the sticky top bar via a className override —
    // the source-copy analogue of shadcn's own header+sidebar examples, which
    // offset the fixed frame with a header-height on exactly these classes.
    // `--header-height` (set once on SiteShell) is the single source; `!` beats
    // the frame's `inset-y-0`. The mobile Sheet is unaffected (it does not use
    // this className). Desktop visual fit verified post-deploy (WWW-12 sweep).
    className: 'top-(--header-height)! h-[calc(100svh-var(--header-height))]!',
    children: SidebarContent({
      className: 'px-2 py-4',
      // The registry Sidebar frame is div-based, so the docs sidebar needs its
      // own labeled navigation landmark (SiteShell's top nav is aria-label
      // "Main"; this is the primary docs nav). A plain <nav> re-establishing the
      // column flow (flex/gap mirrors SidebarContent) keeps the landmark
      // layout-safe without display:contents a11y-tree risk.
      children: html`<nav
        aria-label="Documentation"
        class="flex w-full min-w-0 flex-col gap-2"
      >
        ${model.groups.map((group) =>
          SidebarGroup({
            children: html`${SidebarGroupLabel({ children: group.title })}
            ${SidebarMenu({
              children: html`${group.items.map((item) =>
                SidebarMenuItem({
                  children: SidebarMenuButton({
                    href: item.href,
                    isActive: item.active,
                    children: item.label,
                  }),
                }),
              )}`,
            })}`,
          }),
        )}
      </nav>`,
    }),
  });
}
