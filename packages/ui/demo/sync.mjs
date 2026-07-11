/**
 * demo/sync.mjs — (re)install the demo's component tree through the real CLI.
 *
 * The demo directory is a committed consumer-project fixture: everything under
 * demo/src/nisli-ui/ is CLI output, never hand-edited. Re-run after changing
 * the registry:
 *
 *   pnpm --filter @nisli/ui demo:sync
 *
 * demo/demo.test.ts fails CI whenever the fixture drifts from the registry.
 */
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init } from '../dist/init.js';
import { addItems } from '../dist/add.js';
import { loadRegistry } from '../dist/registry.js';

const demoDir = dirname(fileURLToPath(import.meta.url));

rmSync(join(demoDir, 'src/nisli-ui'), { recursive: true, force: true });

const initResult = init(demoDir);
const uiItems = loadRegistry().items.filter((item) => item.type === 'ui').map((item) => item.name);
const addResult = addItems(demoDir, uiItems, { overwrite: true });

for (const file of [...initResult.add.copied, ...addResult.copied]) {
  console.log(`  + ${file}`);
}
console.log(`Synced demo fixture: ${uiItems.length} ui items (${uiItems.join(', ')})`);
