/**
 * pages/home.ts — the showcase landing page, composed from section modules.
 * Sections are owned per-ticket (hero/install/framework: SITE-2; gallery:
 * SITE-1) — edit your section file, not this composition.
 */
import { html, type TemplateResult } from '@nisli/core';
import { hero } from '../sections/hero.js';
import { gallery } from '../sections/gallery.js';
import { install } from '../sections/install.js';
import { framework } from '../sections/framework.js';

export function homePage(): TemplateResult {
  return html`<main class="min-h-screen bg-background text-foreground">
    ${hero()}
    ${gallery()}
    ${install()}
    ${framework()}
    <footer class="mx-auto max-w-4xl border-t px-6 py-10 text-sm text-muted-foreground">
      Built with nisli, @nisli/ui, and @nisli/ssg. Components ported from
      shadcn/ui (MIT).
    </footer>
  </main>`;
}
