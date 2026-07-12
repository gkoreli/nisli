/**
 * client/loader.ts — the pure, injectable loader-resolution seam (WWW-15).
 *
 * Split out of hydrate.ts so the DERIVED-not-curated resolution is testable in
 * isolation: no IntersectionObserver bootstrap, no `import.meta.glob` side
 * effects at import time. hydrate.ts wires the real deps (the component-module
 * glob + the examples chunk); a test injects fakes and drives the SAME code.
 *
 * The resolution, from a preview frame's <name>:
 *  - curated example exists (getExample) → mount it (override, not an allowlist);
 *  - else the component's live AUTO-DEFAULT — register the module by name so its
 *    <ui-*> upgrades, then mount its primary tag. "No example" never means "no
 *    hydration"; it means the derivation floor.
 */
import { component, html, onMount, ref, type TemplateResult } from '@nisli/core';
import { type ExampleLoader } from './hydrate-frame.js';
import { primaryTag } from '../preview-tags.js';

export type Example = () => TemplateResult;

// Client auto-default: register the component (so its <ui-*> upgrades) and mount
// its primary tag live. A DISTINCT tag from the SSG `www-auto-preview` so that
// defining it never upgrades the prerendered fallback in place.
export const AutoHydrate = component<{ tag: string }>('www-auto-hydrate', (props) => {
  const host = ref<HTMLDivElement>();
  onMount(() => {
    if (host.current) host.current.appendChild(document.createElement(props.tag.value));
  });
  return html`<div ref="${host}"></div>`;
});

export interface LoaderDeps {
  /** Load the curated-example registry (one code-split chunk in prod). */
  loadExamples: () => Promise<{ getExample: (name: string) => Example | undefined }>;
  /** Register the component module by name (upgrades its <ui-*>); undefined if unknown. */
  registerComponent: (name: string) => Promise<unknown> | undefined;
  /** Auto-default mount for an uncurated name (defaults to AutoHydrate + primary tag). */
  autoDefault?: (name: string) => TemplateResult;
}

/**
 * Resolve the loader for a preview frame, DERIVED from its name, over injectable
 * deps. Curated example wins; otherwise the module is registered and the primary
 * tag is auto-mounted. This is the single non-vacuous fallback path.
 */
export function resolveLoader(name: string, deps: LoaderDeps): ExampleLoader {
  const autoDefault = deps.autoDefault ?? ((n: string) => AutoHydrate({ tag: primaryTag(n) }));
  return async () => {
    const { getExample } = await deps.loadExamples();
    const example = getExample(name);
    if (example) return { default: example };
    await deps.registerComponent(name); // no curated example → auto-default (derived)
    return { default: () => autoDefault(name) };
  };
}
