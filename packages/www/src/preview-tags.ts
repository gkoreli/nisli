/**
 * preview-tags.ts — the primary custom-element tag for a registry item.
 * Shared by preview.ts (SSG auto-default) and client/hydrate.ts (the derived
 * auto-default hydration path), so the two never drift.
 */

/** Primary custom-element tag for an item — `ui-<name>` save these exceptions. */
export const TAG_OVERRIDES: Record<string, string> = {
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
