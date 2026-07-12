/**
 * add.ts — copy registry items (and their registry dependencies) into a
 * consumer project, preserving the registry's relative layout.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_FILE, readConfig, type UiConfig } from './config.js';
import { loadRegistry, registryDir, resolveItems, type Registry } from './registry.js';

export interface AddOptions {
  overwrite?: boolean;
  /** Injected for init/tests; defaults to reading nisli-ui.json from cwd. */
  config?: UiConfig;
  registry?: Registry;
}

export interface AddResult {
  /** Project-relative paths written. */
  copied: string[];
  /** Project-relative paths skipped because they already exist. */
  skipped: string[];
  /** npm packages the consumer must install. */
  dependencies: string[];
  /** Build-only npm packages the consumer must install. */
  devDependencies: string[];
}

export function addItems(cwd: string, names: string[], options: AddOptions = {}): AddResult {
  const config = options.config ?? readConfig(cwd);
  if (!config) {
    throw new Error(`No ${CONFIG_FILE} found in ${cwd}. Run \`nisli-ui init\` first.`);
  }
  if (names.length === 0) {
    throw new Error('No registry item names given. Try `nisli-ui add button`.');
  }

  const registry = options.registry ?? loadRegistry();
  const items = resolveItems(registry, names);
  const sourceRoot = join(registryDir(), registry.style);

  const result: AddResult = { copied: [], skipped: [], dependencies: [], devDependencies: [] };
  for (const item of items) {
    for (const file of item.files) {
      const relative = join(config.dir, file);
      const target = join(cwd, relative);
      if (existsSync(target) && !options.overwrite) {
        result.skipped.push(relative);
        continue;
      }
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(sourceRoot, file), target);
      result.copied.push(relative);
    }
    for (const dep of item.dependencies ?? []) {
      if (!result.dependencies.includes(dep)) result.dependencies.push(dep);
    }
    for (const dep of item.devDependencies ?? []) {
      if (!result.devDependencies.includes(dep)) result.devDependencies.push(dep);
    }
  }
  return result;
}
