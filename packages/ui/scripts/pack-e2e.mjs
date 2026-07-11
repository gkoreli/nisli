/**
 * scripts/pack-e2e.mjs — publish-shape end-to-end check.
 *
 * Builds the real npm tarball (`pnpm pack`), extracts it into a scratch
 * consumer, and drives the packed CLI: list → init → add with transitive
 * registry deps. Verifies what unit tests cannot — the `files` globs
 * (tests excluded, registry sources included), the `bin` entry running
 * from `dist/`, and registry resolution relative to the installed package.
 *
 *   pnpm --filter @nisli/ui e2e:pack
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const scratch = mkdtempSync(join(tmpdir(), 'nisli-ui-pack-e2e-'));
let failed = false;

const check = (label, ok) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
};

try {
  const tarball = join(scratch, 'nisli-ui.tgz');
  execSync(`pnpm pack --out ${JSON.stringify(tarball)}`, { cwd: pkgDir, stdio: 'pipe' });

  const listing = execSync(`tar -tzf ${JSON.stringify(tarball)}`).toString().trim().split('\n');
  check('tarball contains no test files', !listing.some((f) => f.endsWith('.test.ts')));
  check('tarball ships registry sources', listing.some((f) => f === 'package/registry/default/ui/button.ts'));
  check('tarball ships registry manifest', listing.includes('package/registry/registry.json'));
  check('tarball ships the built CLI', listing.includes('package/dist/cli.js'));
  check('tarball ships no raw src/', !listing.some((f) => f.startsWith('package/src/')));

  const consumer = join(scratch, 'consumer');
  execSync(`mkdir -p ${JSON.stringify(consumer)} && tar -xzf ${JSON.stringify(tarball)} -C ${JSON.stringify(consumer)}`);
  const cli = join(consumer, 'package/dist/cli.js');

  const run = (...args) => execFileSync('node', [cli, ...args], { cwd: consumer }).toString();

  check('packed CLI: list works', run('list').includes('button'));
  run('init', '--dir', 'src/ui');
  check('packed CLI: init copies base files', existsSync(join(consumer, 'src/ui/lib/utils.ts')));
  run('add', 'dialog');
  check(
    'packed CLI: add resolves transitive lib deps',
    existsSync(join(consumer, 'src/ui/ui/dialog.ts'))
      && existsSync(join(consumer, 'src/ui/lib/dismissable-layer.ts'))
      && existsSync(join(consumer, 'src/ui/lib/focus.ts')),
  );

  const installed = readdirSync(join(consumer, 'src/ui/ui'));
  console.log(`\nInstalled into scratch consumer: ${installed.join(', ')}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
  console.error('\npack e2e FAILED');
  process.exit(1);
}
console.log('pack e2e OK');
