/**
 * hydrate-examples/dialog.ts — the dialog preview.
 * Portaled overlays require the client runtime to open (their content escapes
 * the SSG snapshot, ADR 0025 item-6), so dialog lives here rather than as a
 * static example: closed trigger in SSG, live open on hydrate (WWW-11 Class-B).
 */
import { html, type TemplateResult } from '@nisli/core';
import { Button, buttonVariants } from '../nisli-ui/ui/button.js';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../nisli-ui/ui/dialog.js';

export default function dialogExample(): TemplateResult {
  return html`${Dialog({
    children: html`${DialogTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Open Dialog',
    })}
    ${DialogContent({
      children: html`${DialogHeader({
        children: html`${DialogTitle({ children: 'Edit profile' })}
        ${DialogDescription({
          children: "Make changes to your profile here. Click save when you're done.",
        })}`,
      })}
      ${DialogFooter({
        children: html`${Button({ variant: 'outline', children: 'Cancel' })}
        ${Button({ children: 'Save changes' })}`,
      })}`,
    })}`,
  })}`;
}
