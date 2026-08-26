/**
 * intent/playground.ts — /intent/playground. The demonstration that carries the
 * whole idea.
 *
 * ONE component, four switchers, and no second code path. The row is written
 * once in `surface.ts` and rendered once here; everything the reader sees change
 * is the context and the space. If the page has to be believed on one thing, it
 * is that: grep `surface.ts` for a width and there is not one.
 */
import { html, type TemplateResult } from '@nisli/core';
import { playgroundBody } from './bodies.js';
import { code, Caption, H2, H3, Lead, LimitsSection, Note, P, Title } from './prose.js';

export function intentPlaygroundPage(): TemplateResult {
  return html`<div class="w-full">
    ${Title('The same declaration, everywhere')}
    ${Lead(
      'Density, input mode, theme and width, over one component that never changes. Nothing below re-renders a narrow variant, because there is no narrow variant to render.',
    )}
    ${P(
      html`The row comes from ${code('src/intent/surface.ts')}. It declares what each part IS, how
      the parts compose, and — the part that does the work — what matters LEAST. It declares no
      width, no breakpoint, no class and no colour. Press the buttons and watch it stay correct.`,
    )}

    <div class="mt-8" data-hydrate="intent" data-intent="playground">${playgroundBody()}</div>

    ${Caption(
      html`The surface above is rendered by the static build and is correct with scripting off — the
      static tier is custom properties and container queries, and no JavaScript participates in it.
      The <em>switchers</em> and the measured pass need JavaScript, so with JS disabled you get the
      row in its default context and no degradation. That split is the package's own claim, and this
      is the first place it is visible in a real static build.`,
    )}

    ${H2('What you are actually watching')}
    ${H3('Width does not resolve through a breakpoint')}
    ${P(
      html`The row is inside ${code('data-fit')}, which is also a query container, so every value
      inside resolves against the space the row was GIVEN. Set the width to 360 and the row degrades
      — while the browser window has not moved. That is the difference between a container and a
      viewport, and it is why the same declaration is correct in a full-bleed page column and in a
      sidebar.`,
    )}

    ${H3('The order things are given up in was declared, not chosen by a width')}
    ${P(
      'Narrow it one step at a time and the sequence is always the same, because the sequence is a property of the row and not of the width: the excerpt truncates and the unread dot goes (both declared least, priority 5), then the timestamp (4), then the title starts to ellipsise (3), then the secondary action moves into the overflow menu (2). The primary action is never lost, because nothing ever declared it least.',
    )}
    ${Note(
      'Why the timestamp HIDES rather than truncating',
      html`It was ${code('truncate')} in the prototype's first run, and at the narrowest measured
      width the timestamps degraded to "1…", "Y…", "M" — technically fitting, and useless. A time is
      an ATOMIC value: it is either readable or it should be gone. The engine did exactly what it was
      told; the author had picked a strategy that only makes sense for prose. The fix was a rung on
      the ladder, not a width.`,
    )}

    ${H3('Density and input mode are contexts, not media queries')}
    ${P(
      html`${code('compact')} and ${code('dense')} change one number —
      ${code('--intent-unit-base')} — and every spacing, radius and type value in the row is a
      multiple of it. ${code('touch')} multiplies that unit and installs a hit-target floor, so WCAG
      2.5.8 becomes a property of the context rather than something every control's author has to
      remember. Set <em>dense</em> and <em>touch</em> together: the axes compose by multiplication,
      and the result lands on the authored floor rather than below it — which is a thing a single
      flat table of variants would have had to enumerate.`,
    )}

    ${H3('The dashed red outline, if you ever see it')}
    ${P(
      html`That is ${code('data-fit="unsatisfiable"')}: the solver spent every declared degradation
      and the content still does not fit. It is drawn rather than tolerated, because that is an
      authoring defect — the row did not declare enough that it was willing to lose. The checker
      reports the same thing as N620, and
      <a class="font-medium underline" href="/intent/comparison">the comparison page</a> runs it.`,
    )}

    ${H2('What is not being demonstrated')}
    ${P(
      html`The row is handsome or it is not, and derivation had nothing to do with that. Derivation
      produces <strong>consistency</strong> — every value in the row is a function of one unit, so
      nothing is off by a pixel someone typed — and consistency is not beauty. The prototype's own
      first run resolved an avatar to a size that was perfectly consistent and visually wrong.`,
    )}

    ${LimitsSection()}
  </div>`;
}
