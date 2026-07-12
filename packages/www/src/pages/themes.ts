/**
 * pages/themes.ts — the design/token showcase.
 * The @nisli/ui token layer: semantic color tokens (light + dark via the .dark
 * class), chart colors, radius, and typography — all driven by the CSS
 * variables in the registry's theme.css. Toggle the theme (top-right) to see
 * every token flip. Content mirrors src/nisli-ui/styles/theme.css.
 */
import { html, type TemplateResult } from '@nisli/core';
import { CodeBlock } from '../components/code-block.js';

interface Swatch {
  /** Tailwind bg utility (the token). */
  bg: string;
  /** Tailwind text utility for the label sitting on the swatch. */
  fg: string;
  name: string;
  /** true → draw a border (near-background tokens need it to be visible). */
  outline?: boolean;
}

const CORE: readonly Swatch[] = [
  { bg: 'bg-background', fg: 'text-foreground', name: 'background', outline: true },
  { bg: 'bg-card', fg: 'text-card-foreground', name: 'card', outline: true },
  { bg: 'bg-popover', fg: 'text-popover-foreground', name: 'popover', outline: true },
  { bg: 'bg-primary', fg: 'text-primary-foreground', name: 'primary' },
  { bg: 'bg-secondary', fg: 'text-secondary-foreground', name: 'secondary' },
  { bg: 'bg-muted', fg: 'text-muted-foreground', name: 'muted' },
  { bg: 'bg-accent', fg: 'text-accent-foreground', name: 'accent' },
  { bg: 'bg-destructive', fg: 'text-white', name: 'destructive' },
];

const CHARTS = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
const RADII: readonly { cls: string; label: string }[] = [
  { cls: 'rounded-sm', label: 'sm' },
  { cls: 'rounded-md', label: 'md' },
  { cls: 'rounded-lg', label: 'lg' },
  { cls: 'rounded-xl', label: 'xl' },
];

function SwatchCard(s: Swatch): TemplateResult {
  return html`<div
    class="flex h-24 flex-col justify-between rounded-lg ${s.bg} ${s.fg} ${s.outline
      ? 'border'
      : ''} p-3"
  >
    <span class="text-sm font-medium">${s.name}</span>
    <span class="font-mono text-xs opacity-70">--${s.name}</span>
  </div>`;
}

const themeOverride = `:root {
  --primary: oklch(0.55 0.22 264);          /* your brand */
  --primary-foreground: oklch(0.98 0 0);
  --radius: 0.5rem;
}

.dark {
  --primary: oklch(0.7 0.19 264);
}`;

export function themesPage(): TemplateResult {
  return html`<div class="mx-auto max-w-5xl px-6 py-12 sm:py-16">
    <h1 class="text-4xl font-bold tracking-tight">Themes</h1>
    <p class="mt-3 max-w-2xl text-lg text-muted-foreground text-pretty">
      @nisli/ui is themed with CSS variables — a small, shadcn-compatible token layer you
      own in <code class="rounded bg-muted px-1.5 py-0.5 text-sm">theme.css</code>. Light and
      dark are the same tokens, re-declared under a <code class="rounded bg-muted px-1.5 py-0.5 text-sm">.dark</code>
      class. Toggle the theme (top-right) to watch every token below flip.
    </p>

    <h2 class="mt-12 text-2xl font-semibold tracking-tight">Color tokens</h2>
    <p class="mt-2 text-muted-foreground">
      Semantic pairs — a surface and the foreground that sits on it.
    </p>
    <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${CORE.map((s) => SwatchCard(s))}
    </div>

    <h2 class="mt-12 text-2xl font-semibold tracking-tight">Chart colors</h2>
    <p class="mt-2 text-muted-foreground">Five categorical colors for data visualization.</p>
    <div class="mt-6 flex flex-wrap gap-4">
      ${CHARTS.map(
        (c, i) => html`<div class="flex flex-col items-center gap-2">
          <div class="h-16 w-16 rounded-lg ${c}"></div>
          <span class="font-mono text-xs text-muted-foreground">chart-${String(i + 1)}</span>
        </div>`,
      )}
    </div>

    <h2 class="mt-12 text-2xl font-semibold tracking-tight">Radius</h2>
    <p class="mt-2 text-muted-foreground">
      Every radius derives from a single <code class="rounded bg-muted px-1.5 py-0.5 text-sm">--radius</code> token.
    </p>
    <div class="mt-6 flex flex-wrap gap-6">
      ${RADII.map(
        (r) => html`<div class="flex flex-col items-center gap-2">
          <div class="h-16 w-16 border bg-muted ${r.cls}"></div>
          <span class="font-mono text-xs text-muted-foreground">${r.label}</span>
        </div>`,
      )}
    </div>

    <h2 class="mt-12 text-2xl font-semibold tracking-tight">Typography</h2>
    <div class="mt-6 space-y-3 rounded-xl border bg-card p-6">
      <h1 class="text-4xl font-bold tracking-tight">The quick brown fox</h1>
      <h2 class="text-2xl font-semibold tracking-tight">The quick brown fox</h2>
      <p class="leading-7">
        Body copy in the foreground color — jumps over the lazy dog while staying perfectly
        legible on the background surface.
      </p>
      <p class="text-sm text-muted-foreground">Muted secondary text for captions and hints.</p>
    </div>

    <h2 class="mt-12 text-2xl font-semibold tracking-tight">Own your theme</h2>
    <p class="mt-2 max-w-2xl text-muted-foreground text-pretty">
      Theming is editing variables. Override any token in your
      <code class="rounded bg-muted px-1.5 py-0.5 text-sm">theme.css</code> — no config, no
      build plugin, no rebuild of the components.
    </p>
    <div class="mt-6">${CodeBlock(themeOverride, { file: 'theme.css' })}</div>
  </div>`;
}
