/**
 * intent/prose.ts — the page chrome for the three /intent routes: headings,
 * paragraphs, the Limits list, and the vocabulary table.
 *
 * THIS FILE IS SITE CHROME, NOT AN INTENT SURFACE. It is Tailwind, like every
 * other page on nisli.dev, and it is supposed to be: the argument is about the
 * surfaces the package renders, not about rewriting a marketing page's headings
 * in a vocabulary that has no opinion about headings. The no-values guard names
 * this file as chrome for exactly that reason, so the exemption is a listed
 * decision rather than an accident.
 *
 * The vocabulary table is DERIVED from `AXIS_ATTRS` × `VOCABULARY`, never
 * retyped. That is not tidiness: the prototype recorded a rule that shipped
 * spelling a word the vocabulary does not contain — it matched nothing, reported
 * a clean page, and every gate agreed. A page that retypes the vocabulary can
 * advertise a word the seam does not have, and nothing catches it. Derived, the
 * page cannot lie about the package's own surface.
 *
 * DOM-free: on the router's lazy-import path (ADR 0026 §8).
 */
import { html, type TemplateResult } from '@nisli/core';
import { AXIS_ATTRS, VOCABULARY } from '@nisli/intent';

// ── Prose helpers, matching pages/docs.ts ──────────────────────────────────

export function Title(text: string): TemplateResult {
  return html`<h1 class="text-4xl font-bold tracking-tight">${text}</h1>`;
}

export function Lead(content: TemplateResult | string): TemplateResult {
  return html`<p class="mt-3 text-lg text-pretty text-muted-foreground">${content}</p>`;
}

export function H2(text: string): TemplateResult {
  return html`<h2 class="mt-12 scroll-mt-20 text-2xl font-semibold tracking-tight">${text}</h2>`;
}

export function H3(text: string): TemplateResult {
  return html`<h3 class="mt-8 text-lg font-semibold tracking-tight">${text}</h3>`;
}

export function P(content: TemplateResult | string): TemplateResult {
  return html`<p class="mt-4 leading-7 text-pretty">${content}</p>`;
}

export function code(text: string): TemplateResult {
  return html`<code class="rounded bg-muted px-1.5 py-0.5 text-[0.9em]">${text}</code>`;
}

/** A caption under a demo — says what the reader is looking at. */
export function Caption(content: TemplateResult | string): TemplateResult {
  return html`<p class="mt-2 text-sm text-muted-foreground">${content}</p>`;
}

export function Bullets(items: readonly (TemplateResult | string)[]): TemplateResult {
  return html`<ul class="mt-4 space-y-2 pl-5">
    ${items.map((item) => html`<li class="list-disc leading-7">${item}</li>`)}
  </ul>`;
}

/** A framed aside for a measured number or a caveat. */
export function Note(heading: string, content: TemplateResult | string): TemplateResult {
  return html`<div class="mt-6 rounded-lg border-l-4 border-l-muted-foreground/30 bg-muted/40 p-4">
    <p class="text-sm font-semibold">${heading}</p>
    <p class="mt-1 text-sm leading-6 text-pretty">${content}</p>
  </div>`;
}

// ── The vocabulary, derived ────────────────────────────────────────────────

/**
 * What each attribute MEANS, keyed by the attribute the package actually ships.
 * The keys are checked against `AXIS_ATTRS` below, so if the package renames or
 * drops an attribute this table stops being complete and the page says so
 * instead of quietly describing an attribute that no longer exists.
 */
const AXIS_MEANING: Readonly<Record<string, string>> = {
  'data-appearance': 'what this IS',
  'data-role': 'emphasis within that',
  'data-text': 'what level of text this is',
  'data-layout': 'how children relate',
  'data-align': 'how they line up',
  'data-clip': 'whether overhang may be trimmed',
  'data-collapse': 'what to do when it will not fit',
  'data-density': 'context: how tight',
  'data-input': 'context: pointer or thumb',
  'data-theme': 'context: which colour table',
};

/**
 * The full legal vocabulary as a table. Rendered from the package's own two
 * frozen tables — `VOCABULARY` says what the legal values ARE, `AXIS_ATTRS`
 * says where they are WRITTEN — so this page cannot advertise a word the seam
 * does not have.
 */
