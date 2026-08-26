/**
 * shell.ts — the harness around the canvas.
 *
 * The harness is not part of the mechanism under test. It owns page navigation,
 * the context switches, the simulated viewport and the findings readout —
 * and it deliberately owns NOTHING inside `#canvas`. That div carries no
 * attributes and no styles: everything painted inside it was resolved by the
 * theme from the declarations the components made, which is the whole claim.
 *
 * It also owns `checkNow`, which is the ONE definition of what a check run
 * means. `main.ts` delegates `window.__c11.check` to it rather than keeping a
 * second copy, because two implementations of "what did we measure" is exactly
 * the class of defect this repository keeps paying for: the expensive half of
 * "the framework checks the UI" is the checker's own truthfulness, and a
 * checker with two front doors has two answers.
 */

import { computed, each, html, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { type Finding, VOCABULARY } from '../appearance/contracts.js';
import { codeEntry, DOCS_BASE } from '../appearance/diagnostics/codes.js';
import { domInspector } from '../appearance/diagnostics/dom.js';
import { formatFindings, summarize } from '../appearance/diagnostics/report.js';
import { check } from '../appearance/diagnostics/runner.js';
import { solveAll } from '../appearance/fit/observe.js';
import { Button, NavItem, Region } from '../ui/index.js';
import { sweepOverlays } from '../ui/patterns/overflow-menu.js';
import { DataPage } from './pages/data.js';
import { InboxPage } from './pages/inbox.js';
import { MarketingPage } from './pages/marketing.js';
import { SettingsPage } from './pages/settings.js';
import {
  density,
  findings,
  input,
  overlaysOpened,
  page,
  PAGE_IDS,
  PAGE_STATES,
  pageState,
  setContext,
  STATES,
  theme,
  width,
  WIDTH_OPTIONS,
  type PageId,
  type StateId,
} from './state.js';

const PAGES: Record<PageId, () => TemplateResult> = {
  inbox: InboxPage,
  settings: SettingsPage,
  data: DataPage,
  marketing: MarketingPage,
};

export const CANVAS_ID = 'canvas';
export const VIEWPORT_ID = 'viewport';

/**
 * Where the harness publishes which page is up, which state it is in, and which
 * states that page CLAIMS in `PAGE_STATES`.
 *
 * It is printed rather than only held in a signal so that `proof/state-sweep.mjs`
 * reads the declaration from the running app instead of keeping a second copy of
 * it. A sweep whose list of states has drifted from the app's own list is a
 * sweep that reports cells it never rendered, which is the false-PASS shape this
 * repository keeps paying for.
 */
export const STATES_ID = 'declared-states';

/** The harness ids double as the hooks the geometry proof measures through. */
export function harnessElement(id: typeof CANVAS_ID | typeof VIEWPORT_ID): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`c11 harness: no element ${id} in the document; mount the shell first.`);
  return element;
}

const UNDECIDABLE = codeEntry('N680');

/** What `checkNow()` is allowed to do besides look at what is already on screen. */
export interface CheckOptions {
  /**
   * Also open every revealed overflow trigger under `root`, run the whole rule
   * set over the panel, and close it again.
   *
   * OFF BY DEFAULT, deliberately. `check()` has always meant "judge the
   * document as it stands", and the geometry proof and every recorded result in
   * the README were produced by that meaning. An option that silently started
   * driving the UI would make two runs of the same command incomparable, which
   * is worse than the hole it closes. So the hole is closed by an explicit
   * request, and the caller that makes it says so.
   */
  overlays?: boolean;
}

/**
 * Run the rule set over `root`, and — only when asked — over each overlay under
 * it while that overlay is open.
 *
 * The option exists because the closed document is not the whole document: an
 * overlay is rendered only while open, every rule traverses what is rendered,
 * and so the panel and its labels were outside the reach of N601, N621, N640,
 * N650, N660 and N690 alike.
 *
 * Open-state findings are ATTRIBUTED rather than merged. A reader who cannot
 * tell "this is wrong on the page" from "this is wrong once you open the menu"
 * cannot act on either, and the two have different fixes.
 */
export function checkNow(root: ParentNode, options: CheckOptions = {}): Finding[] {
  const closed = check(domInspector(root));
  if (options.overlays !== true) {
    overlaysOpened.value = null;
    return closed;
  }

  // Code, subject and detail together are the IDENTITY of a fact. The overlay
  // pass re-runs the whole rule set, so without this every closed-state finding
  // would be repeated once per overlay. `detail` belongs in the key because it
  // carries the magnitude: the same subject reporting a bigger overhang with
  // the panel open is a new fact and has to survive the filter.
  const already = new Set(
    closed.map((finding) => `${finding.code}\u0000${finding.subject}\u0000${finding.detail}`),
  );
  const found = [...closed];

  overlaysOpened.value = sweepOverlays(root, ({ trigger, panel }) => {
    // The accessible name, because that is the handle a user actually has on
    // this control; the component name is the fallback for a trigger that has
    // not been given one.
    const named =
      trigger.getAttribute('aria-label') ?? trigger.getAttribute('data-component') ?? 'an overflow trigger';

    if (panel === null) {
      // Not a claim that the overlay is broken — a claim that this sweep could
      // not see inside it, which is the one thing a checker must never report
      // as silence. The house rule the hard way, six times over: a check that
      // cannot measure has to say so.
      found.push({
        code: UNDECIDABLE.code,
        severity: UNDECIDABLE.severity,
        subject: named,
        detail:
          'invoking this revealed trigger produced no panel named by aria-controls, so nothing inside the overlay could be measured',
        hint: UNDECIDABLE.hint,
        docs: `${DOCS_BASE}n680`,
      });
      return;
    }

    for (const finding of check(domInspector(root))) {
      if (already.has(`${finding.code}\u0000${finding.subject}\u0000${finding.detail}`)) continue;
      found.push({ ...finding, subject: `while "${named}" is open › ${finding.subject}` });
    }
  });
  return found;
}

