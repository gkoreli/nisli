/**
 * config.ts — nisli-ui.json project configuration.
 *
 * One key: `dir`, the install root all registry files are copied under.
 * The registry's internal layout (ui/, lib/, styles/) is fixed so that
 * relative imports in copied source survive verbatim (ADR 0022).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONFIG_FILE = 'nisli-ui.json';
export const DEFAULT_DIR = 'src/nisli-ui';

export interface UiConfig {
  /** Project-relative directory registry files are copied into. */
  dir: string;
}

export function readConfig(cwd: string): UiConfig | null {
  const path = join(cwd, CONFIG_FILE);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<UiConfig>;
  if (typeof parsed.dir !== 'string' || parsed.dir.length === 0) {
    throw new Error(`Invalid ${CONFIG_FILE}: "dir" must be a non-empty string.`);
  }
  return { dir: parsed.dir };
}

export function writeConfig(cwd: string, config: UiConfig): void {
  writeFileSync(join(cwd, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}
