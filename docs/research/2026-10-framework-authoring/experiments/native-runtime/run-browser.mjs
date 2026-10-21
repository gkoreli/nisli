import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { snapshotRoot, commit } from './prepare.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../../..');
const fromCore = createRequire(resolve(repo, 'packages/core/package.json'));
const fromRoot = createRequire(resolve(repo, 'package.json'));
const { build } = fromCore('esbuild');
const { chromium, firefox, webkit } = fromRoot('playwright');
const browserDir = resolve(snapshotRoot, 'browser'); mkdirSync(browserDir, { recursive:true });
// Prepare the library artifact once. Application and prototype modules are
// passed straight to the browser without transformation, bundling or a shim.
await build({ entryPoints:[resolve(snapshotRoot, 'packages/core/src/index.ts')],
  outfile:resolve(browserDir,'core.js'), bundle:true, format:'esm', platform:'browser',
  target:'es2022', define:{'process.env.NODE_ENV':'"production"'}, logLevel:'silent' });
const routes = new Map([
  ['/core.js', resolve(browserDir,'core.js')],
  ['/browser.mjs',resolve(here,'browser.mjs')],
  ['/prototype.mjs',resolve(here,'prototype.mjs')],
  ['/factory-retention.mjs',resolve(here,'factory-retention.mjs')],
  ['/input.js',resolve(snapshotRoot,'packages/ui/registry/default/ui/input.js')],
  ['/slider.js',resolve(snapshotRoot,'packages/ui/registry/default/ui/slider.js')],
  ['/lib/utils.js',resolve(snapshotRoot,'packages/ui/registry/default/lib/utils.js')],
]);
const imports = { '@nisli/core':'/core.js', '@fixture/input':'/input.js', '@fixture/slider':'/slider.js' };
const index = `<!doctype html><meta charset="utf-8"><script type="importmap">${JSON.stringify({imports})}</script><script type="module" src="/browser.mjs"></script>`;
const server = createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(index);return;}
  const file=routes.get(url.pathname);
  if(!file){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type','text/javascript');res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
console.log(JSON.stringify({commit,libraryArtifact:'bundled frozen core with production define',
  applicationModules:['browser.mjs','prototype.mjs','factory-retention.mjs'].map(name=>({name,servedUnmodified:true,
    sha256:createHash('sha256').update(readFileSync(resolve(here,name))).digest('hex')}))}));
let failures=0;
try {
  for(const [name,type] of [['chromium',chromium],['firefox',firefox],['webkit',webkit]]){
    let browser;
    try{
      browser=await type.launch();const page=await browser.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.waitForFunction(()=>Array.isArray(window.probeResult),{},{timeout:10000});
      const checks=await page.evaluate(()=>window.probeResult);
      const failed=checks.filter(c=>!c.pass);failures+=failed.length+errors.length;
      console.log(JSON.stringify({browser:name,version:browser.version(),checks,errors}));
    }catch(error){failures++;console.log(JSON.stringify({browser:name,infrastructureError:String(error)}));}
    finally{await browser?.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({failures,verdict:failures?'FAIL':'PASS'}));
process.exitCode=failures?1:0;
