/**
 * hydrate-examples/toast.ts — the toast preview (WWW-14).
 * A side-effectful example: the buttons call toast.*() and the Toaster renders
 * the result, so it only works once the page hydrates (registers ui-button +
 * ui-toaster and wires the @click handlers). The RC3 static version looked
 * populated but was inert — this lives in the hydrate-set so the typed toasts
 * (and their UI-50 icons) are actually exercised and verifiable.
 */
import { html, type TemplateResult } from '@nisli/core';
import { buttonVariants } from '../nisli-ui/ui/button.js';
import { toast, Toaster } from '../nisli-ui/ui/toast.js';

export default function toastExample(): TemplateResult {
  const btn = buttonVariants({ variant: 'outline', size: 'sm' });
  return html`<div class="flex flex-col items-center gap-3">
    <div class="flex flex-wrap justify-center gap-2">
      <button
        class="${btn}"
        @click=${() => toast.success('Changes saved', { description: 'Your project is up to date.' })}
      >
        Success
      </button>
      <button
        class="${btn}"
        @click=${() => toast.error('Deploy failed', { description: 'Check the build logs.' })}
      >
        Error
      </button>
      <button
        class="${btn}"
        @click=${() => toast.warning('Unsaved changes', { description: 'Leaving will discard them.' })}
      >
        Warning
      </button>
      <button
        class="${btn}"
        @click=${() => toast.info('New version', { description: 'v0.3.0 of @nisli/ui is available.' })}
      >
        Info
      </button>
    </div>
    ${Toaster({})}
  </div>`;
}
