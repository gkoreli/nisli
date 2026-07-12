/**
 * hydrate-examples/navigation-menu.ts — the navigation-menu preview (WWW-14).
 * The dropdown surface (Trigger + Content) is inline (data-viewport="false")
 * but data-state-toggled, so it only opens once the component hydrates — hence
 * it lives here (joins the glob hydrate-set) rather than as a static example.
 * Closed trigger row in SSG; on hover the "Getting started" panel opens.
 */
import { html, type TemplateResult } from '@nisli/core';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '../nisli-ui/ui/navigation-menu.js';

function panelLink(href: string, title: string, blurb: string): TemplateResult {
  return NavigationMenuLink({
    href,
    className: 'block rounded-md p-2 hover:bg-accent hover:text-accent-foreground',
    children: html`<div class="text-sm font-medium leading-none">${title}</div>
    <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">${blurb}</p>`,
  });
}

export default function navigationMenuExample(): TemplateResult {
  return html`${NavigationMenu({
    children: NavigationMenuList({
      children: html`${NavigationMenuItem({
        children: html`${NavigationMenuTrigger({ value: 'getting-started', children: 'Getting started' })}
        ${NavigationMenuContent({
          value: 'getting-started',
          children: html`<ul class="grid w-[320px] gap-1">
            ${panelLink('/docs', 'Introduction', 'nisli — signals, tagged-template components, DI, no build step.')}
            ${panelLink('/docs/installation', 'Installation', 'Install @nisli/core, then copy in @nisli/ui components.')}
            ${panelLink('/docs/quick-start', 'Quick start', 'Build a reactive counter — the nisli hello-world.')}
          </ul>`,
        })}`,
      })}
      ${NavigationMenuItem({
        children: NavigationMenuLink({
          className: navigationMenuTriggerStyle(),
          href: '/ui',
          children: 'Components',
        }),
      })}
      ${NavigationMenuItem({
        children: NavigationMenuLink({
          className: navigationMenuTriggerStyle(),
          href: '/themes',
          children: 'Themes',
        }),
      })}`,
    }),
  })}`;
}
