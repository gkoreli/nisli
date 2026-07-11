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
// Install EVERY registry item, not just ui items via their dependency
// closure — the demo.test.ts byte-equality check covers all items, so a
// lib item committed before its first consumer must still be in the fixture.
const allItems = loadRegistry().items.map((item) => item.name);
const addResult = addItems(demoDir, allItems, { overwrite: true });

for (const file of [...initResult.add.copied, ...addResult.copied]) {
  console.log(`  + ${file}`);
}
console.log(`Synced demo fixture: ${allItems.length} registry items (${allItems.join(', ')})`);
