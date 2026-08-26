/**
 * intent/index.ts — the barrel `app-router.ts` lazily imports. Three page
 * functions, one per route.
 *
 * DOM-FREE BY CONTRACT (ADR 0026 §8). Nothing reachable from here calls
 * `component()` or touches `HTMLElement` at module load, so importing the router
 * — which `vite.config.ts` does, in plain Node, to share the route catalog —
 * never evaluates a DOM-touching module. `island.ts` is the one file here that
 * does, and it is deliberately NOT re-exported: `client/hydrate.ts` imports it
 * directly, in a browser.
 *
 * One file per concern:
 *
 *   feed.ts             the content, shared by both authoring styles
 *   surface.ts          THE intent-declared surface — zero values, zero classes
 *   tailwind-surface.ts the control, authored the way this site is authored
 *   harness.ts          the switchers and the ruler (the only numbers)
 *   checker.ts          running @nisli/intent/devtools in the page
 *   bodies.ts           the driveable surfaces, rendered statically AND live
 *   island.ts           the live half: one component, one `fit(host)`
 *   recorded.ts         the checker run, as it came back
 *   prose.ts            page chrome, headings, the vocabulary table, Limits
 *   snippet-row.ts      the smallest honest example, as a module that typechecks
 *   pitch.ts            /intent
 *   playground.ts       /intent/playground
 *   comparison.ts       /intent/comparison
 */
export { intentPitchPage } from './pitch.js';
export { intentPlaygroundPage } from './playground.js';
export { intentComparisonPage } from './comparison.js';
