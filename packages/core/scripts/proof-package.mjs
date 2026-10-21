// Contract test of pnpm's actual published shape. No aliases to workspace source,
// custom Nisli defines, or source rewrites. Run after `pnpm build`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build as esbuild } from 'esbuild';
import { build as viteBuild, createServer as createViteServer } from 'vite';
import { chromium, firefox, webkit } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const core = path.dirname(here);
const root = path.dirname(path.dirname(core));
const require = createRequire(import.meta.url);
const scratch = await mkdtemp(path.join(tmpdir(), 'nisli-package-'));
const consumer = path.join(scratch, 'consumer');
const routes = new Map();
const cases = [];
// Assert optional diagnostics and their bookkeeping disappear even when all
// public APIs are reachable (the full native production artifact below).
const optional = ['N101', 'N102', 'N103', 'N104', 'N201', 'N202', 'N301', 'N302', 'N303', 'N310', 'N501', 'N603'];
function stripped(code) {
  for (const sentinel of [...optional, 'createdAt', 'asyncWarned', 'effect() created here', 'captureCallsite', 'auditTemplate', 'readKeys', '_setupDone', '_echoed']) {
    assert(!code.includes(sentinel), `Production retained ${sentinel}`);
  }
  assert(!code.includes('process.env'), 'Browser output requires process');
}
async function pack(dir, name) {
  const destination = path.join(scratch, `packed-${name}`);
  await mkdir(destination);
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: dir, stdio: 'pipe' });
  const tarballs = (await readdir(destination)).filter(file => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1);
  const installed = path.join(consumer, 'node_modules/@nisli', name);
  await mkdir(installed, { recursive: true });
  execFileSync('tar', ['-xzf', path.join(destination, tarballs[0]), '--strip-components=1', '-C', installed]);
  return installed;
}
async function bundle(name, entry, options = {}, dev = false, kind = 'counter') {
  const result = await esbuild({
    absWorkingDir: consumer, entryPoints: [entry], bundle: true, platform: 'browser',
    format: 'esm', target: 'es2022', minify: true, write: false, metafile: true, ...options,
  });
  const code = result.outputFiles[0].text;
  const auditBytes = Object.values(result.metafile.outputs).reduce((total, output) => total +
    Object.entries(output.inputs).reduce((sum, [file, input]) => sum + (file.endsWith('/template-audit.js') ? input.bytesInOutput : 0), 0), 0);
  if (!dev) { stripped(code); assert.equal(auditBytes, 0, name); }
  else assert(auditBytes > 0, `${name}: audit must be available`);
  routes.set(`/${name}.js`, code);
  cases.push({ name, entry: name, dev, kind });
  console.log(JSON.stringify({ name, bytes: Buffer.byteLength(code), gzip: gzipSync(code, { level: 9 }).length, auditBytes }));
  return code;
}

