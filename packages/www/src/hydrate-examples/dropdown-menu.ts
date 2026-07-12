/**
 * hydrate-examples/dropdown-menu.ts — the dropdown-menu preview.
 * Files in this directory are the curated examples for floating overlays that
 * come alive on hover/click (WWW-10). The SAME example renders closed in SSG
 * (the static, no-JS fallback) and, once hydrated, runs live — the trigger
 * opens the menu, client-anchored. The client runtime (src/client/hydrate.ts)
 * lazily import()s each of these per visible preview frame, so Vite code-splits
 * one chunk per component.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '../nisli-ui/ui/dropdown-menu.js';

export default function dropdownMenuExample(): TemplateResult {
  return html`${DropdownMenu({
    children: html`${DropdownMenuTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Open menu',
    })}
    ${DropdownMenuContent({
      className: 'w-56',
      children: html`${DropdownMenuLabel({ children: 'My Account' })}
      ${DropdownMenuSeparator({})}
      ${DropdownMenuItem({
        value: 'profile',
        children: html`Profile ${DropdownMenuShortcut({ children: '⇧⌘P' })}`,
      })}
      ${DropdownMenuItem({ value: 'settings', children: 'Settings' })}
      ${DropdownMenuSeparator({})}
      ${DropdownMenuCheckboxItem({ checked: true, children: 'Status Bar' })}
      ${DropdownMenuCheckboxItem({ children: 'Activity Bar' })}
      ${DropdownMenuSeparator({})}
      ${DropdownMenuSub({
        children: html`${DropdownMenuSubTrigger({ children: 'Invite users' })}
        ${DropdownMenuSubContent({
          children: html`${DropdownMenuItem({ value: 'email', children: 'Email' })}
          ${DropdownMenuItem({ value: 'message', children: 'Message' })}`,
        })}`,
      })}
      ${DropdownMenuSeparator({})}
      ${DropdownMenuItem({ value: 'logout', variant: 'destructive', children: 'Log out' })}`,
    })}`,
  })}`;
}
