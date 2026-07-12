/**
 * hydrate-examples/alert-dialog.ts — the alert-dialog preview.
 * A portaled confirm overlay: static trigger in SSG, live open on hydrate
 * (WWW-11 Class-B — portaled content requires the runtime, ADR 0025 item-6).
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../nisli-ui/ui/alert-dialog.js';

export default function alertDialogExample(): TemplateResult {
  return html`${AlertDialog({
    children: html`${AlertDialogTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Show dialog',
    })}
    ${AlertDialogContent({
      children: html`${AlertDialogHeader({
        children: html`${AlertDialogTitle({ children: 'Are you absolutely sure?' })}
        ${AlertDialogDescription({
          children:
            'This action cannot be undone. This will permanently delete your account and remove your data from our servers.',
        })}`,
      })}
      ${AlertDialogFooter({
        children: html`${AlertDialogCancel({ children: 'Cancel' })}
        ${AlertDialogAction({ children: 'Continue' })}`,
      })}`,
    })}`,
  })}`;
}