export function VocabularyTable(): TemplateResult {
  const rows = Object.entries(AXIS_ATTRS) as [string, keyof typeof VOCABULARY][];
  return html`<div class="mt-6 overflow-x-auto rounded-xl border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-4 py-2 text-left font-medium">attribute</th>
          <th class="px-4 py-2 text-left font-medium">means</th>
          <th class="px-4 py-2 text-left font-medium">legal values</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${rows.map(
          ([attribute, axis]) => html`<tr>
            <td class="px-4 py-2 font-mono text-xs whitespace-nowrap">${attribute}</td>
            <td class="px-4 py-2 text-muted-foreground">
              ${AXIS_MEANING[attribute] ?? 'undocumented on this page'}
            </td>
            <td class="px-4 py-2 font-mono text-xs">${VOCABULARY[axis].join(' · ')}</td>
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

/** Every axis the package declares, counted rather than claimed. */
export function vocabularySize(): { axes: number; values: number } {
  const axes = Object.keys(AXIS_ATTRS).length;
  let values = 0;
  for (const axis of Object.values(AXIS_ATTRS)) values += VOCABULARY[axis].length;
  return { axes, values };
}

// ── Limits ────────────────────────────────────────────────────────────────

/**
 * Taken from `packages/intent/README.md` §Limits, not invented and not
 * softened. Every one of these is a thing the package does NOT yet prove, and
 * the site carries them on the same page as the claims because a page that
 * hides its counter-evidence is marketing.
 *
 * The wording is deliberately close to the README's: if the two ever disagree,
 * the README is the source and this is the bug.
 */
const LIMITS: readonly { title: string; body: string }[] = [
  {
    title: 'No SSG pre-solve',
    body: 'The static tier should resolve at build time and does not. Measured consequence: the flash of unfit is zero composited frames when client-rendered, but nine to ten frames — 69 to 87 milliseconds — against a 100-millisecond hydration budget. These pages are the first place that is measured through a real static build rather than argued about; the numbers are on /intent/comparison.',
  },
  {
    title: 'No byte budget',
    body: 'The measured tier has never been weighed minified and gzipped against core\u2019s ceiling.',
  },
  {
    title: 'Chromium only',
    body: 'No Firefox or WebKit run exists. Everything on these pages was measured in Chromium, including the checker output below.',
  },
  {
    title: 'Small surface',
    body: 'Four prototype pages exercised the vocabulary, plus these three. That is not a product.',
  },
  {
    title: 'Nothing about beauty',
    body: 'Derivation produces consistency; beauty is authored. The prototype\u2019s own first run resolved an avatar to a size both perfectly consistent and visually wrong, and a resolution table can be internally contradictory while every value in it looks reasonable.',
  },
  {
    title: 'One deferred case',
    body: 'Bare markup inside a flush surface, with no wrapper element to promote, is still clipped. The derived scroll region needs a component root to promote and the fit mutator only sets attributes today, so it cannot insert one. The rows on these pages ARE bare markup inside a flush surface, which is exactly the shape: it is no longer silent — N710 reports it — and that is the whole change so far.',
  },
  {
    title: 'Enforcement leaks, by measurement',
    body: 'The escape hatch for raw CSS exists and reports itself as N601 rather than being forbidden, because the industry\u2019s strictest enforcers carry hundreds of checked-in suppressions. A zero-escape claim is a marketing number; a reported escape is an engineering one.',
  },
];

export function LimitsSection(): TemplateResult {
  return html`<div>
    ${H2('Limits')}
    ${P(
      html`Taken from
      ${code('packages/intent/README.md')}
      rather than written for this page. These are things the package does
      <strong>not</strong> prove. If the README and this list ever disagree, the README is right and
      this is the bug.`,
    )}
    <dl class="mt-6 space-y-4">
      ${LIMITS.map(
        (limit) => html`<div class="rounded-lg border p-4">
          <dt class="font-semibold">${limit.title}</dt>
          <dd class="mt-1 leading-7 text-pretty text-muted-foreground">${limit.body}</dd>
        </div>`,
      )}
    </dl>
  </div>`;
}
