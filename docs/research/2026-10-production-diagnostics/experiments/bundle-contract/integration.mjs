import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';
import { here, root, generated, profiles, esbuild, bundle, vmRun } from './run.mjs';
const summary = {};
const tarball = path.join(generated, 'nisli-core-0.56.0.tgz');
summary.publishedTarballSha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
const extracted = path.join(generated, 'published');
await mkdir(extracted, {recursive:true});
execFileSync('tar',['-xzf',tarball,'-C',extracted]);
profiles.published = path.join(extracted,'package/dist');
const publishedRows = [];
for (const [name, options, fixture, expected] of [
  ['published-minify',{},'upstream/entry.js',true],
  ['published-node-env',{define:{'process.env.NODE_ENV':'"production"'}},'upstream/entry.js',true],
  ['published-meta',{define:{'import.meta.env':'{"DEV":false,"PROD":true}'}},'upstream/entry.js',false],
  ['published-runtime-off',{},'upstream/entry-off.js',false],
]) {
  const row = await bundle(name,'published',options,fixture);
  const observed = await vmRun(row);
  assert.equal(observed.codes.includes('N102'),expected);
  assert(row.auditBytes>0);
  publishedRows.push({...row,...observed,expectedN102:expected});
}
summary.published = publishedRows.map(({text,...r})=>r);
console.log('PUBLISHED REPRODUCTION', JSON.stringify(summary.published));
const sameFixture = await bundle('prototype-upstream-fixture','static-bundler',{},'upstream/entry.js');
assert.equal(sameFixture.auditBytes,0);
assert.deepEqual((await vmRun(sameFixture)).codes,[]);
summary.sameFixturePrototype = (({text,...r})=>r)(sameFixture);
console.log('SAME FIXTURE PROTOTYPE',JSON.stringify(summary.sameFixturePrototype));

// Exercise publishConfig, the packed artifact, and normal package resolution.
const pkg = path.join(generated,'package-candidate');
const packed = path.join(generated,'packed');
const consumer = path.join(generated,'installed-consumer');
await rm(pkg,{recursive:true,force:true});
await rm(consumer,{recursive:true,force:true});
await mkdir(pkg,{recursive:true});
await mkdir(packed,{recursive:true});
await mkdir(consumer,{recursive:true});
await cp(profiles['static-bundler'],path.join(pkg,'dist/bundler'),{recursive:true});
for(const mode of ['dev','prod']) {
  await esbuild.build({entryPoints:[path.join(profiles[`static-${mode}`],'index.js')],outfile:path.join(pkg,`dist/browser/${mode}.js`),bundle:true,format:'esm',platform:'neutral',target:'es2024',minify:mode==='prod',treeShaking:true,logLevel:'silent'});
}
await writeFile(path.join(pkg,'package.json'),JSON.stringify({
  name:'@nisli/core',version:'0.56.0-research',type:'module',files:['dist'],
  exports:{'.':'./src/index.ts'},
  publishConfig:{exports:{'.':'./dist/bundler/index.js','./browser/development':'./dist/browser/dev.js','./browser/production':'./dist/browser/prod.js'}},
},null,2));
const packOutput = execFileSync('pnpm',['pack','--pack-destination',packed],{cwd:pkg,encoding:'utf8'});
await writeFile(path.join(here,'pack-output.txt'),packOutput);
const candidateTarball = path.join(packed,'nisli-core-0.56.0-research.tgz');
await writeFile(path.join(consumer,'package.json'),JSON.stringify({name:'isolated-consumer',private:true,type:'module'}));
const installOutput = execFileSync('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund',candidateTarball],{cwd:consumer,encoding:'utf8'});
await writeFile(path.join(here,'install-output.txt'),installOutput);
const installed = JSON.parse(await readFile(path.join(consumer,'node_modules/@nisli/core/package.json')));
assert.equal(installed.exports['.'],'./dist/bundler/index.js');
assert.deepEqual(installed.dependencies,undefined);
await cp(path.join(here,'consumer.js'),path.join(consumer,'entry.js'));
const consumerBuild = await esbuild.build({entryPoints:[path.join(consumer,'entry.js')],bundle:true,platform:'browser',format:'esm',target:'es2024',minify:true,write:false,metafile:true});
const packageResult = {name:'packed-esbuild',text:consumerBuild.outputFiles[0].text};
assert.equal(packageResult.text.includes('N102'),false);
assert(!Object.values(consumerBuild.metafile.outputs).some(o=>Object.entries(o.inputs).some(([p,v])=>p.endsWith('template-audit.js')&&v.bytesInOutput>0)));
assert.deepEqual((await vmRun(packageResult)).codes,[]);
summary.packed = {exports:installed.exports,bytes:Buffer.byteLength(packageResult.text),gzip:gzipSync(packageResult.text,{level:9}).length,diagnostics:false,auditBytes:0};
console.log('PACKED CONSUMER',JSON.stringify(summary.packed));

