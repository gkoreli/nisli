/**
 * intent/bodies.ts — the three driveable surfaces, as pure functions.
 *
 * ONE SOURCE, TWO LIVES. The static build renders these directly, so the SSG
 * output carries the full declared tier and is readable with scripting off; then
 * `client/hydrate.ts` replace-mounts `island.ts`, which renders THE SAME
 * FUNCTIONS inside a component that calls `fit(host)`. So the static DOM and the
 * hydrated DOM differ by exactly one thing — the solved state the engine wrote —
 * which is the only way a before/after measurement of the missing SSG pre-solve
 * means anything.
 *
 * It is also what makes the Tailwind control's classes exist at all:
 * `src/styles/input.css` scans `dist/**\/*.html`, so a utility that appears only
 * inside a client-mounted template is never emitted. The static baseline is not
 * a courtesy here, it is load-bearing.
 *
 * DOM-free (ADR 0026 §8): no `component()`, no `HTMLElement`. The signals in
 * `harness.ts` are read at their initial values by the static render, which is
 * why the static baseline shows the default context rather than an empty frame.
 */
import { html, type TemplateResult } from '@nisli/core';
import { CheckReport, NeutralityTable, RunChecksButton, type ScopeId } from './checker.js';
import { FEED } from './feed.js';
import {
  comparisonRuler,
  ContextScope,
  ContextSwitchers,
  playgroundRuler,
  Ruler,
  siteThemeClass,
} from './harness.js';
import { Caption, code, H3, P } from './prose.js';
import { IntentFeed, IntentFeedSample } from './surface.js';
import { TailwindFeed } from './tailwind-surface.js';

/** The one row on /intent. Fixed context, nothing to drive. */
export function pitchSampleBody(): TemplateResult {
  return IntentFeedSample(FEED[0]!, 'pitch');
}

/**
 * /intent/playground — four switchers over ONE surface that never changes.
 *
 * The surface is rendered exactly once. Every visible difference as the reader
 * presses these buttons comes from the context and the space, never from a
 * second code path: there is no narrow variant of this row, and if you grep
 * `surface.ts` for a width you will not find one.
 */
export function playgroundBody(): TemplateResult {
  return html`<div class="space-y-6">
    <div class="rounded-xl border p-4">${ContextSwitchers(playgroundRuler)}</div>
    ${Ruler(playgroundRuler, ContextScope(IntentFeed(FEED, 'playground')))}
  </div>`;
}

/** One labelled half of the comparison. The scope attribute is what the checker
 *  runs over, so the two verdicts are about two disjoint subtrees. */
function Half(
  scope: ScopeId,
  heading: string,
  subtitle: TemplateResult,
  content: TemplateResult,
): TemplateResult {
  return html`<section>
    <div class="mb-3">
      <h3 class="text-base font-semibold tracking-tight">${heading}</h3>
      <p class="mt-1 text-sm text-muted-foreground">${subtitle}</p>
    </div>
    <div data-check-scope=${scope}>${content}</div>
  </section>`;
}

/**
 * /intent/comparison — the same surface twice, in the same page, at the same
 * width, in the same context.
 *
 * THE FRAME IS A CONTAINER QUERY, NOT A BREAKPOINT, and that is not a style
 * preference: the ruler resizes the frame without touching the viewport, so a
 * `lg:` frame would keep two columns at a 320-wide ruler and the comparison
 * would be measuring the frame instead of the surfaces. Tailwind v4's own
 * `@container` variants do it correctly, which is worth noticing — the
 * capability the Tailwind control is missing is a capability Tailwind HAS.
 *
 * The frame is deliberately NOT `data-layout="grid"`. `roles.css:352` is
 * `[data-layout='grid'] [data-text]`, a DESCENDANT selector granting
 * `overflow-wrap: anywhere` and `min-inline-size: 0` — so a grid anywhere up the
 * tree would release the crush protection on every `[data-text]` inside every
 * row below it, including rows in nested fit containers that are not grid items.
 * An intent-authored frame would have changed the intent half's behaviour and
 * nothing else's, which is the definition of a rigged comparison.
 *
 * `grid-cols-1` is NOT redundant, and leaving it out was a real bug in this
 * frame. A grid container with no `grid-template-columns` sizes its single
 * implicit `auto` track by MAX-CONTENT, and max-content is not clamped by the
 * container: measured here at a 320px ruler, the track and the row inside it
 * were 1339px wide — the whole page — while the fit engine correctly reported
 * `settled` for a row that had all the space in the world. Tailwind's
 * `grid-cols-1` emits `repeat(1, minmax(0, 1fr))`, which clamps. Recorded
 * because a comparison whose frame silently hands one half the wrong width
 * measures nothing, and because it is the same failure the checker exists to
 * catch, one level out: a correct measurement of the wrong thing.
 */
export function comparisonBody(): TemplateResult {
  return html`<div class="space-y-6">
    <div class="rounded-xl border p-4">
      ${ContextSwitchers(comparisonRuler)}
      <div class="mt-4 flex flex-wrap items-center gap-3">
        ${RunChecksButton()}
        <span class="text-sm text-muted-foreground">
          Runs the fifteen shipped rules over each half separately, in this browser, right now.
        </span>
      </div>
    </div>

    ${Ruler(comparisonRuler, html`<div class="@container">
      <div class="grid grid-cols-1 gap-6 @2xl:grid-cols-2">
        ${Half(
          'intent',
          'Declared in the intent vocabulary',
          html`${code('src/intent/surface.ts')} — zero pixel values, zero colours, zero
          breakpoints, zero class names.`,
          ContextScope(IntentFeed(FEED, 'comparison')),
        )}
        ${Half(
          'tailwind',
          'Authored the way this site is authored',
          html`${code('src/intent/tailwind-surface.ts')} — Tailwind utilities, hand-picked values,
          and one ${code('sm:')} breakpoint.`,
          html`<div class=${siteThemeClass}>${TailwindFeed(FEED)}</div>`,
        )}
      </div>
    </div>`)}
    ${Caption(
      html`Both halves render the same four entries from ${code('src/intent/feed.ts')}, sit in the
      same context, and get the same width from the same ruler. The intent half additionally
      receives ${code('data-density')} and ${code('data-input')}, because it is the only one of the
      two that can express them — that is the finding, not a handicap.`,
    )}

    <div class="grid gap-6 md:grid-cols-2">
      ${CheckReport('intent', 'Checker · intent half')}
      ${CheckReport('tailwind', 'Checker · Tailwind half')}
    </div>

    ${H3('Which rules could possibly have fired')}
    ${P(
      html`Read this before reading the verdicts, because a clean report means two very different
      things depending on the row. A rule addresses the DOM through a selector, so whether it can
      see the Tailwind half is decided there and nowhere else. Four of the fifteen select
      ${code('*')} or the document; the other eleven select intent's own vocabulary and are
      structurally blind to any other authoring style. Every line below cites the source.`,
    )}
    ${NeutralityTable()}
  </div>`;
}
