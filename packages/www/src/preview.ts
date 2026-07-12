/**
 * preview.ts — the live preview for every /ui/<name> page (WWW-6).
 * A component always gets a preview: a curated example (examples.ts) when one
 * exists, otherwise an auto-default that renders the component's own custom
 * element with default props. This is why every component page opens with a
 * live render, and why the demo package could be retired — www is the dogfood.
 *
 * NOTE (framework limitation): nisli's html`` cannot interpolate a dynamic tag
 * name (`html`<${tag}>``), so the auto-default uses a component that
 * createElement()s the tag in onMount — which SSG mounts and upgrades. Reported
 * to arch for a possible html dynamic-tag primitive.
 */
import { component, html, onMount, ref, type TemplateResult } from '@nisli/core';
import type { RegistryItem } from './registry.js';
import { getExample } from './examples.js';
import './preview-elements.js'; // register every component's custom element

/** Primary custom-element tag for an item — `ui-<name>` save these exceptions. */
const TAG_OVERRIDES: Record<string, string> = {
  toast: 'ui-toaster',
  resizable: 'ui-resizable-panel-group',
  item: 'ui-item-group',
  sidebar: 'ui-sidebar-provider',
  direction: 'ui-direction-provider',
  bubble: 'ui-bubble-group',
};

export function primaryTag(name: string): string {
  return TAG_OVERRIDES[name] ?? `ui-${name}`;
}

/**
 * Renders a custom element by tag. html`` can't take a dynamic tag, so we
 * createElement in onMount; SSG runs it and upgrades the registered element.
 */
const AutoPreview = component<{ tag: string }>('www-auto-preview', (props) => {
  const host = ref<HTMLDivElement>();
  onMount(() => {
    if (host.current) host.current.appendChild(document.createElement(props.tag.value));
  });
  return html`<div ref="${host}"></div>`;
});

/** The preview for a component item: curated example, else auto-default. */
export function componentPreview(item: RegistryItem): TemplateResult {
  const example = getExample(item.name);
  if (example) return example();
  return AutoPreview({ tag: primaryTag(item.name) });
}
