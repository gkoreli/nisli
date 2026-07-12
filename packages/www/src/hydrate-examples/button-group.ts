/**
 * hydrate-examples/button-group.ts — the button-group preview (WWW-15).
 *
 * A ButtonGroup has NO native group state, so to be CLICK-OBSERVABLE for the
 * WWW-15 guard (per cdx1) the example carries a tiny reactive status node: a
 * container-level click reads the pressed button and updates
 * `[data-slot="button-group-status"]`. The guard clicks a segment (e.g. "Copy")
 * and asserts the status text changes (before: "—").
 *
 * Uses real `Button` (ui-button) children — NOT native <button> — so cdx1's
 * registry-only cohesion fix (joined outline segments through the transparent
 * ui-button hosts) applies. No `ButtonGroupSeparator`: the canonical joined
 * segment is the default (per cdx1). Static in SSG, live once hydrated.
 */
import { html, signal, type TemplateResult } from '@nisli/core';
import { ButtonGroup } from '../nisli-ui/ui/button-group.js';
import { Button } from '../nisli-ui/ui/button.js';

export default function buttonGroupExample(): TemplateResult {
  const status = signal('—');
  const onClick = (e: Event): void => {
    const btn = (e.target as HTMLElement).closest('button');
    if (btn?.textContent) status.value = btn.textContent.trim();
  };
  return html`<div class="flex flex-col items-start gap-3" @click=${onClick}>
    ${ButtonGroup({
      children: html`${Button({ variant: 'outline', children: 'Cut' })}
      ${Button({ variant: 'outline', children: 'Copy' })}
      ${Button({ variant: 'outline', children: 'Paste' })}`,
    })}
    <p data-slot="button-group-status" class="text-sm text-muted-foreground">
      Last action: ${status}
    </p>
  </div>`;
}
