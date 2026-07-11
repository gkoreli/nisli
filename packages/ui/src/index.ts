/**
 * packages/ui — Public programmatic API barrel export.
 *
 * The primary interface is the `nisli-ui` CLI (see cli.ts); these exports
 * exist for tooling that drives the registry programmatically.
 */

export {
  CONFIG_FILE,
  DEFAULT_DIR,
  readConfig,
  writeConfig,
  type UiConfig,
} from './config.js';

export {
  loadRegistry,
  registryDir,
  getItem,
  resolveItems,
  type Registry,
  type RegistryItem,
  type RegistryItemType,
} from './registry.js';

export { addItems, type AddOptions, type AddResult } from './add.js';

export { init, BASE_ITEMS, type InitResult } from './init.js';
