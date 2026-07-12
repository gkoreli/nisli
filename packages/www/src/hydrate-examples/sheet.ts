/**
 * hydrate-examples/sheet.ts — the sheet preview.
 * A portaled side panel: static trigger in SSG, live slide-in on hydrate
 * (WWW-11 Class-B — portaled content requires the runtime, ADR 0025 item-6).
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button, buttonVariants } from '../nisli-ui/ui/button.js';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '../nisli-ui/ui/sheet.js';

export default function sheetExample(): TemplateResult {
  return html`${Sheet({
    children: html`${SheetTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Open sheet',
    })}
    ${SheetContent({
      side: 'right',
      children: html`${SheetHeader({
        children: html`${SheetTitle({ children: 'Edit profile' })}
        ${SheetDescription({
          children: "Make changes to your profile here. Click save when you're done.",
        })}`,
      })}
      ${SheetFooter({
        children: html`${Button({ children: 'Save changes' })}
        ${SheetClose({ className: buttonVariants({ variant: 'outline' }), children: 'Close' })}`,
      })}`,
    })}`,
  })}`;
}
