import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createContext, SourceTextModule } from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { Window } from 'happy-dom';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const esbuild = await import(pathToFileURL(path.join(root, 'node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js')));
const generated = path.join(here, 'generated');
await mkdir(generated, { recursive: true });
const sourceRoot = path.join(root, 'packages/core/src');
const sources = {};
async function collect(dir, prefix = '') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, e.name);
    if (e.isDirectory()) await collect(path.join(dir, e.name), rel);
    else if (e.name.endsWith('.ts') && !/\.test(-d)?\.ts$/.test(e.name)) sources[rel] = await readFile(path.join(dir, e.name), 'utf8');
  }
}
await collect(sourceRoot);
function replaceOnce(source, from, to) {
  assert(source.includes(from), `Missing replacement anchor: ${from}`);
  assert.equal(source.split(from).length, 2, `Ambiguous replacement anchor: ${from}`);
  return source.replace(from, to);
}
function patchProbe(source) {
  const start = source.indexOf('  const nodeEnv = (globalThis as {');
  const end = source.indexOf('  // 3) No signal', start);
  assert(start > 0 && end > start);
  return source.slice(0, start) + `  try {
    const nodeEnv = process.env.NODE_ENV;
    if (typeof nodeEnv === 'string') return nodeEnv !== 'production';
  } catch { /* absent process in native browser ESM */ }
` + source.slice(end);
}
function staticGuards(name, source) {
  if (name === 'diagnostics.ts') {
    const start = source.indexOf('function probeDevMode()');
    const end = source.indexOf('let override:', start);
    source = source.slice(0, start) + source.slice(end);
    source = source.replace('return override ?? probed;', 'return __NISLI_DEV__ && (override ?? true);');
    return source;
  }
  // A throwaway AST rewrite, not a proposed production codemod. Guard every
  // existing isDev call and signal diagnostic payload at its call site.
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const changed = ts.transform(sf, [context => {
    const f = context.factory;
    const dev = () => f.createIdentifier('__NISLI_DEV__');
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'isDev') {
        return f.createParenthesizedExpression(f.createBinaryExpression(dev(), ts.SyntaxKind.AmpersandAmpersandToken, node));
      }
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
        const target = node.expression.expression.text;
        if ((name === 'template.ts' && ['auditTemplate', 'captureCallsite'].includes(target)) || (name === 'signal.ts' && target === 'diag')) {
          return f.createIfStatement(dev(), node);
        }
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit);
  }]);
  source = ts.createPrinter().printFile(changed.transformed[0]);
  changed.dispose();
  if (name === 'template-audit.ts') {
    source = replaceOnce(source, 'return enabledOverride ??', 'return __NISLI_DEV__ && (enabledOverride ??');
    source = source.replace('( __NISLI_DEV__', '(__NISLI_DEV__');
    source = source.replace(/return __NISLI_DEV__ && \(enabledOverride \?\? ([^;]+);/, 'return __NISLI_DEV__ && (enabledOverride ?? $1);');
    // Avoid module initialization costs even if another export is retained.
    source = source.replace(/(const (?:callsites|audited|KNOWN_MODIFIERS|GLOBAL_ATTRS|NATIVE_EVENTS_WITHOUT_IDL) = )([^;]+);/g, '$1__NISLI_DEV__ ? $2 : null;');
  }
  if (name === 'component.ts') {
    source = source.replace('const readKeys = new Set<string>();', 'const readKeys = __NISLI_DEV__ ? new Set<string>() : null;');
    source = source.replace('readKeys.add(key);', 'if (__NISLI_DEV__) readKeys!.add(key);');
    source = source.replace('const firstDefineSites = new Map<string, string>();', 'const firstDefineSites = __NISLI_DEV__ ? new Map<string, string>() : null;');
  }
  if (name === 'signal.ts') {
    source = source.replace('runningEffect !== null &&', '__NISLI_DEV__ && runningEffect !== null &&');
    source = source.replace('const prevRunning = runningEffect;', 'const prevRunning = __NISLI_DEV__ ? runningEffect : null;');
    source = source.replace('runningEffect = node;', 'if (__NISLI_DEV__) runningEffect = node;');
    source = source.replace('runningEffect = prevRunning;', 'if (__NISLI_DEV__) runningEffect = prevRunning;');
  }
  return source;
}