// Vite is a second real consumer bundler; no Nisli plugin/define is installed.
const vite = await import(pathToFileURL(path.join(root,'node_modules/.pnpm/vite@7.3.6_@types+node@22.19.17_jiti@2.7.0_lightningcss@1.32.0/node_modules/vite/dist/node/index.js')));
const viteResult = await vite.build({root:consumer,configFile:false,logLevel:'silent',build:{write:false,minify:'esbuild',target:'es2024',rollupOptions:{input:path.join(consumer,'entry.js'),output:{format:'es'}}}});
const chunks = (Array.isArray(viteResult)?viteResult:[viteResult]).flatMap(x=>x.output).filter(x=>x.type==='chunk');
assert.equal(chunks.length,1);
const viteRow = {name:'packed-vite',text:chunks[0].code};
assert(!viteRow.text.includes('N102'));
assert(!viteRow.text.includes('effect() created here'));
assert.deepEqual((await vmRun(viteRow)).codes,[]);
summary.vite = {version:'7.3.6',bytes:Buffer.byteLength(viteRow.text),gzip:gzipSync(viteRow.text,{level:9}).length,diagnostics:false};
console.log('VITE PRODUCTION',JSON.stringify(summary.vite));

// Falsification: development conditional exports are not selected by esbuild
// just because minification is off or NODE_ENV is defined as development.
const conditional = path.join(consumer,'node_modules/conditional-probe');
await mkdir(conditional,{recursive:true});
await writeFile(path.join(conditional,'package.json'),JSON.stringify({name:'conditional-probe',type:'module',exports:{development:'./dev.js',default:'./prod.js'}}));
await writeFile(path.join(conditional,'dev.js'),'export const profile="development";');
await writeFile(path.join(conditional,'prod.js'),'export const profile="production";');
summary.conditions=[];
for(const [name,opts,expected] of [
  ['esbuild-nonminified', {minify:false}, 'production'],
  ['esbuild-node-env-development',{define:{'process.env.NODE_ENV':'"development"'}},'production'],
  ['esbuild-development-condition',{conditions:['development']},'development'],
]) {
  const result=await esbuild.build({stdin:{contents:'export { profile } from "conditional-probe"',resolveDir:consumer},bundle:true,platform:'browser',format:'esm',write:false,...opts});
  const module=await import('data:text/javascript,'+encodeURIComponent(result.outputFiles[0].text));
  assert.equal(module.profile,expected);
  summary.conditions.push({name,selected:module.profile});
}
console.log('CONDITIONAL EXPORT FALSIFICATION',JSON.stringify(summary.conditions));

// A second trap: independently bundled core profiles create separate DI state.
await writeFile(path.join(consumer,'mixed.js'),`import {provide} from '@nisli/core';
import {inject} from '@nisli/core/browser/production';
class Service { value = 'default'; }
provide(Service, () => ({value:'override'}));
globalThis.mixedResult = inject(Service).value;`);
const mixed=await esbuild.build({entryPoints:[path.join(consumer,'mixed.js')],bundle:true,platform:'browser',format:'esm',write:false,minify:true});

