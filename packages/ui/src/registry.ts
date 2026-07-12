/**
 * registry.ts — load and resolve the component registry.
 *
 * The registry ships inside the @nisli/ui package: `registry/registry.json`
 * describes the items; source files live under `registry/<style>/`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RegistryItemType = 'ui' | 'lib' | 'style';

export interface RegistryItem {
  name: string;
  type: RegistryItemType;
  description?: string;
  /** Registry-relative file paths, copied verbatim under the consumer's dir. */
  files: string[];
  /** Names of other registry items this item requires. */
  registryDependencies?: string[];
  /** npm packages the consumer must install (reported, never auto-installed). */
  dependencies?: string[];
  /** Build-only npm packages the consumer should install with `--save-dev`. */
  devDependencies?: string[];
}

export interface Registry {
  style: string;
  items: RegistryItem[];
}

// src/ and dist/ are both direct children of the package root, so the
// registry directory is one level up from this module in dev and when built.
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export function registryDir(): string {
  return join(packageRoot, 'registry');
}

export function loadRegistry(): Registry {
  const raw = readFileSync(join(registryDir(), 'registry.json'), 'utf8');
  return JSON.parse(raw) as Registry;
}

export function getItem(registry: Registry, name: string): RegistryItem {
  const item = registry.items.find((i) => i.name === name);
  if (!item) {
    const known = registry.items.map((i) => i.name).join(', ');
    throw new Error(`Unknown registry item "${name}". Available: ${known}`);
  }
  return item;
}

/**
 * Resolve items plus their registryDependencies, transitively.
 * Returns a deduplicated list, dependencies before dependents.
 */
export function resolveItems(registry: Registry, names: string[]): RegistryItem[] {
  const resolved: RegistryItem[] = [];
  const seen = new Set<string>();

  const visit = (name: string, trail: string[]): void => {
    if (seen.has(name)) return;
    if (trail.includes(name)) {
      throw new Error(`Circular registryDependencies: ${[...trail, name].join(' -> ')}`);
    }
    const item = getItem(registry, name);
    for (const dep of item.registryDependencies ?? []) {
      visit(dep, [...trail, name]);
    }
    seen.add(name);
    resolved.push(item);
  };

  for (const name of names) visit(name, []);
  return resolved;
}
