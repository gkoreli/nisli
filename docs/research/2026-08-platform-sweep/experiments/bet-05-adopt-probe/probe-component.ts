/**
 * probe-component.ts — the component under test for the BET05 falsification
 * probe. Its shape is dictated verbatim by the review's cheapest-experiment
 * spec (reviews/bet-05-adopt-islands.review.md:169):
 *
 *   Probe({ label, children, id, name })
 *
 * - `label` and `children` are FACTORY-ONLY inputs: they are not declared in
 *   the `attrs` map, so they never reach the host as attributes and SSG
 *   delivers them through `_setProp` (packages/ssg/src/core-render.ts:40-44 /
 *   packages/core/src/template.ts:556-566).
 * - `id`/`name` are declared `'forward'`: core removes them from the host and
 *   relocates them onto the inner control (packages/core/src/component.ts:432-451).
 * - The generated ARIA ids come from a MODULE-SCOPED counter, the same shape as
 *   the real accordion (packages/www/src/nisli-ui/ui/accordion.ts:65).
 *
 * This file is imported by BOTH sides of the probe: the Node/happy-dom SSG
 * render and — as a separately bundled module — the browser. That is the point:
 * the browser gets a FRESH module instance, so the counter restarts.
 */
import { children, component, type ComponentAttrs, html, signal } from '@nisli/core';

// Generated-ID seed. `buildStaticSite()` renders every route sequentially in
// ONE module process (packages/ssg/src/build.ts:174-179), so route N continues
// route N-1's counter. A freshly imported client module starts from zero.
let uid = 0;

/** @internal test seam — the probe reads the component's own signal after adoption. */
export interface ProbeSeam {
  localId: string;
  typed: { value: string };
}

export interface ProbeProps {
  /** factory-only (no attrs declaration) */
  label?: string;
  /** factory-only: a TemplateResult owned by the CALLER's factory call */
  children?: unknown;
  /** 'forward' — relocated off the layout-transparent host */
  id?: string;
  /** 'forward' */
  name?: string;
}

const probeAttrs = {
  id: 'forward',
  name: 'forward',
} satisfies ComponentAttrs<ProbeProps>;

export const Probe = component<ProbeProps, typeof probeAttrs>('probe-island', (props, host) => {
  const localId = `probe-${++uid}`;
  // comp-children-before-onmount: consume the projection slot during setup.
  const slot = children();
  const typed = signal('');

  // Unchecked cast with a reason: `host` is a well-known DOM element and
  // `__probe` is an expando this throwaway experiment owns end-to-end, so
  // there is no external shape to validate.
  const seamHost = host as HTMLElement & { __probe?: ProbeSeam };
  seamHost.__probe = { localId, typed };

  return html`<div data-slot="root" data-local-id="${localId}">
    <span data-slot="label" id="${`${localId}-label`}">${props.label}</span>
    <input
      data-slot="input"
      id="${props.id}"
      name="${props.name}"
      aria-labelledby="${`${localId}-label`}"
      aria-describedby="${`${localId}-hint`}"
      @input="${(event: Event) => {
        typed.value = (event.target as HTMLInputElement).value;
      }}"
    />
    <p data-slot="hint" id="${`${localId}-hint`}">Describes the control.</p>
    <div data-slot="children">${slot}</div>
  </div>`;
}, { attrs: probeAttrs });