// Serve actual package artifacts to browsers. The native case uses an import
// map and NO application compiler/bundler or process global.
const nativeConsumer=await readFile(path.join(here,'consumer.js'),'utf8');
const nativeSafety=await readFile(path.join(here,'safety.js'),'utf8');
const nativeDev=await readFile(path.join(pkg,'dist/browser/dev.js'),'utf8');
const nativeProd=await readFile(path.join(pkg,'dist/browser/prod.js'),'utf8');
assert(!nativeProd.includes('N102'));
assert(!nativeProd.includes('process.env'));
assert(!nativeDev.includes('process.env'));
const routes=new Map([
  ['/dev.js',nativeDev],['/prod.js',nativeProd],['/consumer.js',nativeConsumer],['/safety.js',nativeSafety],
  ['/mixed.js',mixed.outputFiles[0].text],['/packed-esbuild.js',packageResult.text],['/packed-vite.js',viteRow.text],
  ['/identity-helper.js',`import {signal,provide,createToken} from '@nisli/core'; export {signal}; export const token=createToken('identity'); provide(token,()=> 'shared override');`],
  ['/identity.js',`import {signal,inject} from '@nisli/core'; import {signal as other,token} from './identity-helper.js'; globalThis.identityResult={sameSignal:signal===other,provided:inject(token)};`],
  ...publishedRows.map(r=>[`/${r.name}.js`,r.text]),
]);
const server=createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/') {
    const mode=u.searchParams.get('mode')||'dev';
    const entry=u.searchParams.get('entry')||'consumer';
    res.setHeader('Content-Type','text/html');
    res.end(`<div id="app"></div><script type="importmap">{"imports":{"@nisli/core":"/${mode}.js"}}</script><script type="module" src="/${entry}.js"></script>`);
  } else if(routes.has(u.pathname)) {res.setHeader('Content-Type','text/javascript');res.end(routes.get(u.pathname));}
  else {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
summary.browsers=[];
try {
  for(const [engine,launcher] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]) {
    const browser=await launcher.launch({headless:true});
    try {
      const cases=[];
      for(const [name,mode,entry,expected,safety] of [
        ['native-dev','dev','consumer',true,false],['native-prod','prod','consumer',false,false],
        ['native-prod-safety','prod','safety',false,true],
        ['packed-esbuild','prod','packed-esbuild',false,false],['packed-vite','prod','packed-vite',false,false],
        ...publishedRows.map(r=>[r.name,'dev',r.name,r.expectedN102,false]),
      ]) {
        const page=await browser.newPage();
        await page.addInitScript(()=>{
          globalThis.recordedErrors=[];
          const original=console.error;
          console.error=(...args)=>{
            globalThis.recordedErrors.push(args.map(String).join(' '));
            original.apply(console,args);
          };
        });
        const codes=[];const errors=[];const messages=[];
        page.on('console',m=>{if(m.type()==='error'){messages.push(m.text());codes.push(...Array.from(m.text().matchAll(/\[nisli (N\d+)\]/g),m=>m[1]));}});
        page.on('pageerror',e=>errors.push(String(e)));
        await page.goto(`${origin}/?mode=${mode}&entry=${entry}`);
        assert.equal(await page.evaluate(()=>typeof process),'undefined');
        if(safety) {
          const r=await page.evaluate(()=>globalThis.safetyResult);
          assert.deepEqual(r.errors,{doubleMount:'N105',unbranded:'N106',invalidQueryKey:'N602',noSanitizer:'N107'});
          assert.deepEqual(r.lifecycle,{setup:'N401',mount:'N402'});
          assert.deepEqual(r.loop,{settled:true,disposed:true});
          assert(codes.includes('N401')&&codes.includes('N402'));
          const recordedErrors=await page.evaluate(()=>globalThis.recordedErrors);
          assert(recordedErrors.some(m=>m.includes('Effect error:')&&m.includes('async rejection sentinel')),JSON.stringify({engine,messages,recordedErrors}));
        } else {
          await page.locator('#counter').click();
          await page.waitForFunction(()=>document.querySelector('#counter')?.textContent==='Count: 1');
          assert.equal(codes.includes('N102'),expected,name);
        }
        assert.deepEqual(errors,[],`${engine}/${name}`);
        cases.push({name,codes:[...new Set(codes)],passed:true});
        await page.close();
      }
      const page=await browser.newPage();
      await page.goto(`${origin}/?entry=mixed`);
      const mixedResult=await page.evaluate(()=>globalThis.mixedResult);
      assert.equal(mixedResult,'default','A mixed-profile graph must demonstrate the lost DI override');
      for(const mode of ['dev','prod']) {
        await page.goto(`${origin}/?mode=${mode}&entry=identity`);
        assert.deepEqual(await page.evaluate(()=>globalThis.identityResult),{sameSignal:true,provided:'shared override'});
      }
      await page.close();
      const result={engine,version:browser.version(),cases,mixedProfilesLoseDIOverride:mixedResult==='default',canonicalImportMapSharesRuntime:true};
      summary.browsers.push(result);
      console.log('REAL BROWSER',JSON.stringify(result));
    } finally {await browser.close();}
  }
} finally {await new Promise(resolve=>server.close(resolve));}
await writeFile(path.join(here,'integration-results.json'),JSON.stringify(summary,null,2)+'\n');
console.log('PASS: published reproduction, pnpm pack/install, two bundlers, native ESM and safety in three browsers; two alternatives falsified.');
