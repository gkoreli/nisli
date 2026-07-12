import { html, type TemplateResult } from '@nisli/core';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../nisli-ui/ui/hover-card.js';

export default function hoverCardExample(): TemplateResult {
  return html`${HoverCard({
    children: html`${HoverCardTrigger({
      className: 'cursor-default font-medium underline underline-offset-4',
      children: '@nisli',
    })}
    ${HoverCardContent({
      children: 'A reactive web-component framework — signals, html templates, DI.',
    })}`,
  })}`;
}
