/**
 * intent/pitch.ts — /intent. What the package does and why anyone should care.
 *
 * Marketing-shaped, so it renders in SiteShell alone (like /themes). The claim
 * it makes is the author's own: the layout just works — no pixel values, no
 * breakpoints, no class names, and it is correct in every context anyway.
 *
 * The page is also careful about one thing on purpose. The idea "solve layout in
 * JavaScript" is dead and the graves are marked, so the third tier is introduced
 * by what it is NOT before it is introduced by what it is. A reader who has met
 * Grid Style Sheets will otherwise stop reading, correctly.
 */
import { html, type TemplateResult } from '@nisli/core';
import { CodeBlock } from '../components/code-block.js';
import { pitchSampleBody } from './bodies.js';
import {
  Bullets,
  Caption,
  code,
  H2,
  H3,
  Lead,
  LimitsSection,
  Note,
  P,
  Title,
  VocabularyTable,
  vocabularySize,
} from './prose.js';
// The shown source IS the module that typechecks (WWW-8), so the example on the
// page cannot drift from an example that compiles.
import rowSrc from './snippet-row.ts?raw';

const THEME_IMPORT = `/* the resolution table, imported once at the entry stylesheet */
@import '@nisli/intent/theme.css';`;

const CONTEXT_DECLARATION = `<!-- the context axes nest and inherit like any other context, so a dense
     panel inside a comfortable page just works -->
<body data-theme="dark" data-density="compact" data-input="touch">`;

/** Tier rows. Text sourced from the package's own barrel doc and README. */
const TIERS: readonly { tier: string; who: string; scope: string }[] = [
  {
    tier: 'static, zero runtime',
    who: 'custom properties + container queries',
    scope: 'density, rhythm, type scale, colour, elevation, radius',
  },
  {
    tier: "the browser's own solvers",
    who: 'flex, grid, clamp(), text-wrap, field-sizing, anchor positioning + position-try',
    scope: 'it is already a solver; the job is to stop fighting it',
  },
  {
    tier: 'measured, bounded',
    who: 'about thirty-five lines',
    scope: 'discrete choices only: what collapses, truncates, moves to a menu',
  },
];

