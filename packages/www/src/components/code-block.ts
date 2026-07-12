/**
 * components/code-block.ts — a code sample block with a copy button.
 * The code is passed as a plain string and rendered through a text binding, so
 * @nisli/core escapes it — `<`, `>`, `&` in samples are safe by construction,
 * and `${...}` in the sample is literal (never interpolated). The copy button
 * is progressively enhanced by the inline script in shell.ts (no client bundle).
 */
import { html, type TemplateResult } from '@nisli/core';

export interface CodeBlockOptions {
  /** Optional filename/label shown in the block's title bar. */
  file?: string;
}

function CopyButton(): TemplateResult {
  return html`<button
    type="button"
    data-copy
    aria-label="Copy code"
    class="absolute top-2 right-2 z-10 rounded-md border border-border bg-background/80 px-2 py-1 text-xs text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
  >
    <span data-copy-idle>Copy</span>
    <span data-copy-done hidden>Copied</span>
  </button>`;
}

export function CodeBlock(code: string, { file }: CodeBlockOptions = {}): TemplateResult {
  return html`<div data-code-block class="group relative overflow-hidden rounded-xl border bg-card">
    ${CopyButton()}
    ${file
      ? html`<div class="border-b bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">${file}</div>`
      : ''}
    <pre
      class="overflow-x-auto p-4 text-[13px] leading-relaxed"
    ><code class="font-mono">${code}</code></pre>
  </div>`;
}

/** An inline command line (single shell command) with a copy button. */
export function Command(cmd: string): TemplateResult {
  return html`<div data-code-block class="group relative">
    ${CopyButton()}
    <pre
      class="overflow-x-auto rounded-lg border bg-card p-3 pr-16 text-[13px]"
    ><code class="font-mono">${cmd}</code></pre>
  </div>`;
}