let server;
let devServer;
const originalNodeEnv = process.env.NODE_ENV;
try {
  await mkdir(consumer, { recursive: true });
  await writeFile(path.join(consumer, 'package.json'), '{"name":"packed-consumer","private":true,"type":"module"}');
  const installed = await pack(core, 'core');
  const manifest = JSON.parse(await readFile(path.join(installed, 'package.json')));
  assert.equal(manifest.exports['.'].default, './dist/bundler/index.js');
  assert.equal(manifest.dependencies, undefined);
  for (const target of Object.values(manifest.exports)) {
    assert((await readFile(path.join(installed, target.types))).length > 0);
    assert((await readFile(path.join(installed, target.default))).length > 0);
  }
  for (const name of ['consumer', 'safety', 'hmr']) {
    await cp(path.join(here, `fixtures/${name}.js`), path.join(consumer, `${name}.js`));
    routes.set(`/${name}.js`, await readFile(path.join(consumer, `${name}.js`), 'utf8'));
  }
  // Suppression is a runtime preference, not a dead-code elimination mechanism.
  await bundle('esbuild-production', 'consumer.js');
  await bundle('esbuild-explicit-production', 'consumer.js', { define: { 'process.env.NODE_ENV': '"production"' } });
  await bundle('esbuild-development', 'consumer.js', { minify: false }, true);
  await bundle('esbuild-minified-development', 'consumer.js', { define: { 'process.env.NODE_ENV': '"development"' } }, true);
  await bundle('esbuild-production-safety', 'safety.js', {}, false, 'safety');
  await bundle('esbuild-development-safety', 'safety.js', { minify: false }, true, 'safety');
  await bundle('esbuild-hmr', 'hmr.js', { minify: false }, true, 'hmr');
  for (const mode of ['development', 'production']) {
    const filename = mode === 'development' ? 'index.js' : 'index.production.js';
    const code = await readFile(path.join(installed, 'dist', filename), 'utf8');
    assert(!code.includes('process.env'));
    if (mode === 'production') stripped(code);
    routes.set(`/${mode}.js`, code);
    cases.push({ name: `native-${mode}`, mode, entry: 'consumer', dev: mode === 'development', kind: 'counter' });
    cases.push({ name: `native-${mode}-safety`, mode, entry: 'safety', dev: mode === 'development', kind: 'safety' });
    const map = JSON.parse(await readFile(path.join(installed, 'dist', `${filename}.map`)));
    if (mode === 'production') assert.equal(map.sourcesContent, undefined);
    else assert(map.sourcesContent.some(source => source.includes('auditTemplate')));
  }
  for (const [name, base, override, dev] of [
    ['native-suppressed', 'native-development', false, false],
    ['native-restored', 'native-development', null, true],
    ['native-production-cannot-reenable', 'native-production', true, false],
    ['esbuild-suppressed', 'esbuild-development', false, false],
    ['esbuild-production-cannot-reenable', 'esbuild-production', true, false],
  ]) cases.push({ ...cases.find(item => item.name === base), name, override, dev });

  // Independent consumer optimizer; no plugin and no manual mode definition.
  const vite = await viteBuild({
    root: consumer, configFile: false, logLevel: 'error',
    build: { write: false, minify: 'esbuild', target: 'es2022', rollupOptions: { input: path.join(consumer, 'consumer.js') } },
  });
  const chunks = (Array.isArray(vite) ? vite : [vite]).flatMap(result => result.output).filter(output => output.type === 'chunk');
  assert.equal(chunks.length, 1);
  stripped(chunks[0].code);
  routes.set('/vite-production.js', chunks[0].code);
  cases.push({ name: 'vite-production', entry: 'vite-production', dev: false, kind: 'counter' });
  console.log(JSON.stringify({ name: 'vite-production', bytes: Buffer.byteLength(chunks[0].code), gzip: gzipSync(chunks[0].code, { level: 9 }).length }));

  // Public declarations work without Node ambient types. Plugin and runtime
  // subpaths must resolve from the tarball as well as the root entry.
  await writeFile(path.join(consumer, 'types.ts'), `import { component, html, signal, setDevMode } from '@nisli/core';
import { nisliHmr } from '@nisli/core/vite-hmr';
import { __register, __drain } from '@nisli/core/vite-hmr/runtime';
const C = component('typed-fixture', () => html\`<p>\${signal(1)}</p>\`);
setDevMode(null); C({}); nisliHmr(); __register('typed-hmr', () => undefined); __drain();
// @ts-expect-error The package must not add a process global to browser types.
process.env.NODE_ENV;`);
  await writeFile(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    strict: true, noEmit: true, target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler',
    lib: ['ES2022', 'DOM', 'DOM.Iterable', 'ESNext.Disposable'], types: [],
  }, files: ['types.ts'] }));
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', consumer], { stdio: 'inherit' });
  const { nisliHmr } = await import(pathToFileURL(path.join(installed, manifest.exports['./vite-hmr'].default)));
  const transformed = nisliHmr().transform("import {component, html} from '@nisli/core'; const C = component('hmr-check', () => html`<p>ok</p>`);", '/app.js');
  assert(transformed.code.includes('@nisli/core/vite-hmr/runtime'));
  assert(transformed.code.includes('import.meta.hot.accept'));
  console.log('PASS: packed declarations (no Node ambient types), HMR plugin export/transform');

  // Exercise the actual Vite development pipeline and file-watch update, not
  // just the runtime seam. Each browser edits this disposable consumer only.
  const liveComponent = label => `import { component, html, signal, onCleanup } from '@nisli/core';
export const Live = component('live-hmr', () => {
 const n = signal(0); onCleanup(() => { globalThis.liveCleanups = (globalThis.liveCleanups || 0) + 1; });
 return html\`<button id="live" @click=\${() => n.value++}>${label}:\${n}</button>\`;
});`;
  const liveFile = path.join(consumer, 'live-component.js');
  await writeFile(liveFile, liveComponent('initial'));
  await writeFile(path.join(consumer, 'live-entry.js'), `import { html } from '@nisli/core';
import { Live } from './live-component.js'; html\`\${Live({})}\`.mount(document.querySelector('#app'));
globalThis.liveElement = document.querySelector('live-hmr');`);
  await writeFile(path.join(consumer, 'index.html'), '<div id="app"></div><script type="module" src="/live-entry.js"></script>');
  process.env.NODE_ENV = 'development';
  devServer = await createViteServer({ root: consumer, configFile: false, logLevel: 'error', plugins: [nisliHmr()], server: { host: '127.0.0.1', port: 0 } });
  await devServer.listen();
  const devOrigin = `http://127.0.0.1:${devServer.httpServer.address().port}`;

  // Node's actual ESM loader consumes the packed core alongside packed SSG.
  // Only SSG's external DOM implementation is linked from the existing install.
  await pack(path.join(root, 'packages/ssg'), 'ssg');
  const domRoot = path.dirname(path.dirname(require.resolve('happy-dom')));
  await symlink(domRoot, path.join(consumer, 'node_modules/happy-dom'), 'dir');
  await writeFile(path.join(consumer, 'ssg.mjs'), `import assert from 'node:assert/strict';
import { buildStaticSite } from '@nisli/ssg';
import { html, component, signal, effect, onCleanup, createToken, provide, inject } from '@nisli/core';
// The renderer installs DOM before evaluating a component on the second route.
const token = createToken('ssg'); provide(token, () => 'shared');
let cleanups = 0;
const result = await buildStaticSite({ outDir: ${JSON.stringify(path.join(scratch, 'site'))}, routes: [
 {path:'/', render: () => html\`<p>ready</p>\`},
 {path:'/component/', render: () => {
  const C = component('ssg-fixture', () => {
   const value = signal('pending'); effect(() => { value.value = inject(token); });
   onCleanup(() => cleanups++); return html\`<strong>\${value}</strong>\`;
  }); return C({});
 }}] });
assert.equal(result.pages.length, 2); assert(result.pages[1].html.includes('<strong>shared</strong>'));
assert.equal(cleanups, 1); console.log('PASS: packed SSG render, shared DI, reactive settling, disposal');`);
  for (const mode of ['development', 'production']) {
    execFileSync(process.execPath, [path.join(consumer, 'ssg.mjs')], { cwd: consumer, env: { ...process.env, NODE_ENV: mode }, stdio: 'inherit' });
  }

  routes.set('/identity-helper.js', `import {signal,provide,createToken} from '@nisli/core'; export {signal}; export const token=createToken('identity'); provide(token,()=> 'shared override');`);
  routes.set('/identity.js', `import {signal,inject} from '@nisli/core'; import {signal as other,token} from './identity-helper.js'; globalThis.identityResult={sameSignal:signal===other,provided:inject(token)};`);
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<div id="app"></div><script type="importmap">{"imports":{"@nisli/core":"/${url.searchParams.get('mode') || 'development'}.js"}}</script><script type="module" src="/${url.searchParams.get('entry') || 'consumer'}.js"></script>`);
    } else if (routes.has(url.pathname)) {
      res.setHeader('Content-Type', 'text/javascript'); res.end(routes.get(url.pathname));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [engine, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await launcher.launch({ headless: true });
    try {
      for (const item of cases) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.addInitScript(({ override }) => {
          globalThis.overrideMode = override;
          globalThis.recordedErrors = [];
          const original = console.error;
          console.error = (...args) => {
            globalThis.recordedErrors.push(args.map(String).join(' ')); original.apply(console, args);
          };
        }, { override: item.override });
        const label = `${engine}/${item.name}`;
        await page.goto(`${origin}/?mode=${item.mode || 'development'}&entry=${item.entry}`);
        assert.equal(await page.evaluate(() => typeof process), 'undefined', label);
        if (item.kind === 'safety') {
          await page.waitForFunction(() => globalThis.safetyResult);
          const result = await page.evaluate(() => globalThis.safetyResult);
          assert.deepEqual(result.errors, { doubleMount: 'N105', unbranded: 'N106', invalidQueryKey: 'N602', noSanitizer: 'N107' }, label);
          assert.deepEqual(result.lifecycle, { setup: 'N401', mount: 'N402' }, label);
          assert.deepEqual(result.events, ['N401', 'N402'], label);
          assert.deepEqual(result.loop, { settled: true, disposed: true }, label);
          assert.equal(result.eventContinued, true, label);
          assert.deepEqual(result.di, item.dev ? { first: 1, error: 'N501' } : { first: 1, next: 2 }, label);
          assert.deepEqual(result.duplicate, { error: item.dev ? 'N201' : null, content: 'first' }, label);
          const messages = await page.evaluate(() => globalThis.recordedErrors);
          for (const code of ['N401', 'N402']) assert(messages.some(message => message.includes(code)), label);
          assert(messages.some(message => message.includes('Effect error:') && message.includes('async rejection sentinel')), label);
          assert(messages.some(message => message.includes('Event handler error') && message.includes('event rejection sentinel')), label);
          if (!item.dev) for (const code of optional) assert(!messages.some(message => message.includes(code)), label);
        } else if (item.kind === 'hmr') {
          await page.locator('#hmr').click();
          await page.waitForFunction(() => document.querySelector('#hmr')?.textContent === 'before:shared:1');
          assert.deepEqual(await page.evaluate(() => globalThis.replaceSetup()), { sameElement: true, cleanups: 1 }, label);
          await page.locator('#hmr').click();
          await page.waitForFunction(() => document.querySelector('#hmr')?.textContent === 'after:shared:1');
        } else {
          await page.locator('#counter').click();
          await page.waitForFunction(() => document.querySelector('#counter')?.textContent === 'Count: 1');
          const messages = await page.evaluate(() => globalThis.recordedErrors);
          assert.equal(messages.some(message => message.includes('N102')), item.dev, label);
        }
        assert.deepEqual(errors, [], label);
        await page.close();
      }
      const page = await browser.newPage();
      for (const mode of ['development', 'production']) {
        await page.goto(`${origin}/?mode=${mode}&entry=identity`);
        assert.deepEqual(await page.evaluate(() => globalThis.identityResult), { sameSignal: true, provided: 'shared override' });
      }
      await page.close();
      const livePage = await browser.newPage();
      const liveErrors = [];
      livePage.on('pageerror', error => liveErrors.push(String(error)));
      await livePage.goto(devOrigin);
      await livePage.locator('#live').click();
      await livePage.waitForFunction(() => document.querySelector('#live')?.textContent.endsWith(':1'));
      await livePage.evaluate(() => { globalThis.survivedUpdate = true; });
      await writeFile(liveFile, liveComponent(engine));
      await livePage.waitForFunction(label => document.querySelector('#live')?.textContent === `${label}:0`, engine);
      assert.deepEqual(await livePage.evaluate(() => ({
        sameElement: globalThis.liveElement === document.querySelector('live-hmr'),
        survived: globalThis.survivedUpdate, cleanups: globalThis.liveCleanups,
      })), { sameElement: true, survived: true, cleanups: 1 }, `${engine}/Vite live HMR`);
      await livePage.locator('#live').click();
      await livePage.waitForFunction(label => document.querySelector('#live')?.textContent === `${label}:1`, engine);
      assert.deepEqual(liveErrors, [], `${engine}/Vite live HMR`);
      await livePage.close();
      console.log(`PASS: ${engine} ${browser.version()} — ${cases.length} consumer/safety/HMR cases + 2 native identity cases + Vite live HMR`);
    } finally { await browser.close(); }
  }
  console.log('PASS: packed package contract');
} finally {
  if (devServer) await devServer.close();
  if (server) await new Promise(resolve => server.close(resolve));
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  await rm(scratch, { recursive: true, force: true });
}
