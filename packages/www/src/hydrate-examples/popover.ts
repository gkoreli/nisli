import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from '../nisli-ui/ui/popover.js';

export default function popoverExample(): TemplateResult {
  return html`${Popover({
    children: html`${PopoverTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Open popover',
    })}
    ${PopoverContent({
      children: PopoverHeader({
        children: html`${PopoverTitle({ children: 'Dimensions' })}
        ${PopoverDescription({ children: 'Set the dimensions for the layer.' })}`,
      }),
    })}`,
  })}`;
}
