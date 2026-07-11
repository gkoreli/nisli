/**
 * registry.ts — the site's view of the @nisli/ui registry.
 * Enumerated from loadRegistry() (the same source the copy-in CLI reads), so
 * the /ui gallery is registry-driven: adding a registry item produces a page
 * with no change here. No hand-maintained component list.
 */
import { loadRegistry, type RegistryItem } from '@nisli/ui';

export type { RegistryItem };

const registry = loadRegistry();

const byName = (a: RegistryItem, b: RegistryItem) => a.name.localeCompare(b.name);

/** Every addable registry item (ui + lib), sorted. style items are excluded. */
export const items: readonly RegistryItem[] = registry.items
  .filter((i) => i.type === 'ui' || i.type === 'lib')
  .slice()
  .sort(byName);

/** Components (visual). */
export const components: readonly RegistryItem[] = items.filter((i) => i.type === 'ui');

/** Primitives — the behavioral/lib helpers (roving-focus, floating, …). */
export const primitives: readonly RegistryItem[] = items.filter((i) => i.type === 'lib');

export function getItem(name: string): RegistryItem | undefined {
  return items.find((i) => i.name === name);
}

/** The exact CLI command that installs an item — rendered from its name. */
export function addCommand(item: RegistryItem): string {
  return `npx @nisli/ui add ${item.name}`;
}

/** Route path for an item's page. */
export function itemPath(name: string): string {
  return `/ui/${name}`;
}
