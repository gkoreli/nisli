/**
 * shell.ts — the harness around the canvas.
 *
 * The harness is not part of the mechanism under test. It owns page navigation,
 * the four context switches, the simulated viewport and the findings readout —
 * and it deliberately owns NOTHING inside `#canvas`. That div carries no
 * attributes and no styles: everything painted inside it was resolved by the
 * theme from the declarations the components made, which is the whole claim.
 */

import { computed, each, html, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { VOCABULARY } from '../appearance/contracts.js';
import { domInspector } from '../appearance/diagnostics/dom.js';
import { formatFindings, summarize } from '../appearance/diagnostics/report.js';
import { check } from '../appearance/diagnostics/runner.js';
import { solveAll } from '../appearance/fit/observe.js';
import { Button, NavItem, Region } from '../ui/index.js';
import { DataPage } from './pages/data.js';
import { InboxPage } from './pages/inbox.js';
import { MarketingPage } from './pages/marketing.js';
import { SettingsPage } from './pages/settings.js';
import {
  density,
  findings,
  input,
  page,
  PAGE_IDS,
  setContext,
  theme,
  width,
  WIDTH_OPTIONS,
  type PageId,
} from './state.js';

const PAGES: Record<PageId, () => TemplateResult> = {
  inbox: InboxPage,
  settings: SettingsPage,
  data: DataPage,
  marketing: MarketingPage,
};

export const CANVAS_ID = 'canvas';
export const VIEWPORT_ID = 'viewport';

/** The harness ids double as the hooks the geometry proof measures through. */
export function harnessElement(id: typeof CANVAS_ID | typeof VIEWPORT_ID): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`c11 harness: no element ${id} in the document; mount the shell first.`);
  return element;
}

/**
 * Fit is a measured tier, so the findings are only true of the geometry that is
 * on screen right now: the width switch changes what fits without changing a
 * single declaration. Solve first, then look.
 */
export function runCheck(): void {
  solveAll();
  findings.value = check(domInspector(harnessElement(CANVAS_ID)));
}

const report: ReadonlySignal<string[]> = computed(() => {
  const found = findings.value;
  if (found === null) return [];
  // `incomplete` is not a pass: a measurement the checker could not make is an
  // unanswered question, so it gets a column of its own rather than a fold-in.
  const { fail, warn, incomplete } = summarize(found);
  const headline = `fail ${fail} · warn ${warn} · incomplete ${incomplete}`;
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
        ${each(
          report,
          (line, index) => `${index}:${line}`,
          (line) => html`<code>${line}</code>`,
        )}
      </div>
    </div>
  `;
}
