/**
 * components/code-block.ts — a code sample block.
 * The code is passed as a plain string and rendered through a text binding, so
 * @nisli/core escapes it — `<`, `>`, `&` in samples are safe by construction,
 * and `${...}` in the sample is literal (never interpolated).
 */
import { html, type TemplateResult } from '@nisli/core';

export interface CodeBlockOptions {
  /** Optional filename/label shown in the block's title bar. */
  file?: string;
}

export function CodeBlock(code: string, { file }: CodeBlockOptions = {}): TemplateResult {
  return html`<div class="overflow-hidden rounded-xl border bg-card">
    ${file
      ? html`<div class="border-b bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">${file}</div>`
      : ''}
    <pre
      class="overflow-x-auto p-4 text-[13px] leading-relaxed"
    ><code class="font-mono">${code}</code></pre>
  </div>`;
}

/** An inline command line (single shell command). */
export function Command(cmd: string): TemplateResult {
  return html`<pre
    class="overflow-x-auto rounded-lg border bg-card p-3 text-[13px]"
  ><code class="font-mono">${cmd}</code></pre>`;
}
