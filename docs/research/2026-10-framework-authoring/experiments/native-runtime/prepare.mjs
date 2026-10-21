import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const commit = '1d055cabdffbea8ff8d82cbfd88a6081882ca8b2';
export const snapshotRoot = resolve(tmpdir(), `nisli-native-runtime-${commit.slice(0, 12)}`);
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../..');
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', commit,
    'packages/core/src', 'packages/ui/registry/default/lib/utils.ts',
    'packages/ui/registry/default/ui/progress.ts',
    'packages/ui/registry/default/ui/input.ts',
    'packages/ui/registry/default/ui/slider.ts'], { cwd: repo, encoding: 'utf8' })
    .trim().split('\n').filter(p => p.endsWith('.ts') && !/\.test(?:-d)?\.ts$|\.d\.ts$/.test(p));
  const files = [];
  for (const path of paths) {
    const source = execFileSync('git', ['show', `${commit}:${path}`], { cwd: repo, encoding: 'utf8' });
    const target = resolve(snapshotRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
    // Compile the library's TypeScript, not an application authoring language.
    // prototype.mjs and browser.mjs are served unchanged to native browser ESM.
    const output = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
    } }).outputText;
    writeFileSync(target.replace(/\.ts$/, '.js'), output);
    files.push({ path, sha256: createHash('sha256').update(source).digest('hex') });
  }
  writeFileSync(resolve(snapshotRoot, 'package.json'), '{"type":"module"}\n');
  writeFileSync(resolve(here, 'snapshot.json'), JSON.stringify({ commit, files }, null, 2) + '\n');
  console.log(JSON.stringify({ commit, files: files.length, snapshotRoot }));
}
