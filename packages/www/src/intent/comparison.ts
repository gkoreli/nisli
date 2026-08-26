/**
 * intent/comparison.ts — /intent/comparison. THE deliverable.
 *
 * The same surface twice — once authored the way the rest of this site is
 * authored, once declared in the intent vocabulary — side by side, in the same
 * page, in the same context, at the same width. Then the checker runs over BOTH
 * and the page prints what it found.
 *
 * ── THE RULE THIS PAGE IS WRITTEN UNDER ────────────────────────────────────
 * Report honestly whichever way it goes. The Tailwind half is authored the way a
 * competent developer would actually write it, with the utilities this site
 * already uses, and it was not touched after the checker ran. Where it is clean,
 * this page says it is clean. Where the checker cannot see it at all, this page
 * says THAT, in the most prominent place it can, because "no findings" and
 * "no rule looked" are the pair this whole package exists to stop confusing —
 * and the second one is the answer that came back.
 */
import { html, type TemplateResult } from '@nisli/core';
import { comparisonBody } from './bodies.js';
import { RecordedRun } from './recorded.js';
import { Bullets, Caption, code, H2, H3, Lead, LimitsSection, Note, P, Title } from './prose.js';

export function intentComparisonPage(): TemplateResult {
  return html`<div class="w-full">
    ${Title('The same surface, twice')}
    ${Lead(
      'One feed, two authoring styles, one context, one width — and a checker run over both halves. This page is the experiment, not the pitch, so it reports what came back rather than what would have been convenient.',
    )}
    ${P(
      html`The left half is declared in the intent vocabulary
      (${code('src/intent/surface.ts')}). The right half is Tailwind utilities with hand-picked
      values and one ${code('sm:')} breakpoint (${code('src/intent/tailwind-surface.ts')}) — the way
      every other page on nisli.dev is written. Both render the same four entries from the same
      module. Drive the switchers, then press <em>Run the checker</em>.`,
    )}

    <div class="mt-8" data-hydrate="intent" data-intent="comparison">${comparisonBody()}</div>

    ${H2('The result, and it is not the one a pitch would have wanted')}
    ${RecordedRun()}

    ${H2('Reading that honestly')}
    ${H3('1. The Tailwind half is well-authored, and it is not rigged')}
    ${P(
      html`Every utility in it is one this site already uses on a real page:
      ${code('min-w-0 flex-1 truncate')} on the identity so it is the thing that gives way and the
      loss has an ellipsis as its receipt, ${code('shrink-0')} on the mark, the note, the timestamp
      and the action strip so nothing gets crushed, ${code('size-8')} and ${code('h-8')} for
      controls, ${code('divide-y')} for the rules between rows, and ${code('hidden sm:inline')} /
      ${code('hidden lg:inline')} / ${code('hidden sm:flex')} to drop the optional parts on small
      screens. A reviewer would pass it. <strong>Nothing about it was changed after the checker
      ran</strong> — the only edit it received was demoting its buttons to quiet, which was a
      finding on the OTHER half and was applied to both so the designs stayed identical.`,
    )}

    ${H3('2. Only four of the fifteen rules can see it — so the failures are a floor, not a total')}
    ${P(
      html`This is the load-bearing correction, and it goes against the summary this experiment
      started from. Eleven of the fifteen shipped rules address intent's vocabulary in their
      selector, so they are structurally blind to any other authoring style — including three that
      are easy to assume are purely geometric: N650 selects
      ${code('[data-appearance="action"]')}, N670 selects ${code('[data-layout="row"] > *')}, N690
      selects ${code('[data-text]')}. Each measures geometry, and each can only find the element to
      measure through a word only intent writes. Only N630, N660, N710 and N713 select
      ${code('*')} or the document. The table above cites the source line for every one.`,
    )}
    ${Note(
      'Which cuts in the direction you might not expect',
      html`The five failures on the Tailwind half were found by <strong>two rules</strong>. Eleven
      others never looked, and at least one of them had something to say: in the touch cells the
      Tailwind control measures 32px against a declared 44px floor, which is what N650 exists for and
      which N650 cannot reach. So "fail 5" is a lower bound. The same asymmetry is why the intent
      half's clean sheet is worth more than the Tailwind half's three clean cells — fifteen rules
      looked at one and four looked at the other.`,
    )}

    ${H3('3. Where the Tailwind half is clean, it is genuinely clean')}
    ${P(
      html`Three of the seven cells came back with nothing, and they are not accidents: a 538px
      column at a 1440 viewport, a 462px column at 768, and the whole page at 390. In all three the
      container is about as wide as the window, which is the condition ${code('sm:')} was written
      under. At viewport 390 in particular the breakpoint does exactly its job — the actions and the
      timestamp go, the row fits, the checker is silent, and it deserves to be. Any account of this
      page that leaves those three cells out is marketing.`,
    )}
    ${P(
      html`Tailwind is not at fault for the other four either, and it is not news — it is why
      container queries exist, and Tailwind v4 ships ${code('@container')} variants for it
      (${code('@nisli/ui')}'s own ${code('form-field.ts')} and ${code('card.ts')} use them; the
      frame holding these two halves uses them too, because a viewport breakpoint there would have
      broken the ruler). A developer who reached for those would fix that half of it.`,
    )}
    ${H3('4. What a @container rewrite would and would not fix')}
    ${Bullets([
      html`<strong>Fixed:</strong> the timestamp and actions would drop at the right time, because
      the query would finally be about the row's own box.`,
      html`<strong>Not fixed:</strong> the width at which they drop is still a number somebody typed,
      and it is still a guess about a design intent rather than the intent itself.`,
      html`<strong>Not fixed:</strong> the ORDER is still implied by markup rather than declared.
      There is nowhere in the Tailwind half to say "the note is worth less than the title", so
      changing the priority means editing the row.`,
      html`<strong>Not fixed:</strong> collapsed actions have nowhere to go. Intent's
      ${code('menu')} strategy moves them into an overflow panel and counts them;
      ${code('hidden')} deletes them, and a deleted action is not a degraded action.`,
      html`<strong>Not fixed:</strong> density and input mode. The row still cannot know that it is
      in a dense panel or under a thumb, because there is no site-wide mechanism to tell it. That is
      the asymmetry the switchers above make visible, and it is the reason the intent half receives
      ${code('data-density')} and ${code('data-input')} while the Tailwind half receives only the
      theme.`,
      html`<strong>Not fixed, and this is the one that matters most:</strong> none of it becomes
      checkable. Eleven rules stay blind, because what they need is not a container query — it is a
      declaration to measure against.`,
    ])}

    ${H2('So does the comparison favour intent?')}
    ${P(
      html`Yes, and by more than expected — and the honest version of that sentence has three
      qualifications attached, all of them above. On the four rules that can see both halves, the
      intent half is clean in all seven cells and the Tailwind half fails five findings in four of
      them, destroying up to 172px of content per row with nothing to scroll. That is a real result
      from a control nobody touched afterwards.`,
    )}
    ${P(
      html`The qualifications. <strong>One:</strong> eleven rules never looked at the control, so the
      scoreboard is a floor on one side and a full accounting on the other, and those cannot be
      compared as if they were the same measurement. <strong>Two:</strong> in the three cells where
      the control's assumption holds, it is clean, and its assumption holds on most real pages.
      <strong>Three:</strong> the single most damaging defect found in this whole exercise was on the
      INTENT half, it was found by a human looking at a screen, and no rule reported it — a row 371px
      tall that every mechanism called settled.`,
    )}
    ${P(
      html`What the package actually claims is narrower than the scoreboard, and it is the part that
      survives all three qualifications. The intent half's behaviour was <strong>declared</strong> —
      one source, no width in it, correct in a slot it never heard of, degrading in an order its
      author chose — and a machine can therefore be asked whether it is right. The Tailwind half's
      behaviour was <strong>typed</strong>: correct exactly where its assumptions hold, and with
      nothing for a machine to check it against, so the four failing cells were only discoverable
      here because a page put the same content next to a declared version of itself. That difference
      is the whole product, and it is smaller and stranger than a marketing page would make it.`,
    )}
    ${Caption(
      html`Counter-evidence kept where it can be found: everything above was measured in Chromium
      only, in the closed document, with the overflow panels shut. The panel sweep that found 24 of
      240 prototype cells failing N710 cannot be reproduced from this package's public surface —
      its driver is not exported. That is a gap in the package, recorded here rather than omitted.`,
    )}

    ${LimitsSection()}
  </div>`;
}
