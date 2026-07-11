/**
 * components/site-footer.ts — the shared site footer.
 * A nisli template fragment, rendered to static HTML by @nisli/ssg.
 */
import { html, type TemplateResult } from '@nisli/core';

export function SiteFooter(): TemplateResult {
  return html`<footer class="border-t border-border/60">
    <div
      class="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        Built with
        <a href="/docs" class="text-foreground underline-offset-4 hover:underline">nisli</a>,
        <a href="/ui" class="text-foreground underline-offset-4 hover:underline">@nisli/ui</a>, and
        <span class="text-foreground">@nisli/ssg</span>. Components ported from
        <a
          href="https://ui.shadcn.com"
          class="text-foreground underline-offset-4 hover:underline"
          >shadcn/ui</a
        >
        (MIT).
      </p>
      <a
        href="https://github.com/gogakoreli/nisli"
        class="transition-colors hover:text-foreground"
        >github.com/gogakoreli/nisli</a
      >
    </div>
  </footer>`;
}
