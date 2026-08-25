/// <reference types="vite/client" />
/**
 * main.ts — mount the shell, load the resolution table, expose the automation
 * surface the geometry proof drives.
 *
 * `window.__c11` is a development affordance, not a product API: it exists so
 * the proof in `proof/geometry-proof.mjs` can drive a context matrix and measure
 * real geometry without a test-only code path inside the app. Everything on it
 * is the same function the UI itself calls, which is the point — if the proof
 * passes, the thing the proof exercised is the thing a user gets.
 */

import { html } from '@nisli/core';
import type { Finding } from '../appearance/contracts.js';
import { domInspector } from '../appearance/diagnostics/dom.js';
import { check } from '../appearance/diagnostics/runner.js';
import { explain, type Explanation } from '../appearance/explain.js';
import { solveAll } from '../appearance/fit/observe.js';
import '../theme/index.css';
import { CANVAS_ID, harnessElement, Shell, VIEWPORT_ID } from './shell.js';
import { findings, setContext, type ContextPatch } from './state.js';

export interface AutomationSurface {
  /** Write any subset of the context axes, plus the harness viewport width. */
  setContext(patch: ContextPatch): void;
  /**
   * Resolves once the DOM reflects the last `setContext` and the fit solver has
   * run over the resulting geometry. Await this instead of sleeping.
   */
  settled(): Promise<void>;
  /** Re-solve every `[data-fit]` container under `root` (default: document). */
  solveAll(root?: ParentNode): void;
  /** Run every default rule over `root` (default: the canvas). */
  check(root?: ParentNode): Finding[];
  /** Provenance for one element: which declaration produced which value. */
  explain(element: HTMLElement): Explanation;
  /** Snapshot of what the Run check button last rendered; empty before a run. */
  findings(): readonly Finding[];
  /** The simulated viewport, the element the width axis sizes. */
  readonly viewport: HTMLElement;
  /** The subtree the harness never styles. Everything in it came from theme. */
  readonly canvas: HTMLElement;
}

declare global {
  interface Window {
    __c11: AutomationSurface;
  }
}

/**
 * Resolves when the geometry is final, which is three separate waits:
 *
 *  1. a frame for nisli to flush the render the context change triggered;
 *  2. the harness's own width transition — index.html animates `inline-size`
 *     on the viewport, so the frame after a width change is mid-transition and
 *     measuring there reports a width nobody asked for. `allSettled` because a
 *     transition superseded by a newer one rejects, and being superseded is
 *     not an error here;
 *  3. a frame for layout plus whatever solve the fit adapter's own
 *     ResizeObserver schedules, then an explicit pass so a context change that
 *     resized nothing still re-solves, then a last frame so anything measured
 *     after this call sees settled boxes.
 *
 * `new Promise(requestAnimationFrame)` rather than `Promise.withResolvers`:
 * the repo compiles against lib ES2022, where withResolvers does not exist.
 */
async function settled(): Promise<void> {
  await new Promise(requestAnimationFrame);
  const running = harnessElement(VIEWPORT_ID).getAnimations();
  if (running.length > 0) await Promise.allSettled(running.map((animation) => animation.finished));
  await new Promise(requestAnimationFrame);
  solveAll();
  await new Promise(requestAnimationFrame);
}

html`${Shell()}`.mount(document.getElementById('root')!);

window.__c11 = {
  setContext,
  settled,
  solveAll,
  check: (root = harnessElement(CANVAS_ID)) => check(domInspector(root)),
  explain,
  findings: () => findings.value ?? [],
  get viewport() {
    return harnessElement(VIEWPORT_ID);
  },
  get canvas() {
    return harnessElement(CANVAS_ID);
  },
};