function TierTable(): TemplateResult {
  return html`<div class="mt-6 overflow-x-auto rounded-xl border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-4 py-2 text-left font-medium">tier</th>
          <th class="px-4 py-2 text-left font-medium">who solves it</th>
          <th class="px-4 py-2 text-left font-medium">scope</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        ${TIERS.map(
          (row) => html`<tr>
            <td class="px-4 py-2 font-medium whitespace-nowrap">${row.tier}</td>
            <td class="px-4 py-2 font-mono text-xs text-muted-foreground">${row.who}</td>
            <td class="px-4 py-2 text-muted-foreground">${row.scope}</td>
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

export function intentPitchPage(): TemplateResult {
  const { axes, values } = vocabularySize();

  return html`<div class="mx-auto max-w-4xl px-6 py-12 sm:py-16">
    ${Title('@nisli/intent')}
    ${Lead(
      'Appearance derived from declared meaning and context. A component says what a thing is, how it composes, and what matters least; the engine derives every value from one inherited unit plus the context the element sits in, and then checks the result.',
    )}
    ${P(
      html`The promise, in the author's terms: <strong>no pixel values, no breakpoints, no class
        names — and it is correct in every context anyway.</strong> Not correct because someone
      picked good numbers, but correct because a machine measured it and can say so.`,
    )}
    ${P(
      html`${code('@nisli/core')} stays the minimal reactive runtime with no CSS. This is its
      permanent peer — the framework half. Two pages carry the evidence rather than the pitch:
      <a class="font-medium underline" href="/intent/playground">the live surface</a>, where one
      declaration is driven through every context, and
      <a class="font-medium underline" href="/intent/comparison">the comparison</a>, where the same
      row is authored twice and a checker is run over both.`,
    )}

    ${H2('The smallest honest example')}
    ${P('Import the resolution table once, at the entry stylesheet:')}
    ${CodeBlock(THEME_IMPORT, { file: 'src/styles/input.css' })}
    ${Note(
      'This site could not follow its own advice, and that is the strongest Limit the dogfood produced',
      html`nisli.dev does <strong>not</strong> import the table into its entry stylesheet. It ships it
      as a second bundle, linked only by the pages that declare the vocabulary, and the reason is
      measured rather than cautious. A site-wide import was written and built first, then diffed
      computed style element by element: it changed
      <strong>5,762 properties across 3,584 elements on nine pages</strong>, with zero changed
      bounding boxes. Both causes are <em>shared names in a global namespace</em>, which is the
      hazard a resolution table carries that a class-name system does not.`,
    )}
    ${Note(
      'Cause one: a token name. Fixed at the source.',
      html`intent declared ${code('--radius')} on a universal selector — deliberately, because a
      custom property is substituted where it is DECLARED, so freezing the derived tokens on
      ${code(':root')} would stop the density axes composing at all. This site's own component layer
      declares ${code('--radius')} on ${code(':root')} and derives its whole corner ramp from it, so
      a universal re-declaration shadowed the inherited value on every element and every rounded
      corner on the site tightened. Closed by namespacing every intent token to
      ${code('--intent-*')}; co-residence on these three pages now measures
      <strong>zero changed properties across 1,665 chrome elements</strong>, self-tested by
      disabling the bundle and confirming these surfaces lose everything while the chrome's own
      ${code('--radius')} is untouched in both states.`,
    )}
    ${Note(
      'Cause two: an attribute name, and the mechanism outlives the fix',
      html`${code("[data-align='start'|'center'|'end'|'between']")} paints ${code('align-items')} in
      a cascade layer. Layers beat specificity and layer order is fixed by first declaration, so
      intent's layers land after Tailwind's ${code('utilities')} and intent wins over any
      ${code('items-*')} utility on the same node. ${code('@nisli/ui')} writes those exact attribute
      values at 22 call sites as a pure animation hook, never as a layout instruction — so an
      attribute that means nothing on one side is load-bearing on the other. Worse, the merged
      bundle carries <strong>six</strong> ${code('[data-align]')} rules and two of them are the
      site's own: the word is contested by two libraries painting different properties off it.
      Blame-tested cost when the table was loaded site-wide — stripping only intent's four
      declarations and re-measuring — <strong>11 changed properties on 8 elements across three
      component pages, and zero changed bounding boxes</strong>, every one of them
      ${code('align-items')} flipping from ${code('normal')}. A first pass reported this as 39
      properties and 17 boxes including a collapsed scroller; that was retracted after a blame
      test, because it paired a stale build with fresh CSS and measured a document the stylesheet
      was never built for. The retraction is left here on purpose: the mistake was checkable from
      the declaration alone, since ${code('align-items')} cannot resize a row's block size. The
      resolution is to make the rule compound — ${code("[data-layout][data-align='...']")} — so it
      only reaches nodes that also declared a composition, which nothing in the chrome does. The
      general lesson is the durable part and it is not closed by one selector:
      <strong>every rule in the table is a claim on a name in a namespace the table does not
      own</strong>, and three of this package's widest rules
      (${code('[data-layout] *')}, ${code("[data-layout='grid'] [data-text]")}, and this one) reach
      by descendant rather than by declaration.`,
    )}
    ${P('Declare a context anywhere in the tree:')}
    ${CodeBlock(CONTEXT_DECLARATION, { file: 'index.html' })}
    ${P('Then a component declares only meaning, and registers the measured pass in one line:')}
    ${CodeBlock(rowSrc, { file: 'src/feed-row.ts' })}
    ${P(
      html`That is the whole authoring surface. ${code('data-fit')} marks the container the measured
      pass owns — it is also a query container, so everything inside resolves against the space it
      was actually given rather than against the viewport. There is no ${code('size')} prop and no
      class-name prop to reach for, and the exclusivity is not tidiness: it is what makes
      derivation, checking, consistency and provenance possible at all.`,
    )}

    ${H3('Rendered, live, from a declaration like that one')}
    ${P(
      html`One row, one context, nothing to drive. The static markup below arrives from the static
      build with its declarations and no solved state; the measured pass attaches on hydration and
      writes its verdict onto the container. Drive it on
      <a class="font-medium underline" href="/intent/playground">the playground</a>.`,
    )}
    <div class="mt-6" data-hydrate="intent" data-intent="pitch-row">${pitchSampleBody()}</div>
    ${Caption(
      html`Nothing in that row's source is a number, a colour or a class. Inspect it: every
      attribute on it is either ${code('data-*')} vocabulary or one of four structural
      declarations.`,
    )}

    ${H2('The vocabulary, in full')}
    ${P(
      html`${String(axes)} attributes, ${String(values)} legal values, and that is the entire
      surface an author writes. The table below is rendered from the package's own two frozen tables
      — ${code('VOCABULARY')} says what the legal values are, ${code('AXIS_ATTRS')} says where they
      are written — so this page cannot advertise a word the seam does not have. That is a real
      hazard rather than a hypothetical: a shipped rule once spelled a word the vocabulary does not
      contain, matched nothing, reported a clean page, and every gate agreed.`,
    )}
    ${VocabularyTable()}
    ${P(
      html`Four more declarations are structural rather than axes: ${code('data-fit')} (the
      container the measured pass owns), ${code('data-grow')} (which child absorbs the slack),
      ${code('data-priority')} (1 survives longest, 5 goes first) and ${code('data-collapse')} —
      which is in the table above, because what to do when space runs out is a closed vocabulary
      too.`,
    )}

    ${H2('Three tiers, and the third one stays small')}
    ${TierTable()}
    ${P(
      html`When the row stops fitting, the least important declaration is spent first: the timestamp
      hides, the title truncates, secondary actions move to an overflow menu. The primary action is
      never lost, because nothing ever declared it least.`,
    )}

    ${H3('This is NOT a layout solver in JavaScript, and the graves are marked')}
    ${P(
      html`That idea has been tried and it is dead, so the third tier has to be introduced by what
      it is not.`,
    )}
    ${Bullets([
      html`<strong>Grid Style Sheets</strong> shipped a Cassowary constraint solver to the browser in
      2014. The repository is <strong>archived</strong>, and its own issues asking
      <em>"is this dead?"</em> were never answered.`,
      html`<strong>Flutter's architecture document rejects constraint solving by name</strong> —
      <em>"O(N²) or worse (for example, fixed-point iteration in some constraint domain)"</em> — and
      documents its one speculative-measurement widget as <em>"avoid using it where possible"</em>.`,
    ])}
    ${P(
      html`Tier three is a bounded loop over a declared priority list. It spends degradations in the
      author's order until the container fits, and stops. It makes <strong>discrete</strong> choices
      only — what collapses, what truncates, what moves to a menu — never a continuous one, and it
      is about thirty-five lines including its lifecycle. If it ever grows into a constraint system,
      it has become the thing that already failed.`,
    )}
    ${P(
      html`Everything resolves to native output: ${code('data-*')} attributes, custom properties,
      ${code('@container')}, real custom elements. No virtual DOM, no runtime style injection, no
      generated class names. The static tier needs no JavaScript at all, which is why the two pages
      after this one are worth reading: they are the first time that claim has been put through a
      real static build.`,
    )}

    ${H2('Why derive appearance at all')}
    ${P(
      html`Because an agent writing UI code <strong>cannot see what it made</strong>. Every other
      class of mistake it makes is caught by a machine in seconds — a typo, a type error, a failing
      test. Appearance mistakes are caught only by a human looking at a screen, hours later, if at
      all.`,
    )}
    ${P(
      html`Because appearance here is derived from a declaration rather than typed by hand, it can
      be asserted over. ${code('check()')} answers <em>"is this UI wrong"</em> without a screenshot,
      a baseline image or a human — and
      <a class="font-medium underline" href="/intent/comparison">the comparison page</a> runs it in
      your browser, over both halves, and prints what it found.`,
    )}
    ${Note(
      'The honest headline from building it',
      html`Eight of the fourteen defects found were in the <strong>oracle</strong>, not the page. An
      appearance checker is easy to write and hard to make truthful. One rule shipped dead: its
      selector spelled a word the vocabulary does not contain, so it matched nothing, reported a
      clean page, and every gate agreed. Silence read as success.`,
    )}

    ${LimitsSection()}
  </div>`;
}
