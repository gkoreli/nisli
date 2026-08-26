/**
 * intent/recorded.ts — THE CHECKER RUN, AS IT CAME BACK.
 *
 * Every number in this file was produced by driving the built site
 * (`dist/intent/comparison/index.html`, served over HTTP) in a real Chromium and
 * pressing the page's own "Run the checker" button — the same `runChecks()` a
 * reader presses, over the same two subtrees. Nothing here is a projection and
 * nothing was rounded in a favourable direction.
 *
 * It is recorded in the page rather than left to the button for two reasons: a
 * reader with scripting off still gets the result, and a recorded run is a
 * baseline that a later regression can be diffed against.
 *
 * IF YOU CHANGE `surface.ts`, `tailwind-surface.ts` OR `feed.ts`, THIS FILE IS
 * STALE. Re-run it before trusting it.
 */
import { html, type TemplateResult } from '@nisli/core';
import { code } from './prose.js';

/** One measured cell: a context, and what each half reported in it. */
interface Cell {
  /** Viewport × ruler × context, exactly as driven. */
  context: string;
  /** The width each half's rows actually got, in CSS pixels. */
  column: number;
  /** Menu collapses the engine spent, summed over the four intent rows. */
  collapsed: number;
  intent: string;
  tailwind: string;
}

const RUN: readonly Cell[] = [
  {
    context: 'viewport 1440 · ruler 720 · comfortable / pointer / light (the page default)',
    column: 346,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 5 · warn 0 · incomplete 0 — N660 × 4, N710 × 1',
  },
  {
    context: 'viewport 1440 · ruler 320',
    column: 318,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 5 · warn 0 · incomplete 0 — N660 × 4, N710 × 1',
  },
  {
    context: 'viewport 1440 · ruler page',
    column: 538,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 0 · warn 0 · incomplete 0',
  },
  {
    context: 'viewport 1440 · ruler 720 · comfortable / TOUCH / light',
    column: 346,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 5 · warn 0 · incomplete 0 — N660 × 4, N710 × 1',
  },
  {
    context: 'viewport 1440 · ruler 720 · DENSE / TOUCH / light',
    column: 346,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 5 · warn 0 · incomplete 0 — N660 × 4, N710 × 1',
  },
  {
    context: 'viewport 768 · ruler 720',
    column: 462,
    collapsed: 10,
    intent: 'fail 0 · warn 0 · incomplete 0',
    tailwind: 'fail 0 · warn 0 · incomplete 0',
  },
  {
    context: 'viewport 390 · ruler 720 (clamped to the page)',
    column: 340,
    collapsed: 10,
    intent: 'fail 1 · warn 0 · incomplete 0 — N630 × 1',
    tailwind: 'fail 1 · warn 0 · incomplete 0 — N630 × 1',
  },
];

/** Verbatim, from the worst cell. Not paraphrased and not shortened. */
const VERBATIM = `FAIL       N660 · div — crushed: content needs 491px but the box got 318px — 173px paints outside it
FAIL       N660 · div — crushed: content needs 464px but the box got 318px — 146px paints outside it
FAIL       N660 · div — crushed: content needs 459px but the box got 318px — 141px paints outside it
FAIL       N660 · div — crushed: content needs 433px but the box got 318px — 115px paints outside it
FAIL       N710 · div — this box clips and destroys 13 meaningful node(s)
                  (6 entirely, worst overhang 172.13px) — nothing scrolls and no
                  degradation was declared`;

/** Derived geometry, same five contexts, measured on both halves. */
interface GeometryRow {
  context: string;
  unit: string;
  floor: string;
  intentControl: string;
  intentAvatar: string;
  intentTitle: string;
  tailwindControl: string;
  tailwindAvatar: string;
  tailwindTitle: string;
}

const GEOMETRY: readonly GeometryRow[] = [
  {
    context: 'comfortable / pointer',
    unit: '4px',
    floor: '0px',
    intentControl: '95 × 36',
    intentAvatar: '32 × 32',
    intentTitle: '15px',
    tailwindControl: '85 × 32',
    tailwindAvatar: '36 × 36',
    tailwindTitle: '14px',
  },
  {
    context: 'comfortable / touch',
    unit: '5px',
    floor: '44px',
    intentControl: '107.1 × 45',
    intentAvatar: '40 × 40',
    intentTitle: '16.2px',
    tailwindControl: '85 × 32',
    tailwindAvatar: '36 × 36',
    tailwindTitle: '14px',
  },
  {
    context: 'compact / pointer',
    unit: '3px',
    floor: '0px',
    intentControl: '83.2 × 27',
    intentAvatar: '24 × 24',
    intentTitle: '14px',
    tailwindControl: '85 × 32',
    tailwindAvatar: '36 × 36',
    tailwindTitle: '14px',
  },
  {
    context: 'dense / pointer',
    unit: '2px',
    floor: '0px',
    intentControl: '71.4 × 18',
    intentAvatar: '20 × 20 (floor)',
    intentTitle: '12px',
    tailwindControl: '85 × 32',
    tailwindAvatar: '36 × 36',
    tailwindTitle: '14px',
  },
  {
    context: 'dense / touch',
    unit: '2.5px',
    floor: '44px',
    intentControl: '79 × 44 (exactly the floor)',
    intentAvatar: '20 × 20 (floor)',
    intentTitle: '12.96px',
    tailwindControl: '85 × 32',
    tailwindAvatar: '36 × 36',
    tailwindTitle: '14px',
  },
];

