import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const source = join(root, 'src');
const dist = join(root, 'dist');
const entries = [];
async function collect(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) await collect(file);
    else if (item.name.endsWith('.ts') && !/\.(?:d|test|test-d)\.ts$/.test(item.name)) entries.push(file);
  }
}
await collect(source);
await rm(dist, { recursive: true, force: true });
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', join(root, 'tsconfig.build.json')], { stdio: 'inherit' });

const common = {
  format: 'esm', target: 'es2022', platform: 'neutral',
  sourcemap: true, sourcesContent: true, logLevel: 'warning',
};

// Neutral prevents the publisher's environment/minification from freezing the
// consumer's mode. Keep modules (including HMR) and standard NODE_ENV guards.
await build({ ...common, entryPoints: entries, outbase: source, outdir: join(dist, 'bundler') });

// Native browser consumers need neither a process shim nor a build step. Only
// Nisli's publication build specializes these two artifacts from the same source.
for (const [mode, filename] of [['development', 'index.js'], ['production', 'index.production.js']]) {
  await build({
    ...common, entryPoints: [join(source, 'index.ts')], outfile: join(dist, filename),
    bundle: true, treeShaking: true, minify: mode === 'production',
    sourcesContent: mode !== 'production',
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
  });
}
