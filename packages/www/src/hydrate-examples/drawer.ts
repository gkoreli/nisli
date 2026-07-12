import { html, type TemplateResult } from '@nisli/core';
import { Button, buttonVariants } from '../nisli-ui/ui/button.js';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '../nisli-ui/ui/drawer.js';

export default function drawerExample(): TemplateResult {
  return html`${Drawer({
    children: html`${DrawerTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Open drawer',
    })}
    ${DrawerContent({
      children: html`${DrawerHeader({
        children: html`${DrawerTitle({ children: 'Move goal' })}
        ${DrawerDescription({ children: 'Drag down to dismiss, or use the buttons.' })}`,
      })}
      ${DrawerFooter({
        children: html`${Button({ children: 'Submit' })}
        ${DrawerClose({ className: buttonVariants({ variant: 'outline' }), children: 'Cancel' })}`,
      })}`,
    })}`,
  })}`;
}