function Table(head: readonly string[], rows: readonly (readonly TemplateResult[])[]): TemplateResult {
  return html`<div class="mt-6 overflow-x-auto rounded-xl border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          ${head.map((h) => html`<th class="px-3 py-2 text-left font-medium whitespace-nowrap">${h}</th>`)}
        </tr>
      </thead>
      <tbody class="divide-y">
        ${rows.map((cells) => html`<tr>${cells.map((c) => html`<td class="px-3 py-2">${c}</td>`)}</tr>`)}
      </tbody>
    </table>
  </div>`;
}

export function RecordedRun(): TemplateResult {
  return html`<div>
    <p class="mt-4 leading-7 text-pretty">
      Seven cells, driven in Chromium against the built site, over the two subtrees this page
      renders. The intent half comes back clean in every cell. The Tailwind half comes back clean in
      three of them and reports <strong>five failures in four</strong> — and the three it passes are
      exactly the three where its assumption holds.
    </p>
    ${Table(
      ['context', 'column', 'engine spent', 'intent half', 'Tailwind half'],
      RUN.map((cell) => [
        html`<span class="font-mono text-xs">${cell.context}</span>`,
        html`<span class="font-mono text-xs">${String(cell.column)}px</span>`,
        html`<span class="font-mono text-xs">${String(cell.collapsed)}</span>`,
        html`<span class="font-mono text-xs">${cell.intent}</span>`,
        html`<span class="font-mono text-xs">${cell.tailwind}</span>`,
      ]),
    )}

    <p class="mt-6 leading-7 text-pretty">
      The worst cell, verbatim — viewport 1440, a 318px column, four rows:
    </p>
    <pre
      class="mt-3 overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
    >${VERBATIM}</pre>
    <p class="mt-4 leading-7 text-pretty">
      Read what those two codes are actually saying, because they are not the same complaint.
      ${code('N660')} is per element: each of the four Tailwind rows needed 433–491px of inline
      space and got 318, so 115–173px of each row paints outside its own box. ${code('N710')} is
      about the consequence: the card declares ${code('overflow-hidden')}, so that overhang is not
      merely ugly, it is <strong>deleted</strong> — 13 meaningful nodes destroyed, 6 of them
      entirely, worst overhang 172.13px, with nothing to scroll and no declaration saying the
      material was expendable.
    </p>
    <p class="mt-4 leading-7 text-pretty">
      The cause is one line of a competent stylesheet. ${code('hidden sm:inline')} and
      ${code('hidden sm:flex')} ask about the <em>viewport</em>, the viewport is 1440, so the
      timestamp, the note and both controls are all shown — inside a 318px container. The title is
      the only thing that can give, it is ${code('min-w-0 flex-1 truncate')}, so it gives all of
      itself, and then there is still nothing left to give. In the two cells where the column
      genuinely is about as wide as the window (538px at viewport 1440, 462px at viewport 768), the
      same code is clean. At viewport 390 it is clean too, and correctly so: there ${code('sm:')} is
      finally answering the question it was asked.
    </p>

    <h3 class="mt-8 text-lg font-semibold tracking-tight">The one failure on the intent half</h3>
    <p class="mt-4 leading-7 text-pretty">
      There was one, and it is not in the table above because it was fixed before the run — which
      would be exactly the kind of quiet edit this page exists to refuse, so here it is. The first
      version painted "Read" as ${code('data-role="primary"')} on every row, and the checker said:
    </p>
    <pre
      class="mt-3 overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
    >FAIL       N700 · div — 8 actions in one surface declare priority: button (primary) × 8
                  — attention cannot be spent twice</pre>
    <p class="mt-4 leading-7 text-pretty">
      Eight, for four buttons a reader can see. The other four are the twins inside the
      <em>closed</em> overflow panels, which exist by construction: the ${code('menu')} strategy
      keeps a collapsed action reachable by putting a copy in the panel. Measured: eight matched, four
      with 0×0 rects and ${code('checkVisibility()')} false. N700 selects through
      ${code('declared()')} rather than ${code('painted()')}, so <strong>any row declaring
      ${code('data-collapse="menu"')} doubles its own contribution to this rule.</strong>
    </p>
    <p class="mt-4 leading-7 text-pretty">
      The rule was still right about the design, and the prototype agrees with it — every per-row
      action in the C11 inbox is ${code('quiet')}, and its single ${code('primary')} is a toolbar
      button. A list is not a decision point. So both actions became quiet, on
      <strong>both halves</strong>, because a comparison whose halves are different designs is not a
      comparison. Note which direction that fix travelled: a machine found it on the declared half,
      and it was then hand-applied to the Tailwind half, where nothing would ever have mentioned it.
    </p>

    <h3 class="mt-8 text-lg font-semibold tracking-tight">
      What the checker never reported, and this page has to
    </h3>
    <p class="mt-4 leading-7 text-pretty">
      The most expensive defect found while building these three pages was found by
      <em>looking</em>, and no shipped rule reports it. With the prototype's own row shape —
      ${code('row > stack[data-grow] > title')} — the grow region shrinks to its own min-content,
      which because ${code('roles.css')} makes text ${code('white-space: normal')} is its
      <em>longest word</em>, and the title wraps. Wrapping converts inline overflow into block
      growth, and the engine's overflow predicate is inline-only.
    </p>
    <p class="mt-4 leading-7 text-pretty">
      Measured at a 346px container: the grow region collapsed to <strong>86.3px</strong> — the width
      of the word "appearance" — the title rendered ten words down a 131px-tall column, the row was
      <strong>371px tall where 36px was intended</strong>, and the row reported
      ${code('data-fit="settled"')}, ${code('data-collapsed-count="0"')}, scrollWidth 346 ===
      clientWidth 346, and ${code('check()')} returned <strong>PASS · no findings</strong>. N660 is
      silent (no crush — the box got the min-content it asked for), N690 is silent (ten words on ten
      lines is a wrap, not a shred), N620 is silent (the row settled). That is F8's exact shape — a
      container satisfied while its content is destroyed — reappearing in the axis nothing measures.
    </p>
    <p class="mt-4 leading-7 text-pretty">
      The row on this page therefore carries <strong>no ${code('data-grow')} at all</strong>, and
      exactly <strong>one ${code('truncate')} candidate</strong>. The second rule came from the same
      session: with the title (priority 3) and the note (priority 5) both truncating, flexbox
      distributes the surviving space by flex basis — max-content width — so the <em>less</em>
      important string kept more pixels. Measured at 538px: titles rendered "AD…", "@ni…", "@nisl…",
      "C11…" while each note still read "Appearanc…". ${code('data-priority')} orders <em>when</em> a
      strategy is spent; nothing orders <em>how much</em> the survivors keep. Neither rule is in the
      package's documentation, and both should be.
    </p>

    <h3 class="mt-8 text-lg font-semibold tracking-tight">One unit, five contexts, measured</h3>
    <p class="mt-4 leading-7 text-pretty">
      The checker's scoreboard is not the whole difference, so here is the other half of it. Same two
      halves, same rows, five contexts, geometry read out of the live document. The Tailwind column
      is identical in all five — because its values were typed.
    </p>
    ${Table(
      [
        'context',
        '--intent-unit',
        'target floor',
        'intent control',
        'intent avatar',
        'intent title',
        'Tailwind control',
        'Tailwind avatar',
        'Tailwind title',
      ],
      GEOMETRY.map((row) => [
        html`<span class="font-mono text-xs whitespace-nowrap">${row.context}</span>`,
        html`<span class="font-mono text-xs">${row.unit}</span>`,
        html`<span class="font-mono text-xs">${row.floor}</span>`,
        html`<span class="font-mono text-xs whitespace-nowrap">${row.intentControl}</span>`,
        html`<span class="font-mono text-xs whitespace-nowrap">${row.intentAvatar}</span>`,
        html`<span class="font-mono text-xs">${row.intentTitle}</span>`,
        html`<span class="font-mono text-xs whitespace-nowrap">${row.tailwindControl}</span>`,
        html`<span class="font-mono text-xs whitespace-nowrap">${row.tailwindAvatar}</span>`,
        html`<span class="font-mono text-xs">${row.tailwindTitle}</span>`,
      ]),
    )}
    <p class="mt-4 leading-7 text-pretty">
      Two rows of that table are the argument. In a <strong>touch</strong> context the declared floor
      is 44px: the intent control derives 45 at comfortable and lands on exactly 44 at dense — the
      authored floor, not below it — while the Tailwind control stays 32px high in both, which is a
      real WCAG 2.5.8 failure. <strong>N650 exists for precisely that and cannot see it</strong>: it
      selects ${code('[data-appearance="action"]')}, which is a word only intent writes. The
      Tailwind half is not clean there. It is unobserved there, and those are different facts.
    </p>
    <p class="mt-4 leading-7 text-pretty">
      One more honesty note on the ${code('N630')} row at viewport 390: that finding is the
      <em>document</em> being 435px wide in a 390px viewport, so it appears in <em>both</em> reports
      identically — N630 is the one rule that reads the document rather than the scope it was given.
      It is this page's own chrome overflowing, not either surface, and it is left in the table rather
      than filtered out, because a checker output you have edited is not a checker output.
    </p>
  </div>`;
}