// Emit module trees without bundling. This retains the published-package
// boundary and lets the consumer's bundler make the elimination decision.
async function emit(profile) {
  const out = path.join(generated, profile);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const [name, original] of Object.entries(sources)) {
    let text = original;
    if (profile === 'probe-only' && name === 'diagnostics.ts') text = patchProbe(text);
    if (profile === 'helper-false' && name === 'diagnostics.ts') text = text.replace('return override ?? probed;', 'return false;');
    if (profile.startsWith('static-')) text = staticGuards(name, text);
    if (profile === 'static-bundler') text = text.replaceAll('__NISLI_DEV__', '(process.env.NODE_ENV !== "production")');
    const define = profile === 'static-prod' ? { __NISLI_DEV__: 'false' } : profile === 'static-dev' ? { __NISLI_DEV__: 'true' } : {};
    const transformed = await esbuild.transform(text, { loader: 'ts', format: 'esm', target: 'es2024', define, minifySyntax: true, sourcemap: false });
    const output = path.join(out, name.replace(/\.ts$/, '.js'));
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, transformed.code);
  }
  await writeFile(path.join(out, 'package.json'), JSON.stringify({ name: '@nisli/core', version: '0.56.0-research', type: 'module', exports: { '.': './index.js' } }, null, 2));
  return out;
}
const profiles = Object.fromEntries(['current', 'probe-only', 'helper-false', 'static-bundler', 'static-dev', 'static-prod'].map(name => [name, path.join(generated, name)]));

async function bundle(name, profile, options = {}, fixture = 'consumer.js') {
  const result = await esbuild.build({
    entryPoints: [path.join(here, fixture)], outfile: path.join(generated, `${name}.js`),
    alias: { '@nisli/core': path.join(profiles[profile], 'index.js') },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2024',
    minify: true, treeShaking: true, write: false, metafile: true, logLevel: 'silent', ...options,
  });
  const text = result.outputFiles[0].text;
  await writeFile(path.join(generated, `${name}.js`), text);
  await writeFile(path.join(generated, `${name}.meta.json`), JSON.stringify(result.metafile, null, 2));
  const auditBytes = Object.values(result.metafile.outputs).reduce((n, o) => n + Object.entries(o.inputs).filter(([p]) => p.endsWith('/template-audit.js')).reduce((s, [,v]) => s + v.bytesInOutput, 0), 0);
  return { name, profile, text, bytes: Buffer.byteLength(text), gzip: gzipSync(text, { level: 9 }).length, auditBytes, n102Text: text.includes('N102'), stackCapture: text.includes('effect() created here'), sha256: createHash('sha256').update(text).digest('hex') };
}

