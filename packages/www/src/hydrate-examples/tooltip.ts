/**
 * hydrate-examples/tooltip.ts — the tooltip preview (see dropdown-menu.ts for
 * the pattern). Static: the trigger. Hydrated: hover reveals the tooltip,
 * client-anchored.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import { Tooltip, TooltipTrigger, TooltipContent } from '../nisli-ui/ui/tooltip.js';

export default function tooltipExample(): TemplateResult {
  return html`${Tooltip({
    children: html`${TooltipTrigger({
      className: buttonVariants({ variant: 'outline' }),
      children: 'Hover me',
    })}
    ${TooltipContent({ children: 'Anchored on hover once hydrated.' })}`,
  })}`;
}
