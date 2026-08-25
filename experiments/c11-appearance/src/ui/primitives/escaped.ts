/**
 * escaped.ts — the escape hatch, and the ONLY file in src/ui/ permitted a raw
 * value. proof/no-values-guard.mjs greps every other file for exactly what is
 * written below and fails the build if it finds it.
 *
 * DECLARES: `data-escaped`, naming in words what it escaped. That attribute is
 * what makes the hatch honest rather than a hole: `check()` reports it as N601,
 * the diagnostics rules exclude the subtree from the rhythm, fit, crush,
 * overlap and contrast guarantees, and the theme outlines it on screen so the
 * exception is visible to a human as well as to the checker.
 *
 * DOES NOT DECIDE: anything about the rest of the document. The escape is
 * scoped to this subtree and counted.
 *
 * A system with no escape hatch is not a system, it is a cage — an author who
 * needs one pixel of optical correction and cannot have it will abandon the
 * vocabulary wholesale. The bet is not that escapes never happen; it is that
 * they are possible, explicit, and countable, so "how much of this UI is
 * actually derived?" has a number rather than an opinion.
 */

import { children, component, type ComponentAttrs, computed, html } from '@nisli/core';

export interface EscapedProps {
  /** What was escaped, in words. Shown in the N601 finding. */
  note?: string;
  children?: unknown;
}

const escapedAttrs = { note: 'string' } satisfies ComponentAttrs<EscapedProps>;

export const Escaped = component<EscapedProps, typeof escapedAttrs>(
  'app-escaped',
  (props) => html`<div
    data-component="app-escaped"
    data-escaped=${computed(() => props.note.value ?? 'margin-block-start: 7px; transform: rotate(-1deg)')}
    style="margin-block-start: 7px; transform: rotate(-1deg)"
  >${children()}</div>`,
  { attrs: escapedAttrs },
);
