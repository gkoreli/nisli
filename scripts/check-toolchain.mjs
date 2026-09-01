/**
 * Guards the toolchain pins against silent drift.
 *
 *   node scripts/check-toolchain.mjs
 *
 * Three files name a version and none of them can see the others:
 *   - package.json  `packageManager`  — what CI installs (pnpm/action-setup@v4
 *     reads this field; the workflows pass no explicit `version:`)
 *   - mise.toml     `[tools] pnpm`    — what a local shell gets
 *   - mise.toml     `[tools] node`    — must match the CI matrix floor
 *   - mise.toml     `[tools] bun`     — must match every setup-bun workflow pin
 *
 * They drifted once already: package.json pinned pnpm 10.17.1 while mise said
 * "latest" and resolved 10.33.2, so the shim had no selected version and every
 * command needed a MISE_PNPM_VERSION prefix to run at all. This makes that a
 * failure instead of folklore.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const problems = [];

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const mise = readFileSync(join(root, 'mise.toml'), 'utf8');

const declared = pkg.packageManager;
if (typeof declared !== 'string') {
  problems.push('package.json has no `packageManager` field; pnpm/action-setup@v4 needs it to pick a version.');
}
const pkgPnpm = declared?.match(/^pnpm@(\d+\.\d+\.\d+)/)?.[1];
if (declared && !pkgPnpm) {
  problems.push(`package.json packageManager "${declared}" is not a plain pnpm@x.y.z pin.`);
}

const misePnpm = mise.match(/^\s*pnpm\s*=\s*"([^"]+)"/m)?.[1];
const miseNode = mise.match(/^\s*node\s*=\s*"([^"]+)"/m)?.[1];
const miseBun = mise.match(/^\s*bun\s*=\s*"([^"]+)"/m)?.[1];

for (const [name, value] of [['pnpm', misePnpm], ['node', miseNode], ['bun', miseBun]]) {
  if (!value) problems.push(`mise.toml does not pin ${name}.`);
  else if (value === 'latest' || value === '*') {
    problems.push(`mise.toml pins ${name} = "${value}"; floating versions are what caused the last drift.`);
  }
}

if (miseBun !== '1.4.0') problems.push(`mise.toml must pin Bun 1.4.0 for Ledger; found ${miseBun ?? 'nothing'}.`);

if (pkgPnpm && misePnpm && pkgPnpm !== misePnpm) {
  problems.push(
    `pnpm version drift: package.json packageManager says ${pkgPnpm}, mise.toml says ${misePnpm}. `
    + 'CI installs the first, your shell gets the second.',
  );
}

// The CI matrix is the source of truth for node; mise should pin its floor.
const workflowDir = join(root, '.github', 'workflows');
const ciNodes = new Set();
const ciBuns = new Set();
for (const file of readdirSync(workflowDir)) {
  if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
  const text = readFileSync(join(workflowDir, file), 'utf8');
  for (const m of text.matchAll(/node-version:\s*['"]?(\d+)/g)) ciNodes.add(Number(m[1]));
  for (const m of text.matchAll(/bun-version:\s*['"]?([^'"\s]+)/g)) ciBuns.add(m[1]);
}
if (ciNodes.size && miseNode) {
  const floor = Math.min(...ciNodes);
  if (Number(miseNode.split('.')[0]) !== floor) {
    problems.push(
      `node pin ${miseNode} does not match the CI matrix floor (${floor}; matrix runs ${[...ciNodes].sort((a, b) => a - b).join(', ')}). `
      + 'A local green run should mean what CI\'s lowest lane means.',
    );
  }
}

if (ciBuns.size === 0) {
  problems.push('GitHub workflows do not install the Bun runtime required by Ledger builds.');
} else if (miseBun && (ciBuns.size !== 1 || !ciBuns.has(miseBun))) {
  problems.push(
    `bun pin ${miseBun} does not match every workflow pin (${[...ciBuns].sort().join(', ')}). `
    + 'A local Ledger build and a CI/publish build must use the same runtime.',
  );
}

if (problems.length) {
  console.error('Toolchain pins are inconsistent:\n');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`toolchain OK: pnpm ${pkgPnpm} (package.json == mise.toml), node ${miseNode} (CI floor ${Math.min(...ciNodes)}), bun ${miseBun} (mise.toml == workflows)`);
