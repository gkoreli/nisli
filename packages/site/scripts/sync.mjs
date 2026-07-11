/**
 * scripts/sync.mjs — install the site's @nisli/ui component copies through
 * the real CLI (the site is an honest consumer: it owns its copies).
 * Re-run after registry changes: pnpm --filter @nisli/site sync
 */
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addItems } from '../../ui/dist/add.js';
import { init } from '../../ui/dist/init.js';
import { loadRegistry } from '../../ui/dist/registry.js';

const siteDir = dirname(dirname(fileURLToPath(import.meta.url)));
rmSync(join(siteDir, 'src/nisli-ui'), { recursive: true, force: true });
init(siteDir);
const all = loadRegistry().items.map((i) => i.name);
const result = addItems(siteDir, all, { overwrite: true });
console.log(`site: installed ${result.copied.length} files from ${all.length} registry items`);
