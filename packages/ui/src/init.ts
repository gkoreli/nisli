/**
 * init.ts — set up a consumer project: write nisli-ui.json and copy the
 * base registry items every component assumes (lib/utils.ts, styles/theme.css).
 */

import { DEFAULT_DIR, readConfig, writeConfig, type UiConfig } from './config.js';
import { addItems, type AddResult } from './add.js';

/** Registry items copied by `init`, before any component is added. */
export const BASE_ITEMS = ['utils', 'theme'];

export interface InitResult {
  config: UiConfig;
  /** False when an existing nisli-ui.json was reused. */
  created: boolean;
  add: AddResult;
}

export function init(cwd: string, options: { dir?: string } = {}): InitResult {
  const existing = readConfig(cwd);
  const config = existing ?? { dir: options.dir ?? DEFAULT_DIR };
  if (!existing) writeConfig(cwd, config);
  const add = addItems(cwd, BASE_ITEMS, { config });
  return { config, created: !existing, add };
}
