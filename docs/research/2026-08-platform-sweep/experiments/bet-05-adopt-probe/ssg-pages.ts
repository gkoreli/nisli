/**
 * ssg-pages.ts — the real `@nisli/ssg` render side of the probe. Loaded in Node
 * through Vite's SSR module runner by adopt-probe.mjs, so `renderToHtml()` runs
 * the actual happy-dom pipeline (packages/ssg/src/core-render.ts:59-94) over the
 * actual client runtime.
 *
 * Two routes are rendered, in order, from ONE module process — exactly how
 * `buildStaticSite()` walks routes (packages/ssg/src/build.ts:174-179). The
 * decoy route is rendered FIRST so it consumes generated id `probe-1`; the page
 * under test therefore ships `probe-2` / `probe-3`.
 */
// MUST be first: installs the happy-dom globals `component()` needs at import.
import './ssg-env.js';
import { html } from '@nisli/core';
// `renderToHtml` is @nisli/ssg's real render entry (packages/ssg/src/core-render.ts)
// but is not re-exported from the package barrel, and reaching it through
// `buildStaticSite()` would couple this throwaway probe to build.ts churn. The
// probe imports the actual module by path — same code the static build runs.
import { renderToHtml } from '../../../../../packages/ssg/src/core-render.js';
import { Probe } from './probe-component.js';

export interface ProbePages {
  /** route rendered first — only there to advance the module-scoped counter */
  decoy: string;
  /** the page under test: two islands, factory-only label/children, forwarded id/name */
  island: string;
}

export async function renderProbePages(): Promise<ProbePages> {
  const decoy = await renderToHtml(html`<div id="decoy-route">${Probe({
    label: 'Decoy route label',
    children: 'decoy child',
    id: 'decoy-input',
    name: 'decoy-field',
  })}</div>`);

  const island = await renderToHtml(html`<div id="app">${Probe({
    label: 'Server-rendered label A',
    children: html`<em data-authored="a">factory child A</em>`,
    id: 'probe-a',
    name: 'field-a',
  })}${Probe({
    label: 'Server-rendered label B',
    children: html`<em data-authored="b">factory child B</em>`,
    id: 'probe-b',
    name: 'field-b',
  })}</div>`);

  return { decoy, island };
}