/**
 * Fit is a measured tier, so the findings are only true of the geometry that is
 * on screen right now: the width switch changes what fits without changing a
 * single declaration. Solve first, then look.
 *
 * The button asks for the open state, so a human sees exactly what the matrix
 * sees. It used to see strictly less, which made the proof's claim — "the thing
 * the proof exercised is the thing a user gets" — true of the geometry and false
 * of the checking.
 */
export function runCheck(): void {
  solveAll();
  findings.value = checkNow(harnessElement(CANVAS_ID), { overlays: true });
}

const report: ReadonlySignal<string[]> = computed(() => {
  const found = findings.value;
  if (found === null) return [];
  // `incomplete` is not a pass: a measurement the checker could not make is an
  // unanswered question, so it gets a column of its own rather than a fold-in.
  const { fail, warn, incomplete } = summarize(found);
  const opened = overlaysOpened.value;
  // The door count is part of the result, not trivia. Zero findings with zero
  // doors opened and zero findings with six doors opened are different facts.
  const doors = opened === null ? 'overlays not swept' : `overlays opened ${opened}`;
  const headline = `fail ${fail} · warn ${warn} · incomplete ${incomplete} · ${doors}`;
  return [headline, ...formatFindings(found).split('\n')];
});

/**
 * Uncontrolled on purpose: the signals are the source of truth and the option
 * order matches their initial values. Nothing reads a select back, so a
 * programmatic setContext from the geometry proof needs no widget round-trip.
 *
 * The one cast in the app is here, and it is sound: every option rendered came
 * from `options`, so the value read back is a member of it.
 */
function contextSwitch<T extends string>(
  label: string,
  options: readonly T[],
  apply: (value: T) => void,
): TemplateResult {
  return html`<label data-text="meta"
    >${label}
    <select @change=${(event: Event) => apply((event.target as HTMLSelectElement).value as T)}>
      ${options.map((option) => html`<option value=${option}>${option}</option>`)}
    </select>
  </label>`;
}

/**
 * Every state id, not only the ones the current page declares. A page's
 * declaration in `PAGE_STATES` is a claim about what it can be in, and the
 * harness is where that claim gets tested by hand: picking `empty` on a page
 * that declares no corpus should visibly do nothing, and if it does something
 * the declaration is wrong. The automated sweep respects the declaration; the
 * control deliberately does not.
 */
const STATE_IDS: readonly StateId[] = STATES.map((state) => state.id);

export function Shell(): TemplateResult {
  return html`
    <div id="harness" data-layout="stack">
      <div id="controls" data-layout="row" data-align="between">
        <div data-layout="row">
          ${PAGE_IDS.map((id) =>
            NavItem({
              label: id,
              current: computed(() => page.value === id),
              onSelect: () => setContext({ page: id }),
            }),
          )}
        </div>
        <div data-layout="row">
          ${contextSwitch('density', VOCABULARY.density, (value) => setContext({ density: value }))}
          ${contextSwitch('input', VOCABULARY.input, (value) => setContext({ input: value }))}
          ${contextSwitch('theme', VOCABULARY.theme, (value) => setContext({ theme: value }))}
          ${contextSwitch(
            'width',
            WIDTH_OPTIONS.map((option) => String(option)),
            (value) => setContext({ width: Number(value) }),
          )}
          ${contextSwitch('state', STATE_IDS, (value) => setContext({ state: value }))}
          ${Button({ role: 'primary', children: 'Run check', onClick: runCheck })}
        </div>
      </div>

      <div id=${VIEWPORT_ID} style=${computed(() => `inline-size: ${width.value}px`)}>
        ${Region({
          density,
          input,
          theme,
          layout: 'stack',
          children: html`<div id=${CANVAS_ID}>${computed(() => PAGES[page.value]())}</div>`,
        })}
      </div>

      <div id="findings" data-layout="stack">
        <code id=${STATES_ID}
          >${computed(
            () =>
              `page ${page.value} · state ${pageState.value} · declares ${PAGE_STATES[page.value].join(',')}`,
          )}</code
        >
        ${each(
          report,
          (line, index) => `${index}:${line}`,
          (line) => html`<code>${line}</code>`,
        )}
      </div>
    </div>
  `;
}