async function vmRun(row, overrideMode, safety = false) {
  const window = new Window();
  window.document.body.innerHTML = '<div id="app"></div>';
  const codes = [];
  const messages = [];
  const sandbox = {};
  for (const k of ['document','customElements','HTMLElement','Element','Node','Text','Comment','DocumentFragment','HTMLTemplateElement','MutationObserver','Event','CustomEvent','EventTarget']) sandbox[k] = window[k];
  Object.assign(sandbox, { queueMicrotask, setTimeout, clearTimeout, overrideMode, console: { error: (...args) => { messages.push(args.map(String).join(' ')); codes.push(...Array.from(String(args[0]).matchAll(/\[nisli (N\d+)\]/g), m => m[1])); }, log() {}, warn() {} } });
  assert.equal('process' in sandbox, false);
  const context = createContext(sandbox);
  const module = new SourceTextModule(row.text, { context, identifier: row.name });
  await module.link(() => { throw Error('Unexpected external import'); });
  await module.evaluate();
  await new Promise(resolve => setTimeout(resolve, 5));
  if (safety) {
    const value = JSON.parse(JSON.stringify(context.safetyResult));
    await window.happyDOM.close();
    return { codes: [...new Set(codes)], result: value, asyncRejectionReported: messages.some(m => m.includes('Effect error:') && m.includes('async rejection sentinel')) };
  }
  const b = window.document.querySelector('#counter');
  assert.equal(b?.textContent, 'Count: 0');
  b.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(b.textContent, 'Count: 1');
  await window.happyDOM.close();
  return { codes, counter: 'Count: 1' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
for (const name of Object.keys(profiles)) await emit(name);
const matrix = [
  ['current-minify', 'current', {}, undefined, true],
  ['current-node-env', 'current', { define: { 'process.env.NODE_ENV': '"production"' } }, undefined, true],
  ['current-meta', 'current', { define: { 'import.meta.env': '{"DEV":false,"PROD":true}' } }, undefined, false],
  ['current-runtime-off', 'current', {}, false, false],
  ['probe-only-minify', 'probe-only', {}, undefined, false],
  ['helper-false', 'helper-false', {}, undefined, false],
  ['static-auto-prod', 'static-bundler', {}, undefined, false],
  ['static-explicit-prod', 'static-bundler', { define: { 'process.env.NODE_ENV': '"production"' } }, undefined, false],
  ['static-prod-override-on', 'static-bundler', {}, true, false],
  ['static-dev-minified', 'static-bundler', { define: { 'process.env.NODE_ENV': '"development"' } }, undefined, true],
  ['static-auto-dev', 'static-bundler', { minify: false }, undefined, true],
  ['static-dev-off', 'static-bundler', { define: { 'process.env.NODE_ENV': '"development"' } }, false, false],
  ['native-dev-bundled-neutral', 'static-dev', { platform: 'neutral' }, undefined, true],
  ['native-prod-bundled-neutral', 'static-prod', { platform: 'neutral' }, true, false],
];
const rows = [];
for (const [name, profile, options, override, expected] of matrix) {
  const row = await bundle(name, profile, options);
  Object.assign(row, await vmRun(row, override), { expectedN102: expected, override });
  assert.equal(row.codes.includes('N102'), expected, name);
  if (['static-auto-prod','static-explicit-prod','static-prod-override-on','native-prod-bundled-neutral'].includes(name)) {
    assert.equal(row.auditBytes, 0, `${name}: entire audit module must disappear`);
    assert.equal(row.n102Text, false);
    assert.equal(row.stackCapture, false);
  }
  if (name.startsWith('current-') || name === 'probe-only-minify') assert(row.auditBytes > 0);
  rows.push(row);
}
console.log('ENVIRONMENT', JSON.stringify({ node: process.version, esbuild: esbuild.version, happyDom: JSON.parse(await readFile(path.join(root,'node_modules/happy-dom/package.json'))).version, commit: execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim() }));
console.table(rows.map(({name, bytes,gzip,auditBytes,n102Text,codes})=>({name,bytes,gzip,auditBytes,n102Text,codes:codes.join(',')||'-'})));

const safetyRows = [];
for (const profile of ['current', 'static-bundler', 'static-dev', 'static-prod']) {
  const row = await bundle(`safety-${profile}`, profile, {}, 'safety.js');
  const r = await vmRun(row, undefined, true);
  assert.deepEqual(r.result.errors, { doubleMount: 'N105', unbranded: 'N106', invalidQueryKey: 'N602', noSanitizer: 'N107' });
  assert.equal(r.asyncRejectionReported,true);
  assert.deepEqual(r.result.lifecycle, { setup: 'N401', mount: 'N402' });
  assert.deepEqual(r.result.loop, { settled: true, disposed: true });
  assert(r.codes.includes('N401') && r.codes.includes('N402'));
  if (['static-bundler','static-prod'].includes(profile)) {
    assert.deepEqual(r.result.di, {first:1,next:2});
    assert.deepEqual(r.result.duplicate, {error:null});
    assert(!r.codes.some(c=>['N301','N302','N310'].includes(c)));
  } else {
    assert.deepEqual(r.result.di, {first:1,error:'N501'});
    assert.deepEqual(r.result.duplicate, {error:'N201'});
  }
  safetyRows.push({ profile, ...r });
}
console.log('SAFETY', JSON.stringify(safetyRows));

const browser = await chromium.launch({ headless: true });
const browserRows = [];
try {
  for (const row of rows) {
    const page = await browser.newPage();
    const codes = [];
    const failures = [];
    page.on('console', msg => { if(msg.type()==='error') codes.push(...Array.from(msg.text().matchAll(/\[nisli (N\d+)\]/g),m=>m[1])); });
    page.on('pageerror', err=>failures.push(String(err)));
    await page.setContent('<div id="app"></div>');
    if(row.override!==undefined) await page.evaluate(value=>globalThis.overrideMode=value,row.override);
    await page.addScriptTag({ type:'module', content:row.text });
    await page.locator('#counter').click();
    await page.waitForFunction(()=>document.querySelector('#counter')?.textContent==='Count: 1');
    assert.equal(await page.evaluate(()=>typeof process), 'undefined');
    assert.equal(codes.includes('N102'),row.expectedN102,row.name);
    assert.deepEqual(failures,[]);
    browserRows.push({name:row.name,codes,counter:'Count: 1',process:'undefined'});
    await page.close();
  }
  console.log('BROWSER', JSON.stringify({ version:browser.version(), rows:browserRows }));
} finally { await browser.close(); }
const summary = { environment:{ node:process.version, esbuild:esbuild.version }, rows:rows.map(({text,...r})=>r), safety:safetyRows, browser:browserRows };
await writeFile(path.join(here,'results.json'),JSON.stringify(summary,null,2)+'\n');
console.log('PASS: full counter matrix, emitted audit removal, safety behavior, and real Chromium interaction.');
}
export { here, root, generated, profiles, esbuild, bundle, vmRun };
