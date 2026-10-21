import { readFile, writeFile, readdir, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { here, root, profiles } from './run.mjs';
const tests=[];
async function collect(dir,prefix='') {
  for(const e of await readdir(dir,{withFileTypes:true})) {
    const rel=path.join(prefix,e.name);
    if(e.isDirectory())await collect(path.join(dir,e.name),rel);
    else if(e.name.endsWith('.test.ts'))tests.push([rel,await readFile(path.join(dir,e.name),'utf8')]);
  }
}
await collect(path.join(root,'packages/core/src'));
for(const profile of ['static-dev','static-bundler']) {
  const testRoot=path.join(here,'generated/regression',profile);
  await rm(testRoot,{recursive:true,force:true});
  await cp(profiles[profile],testRoot,{recursive:true});
  for(const [name,text] of tests) {
    const dest=path.join(testRoot,name);
    await mkdir(path.dirname(dest),{recursive:true});
    await writeFile(dest,text);
  }
  const config=path.join(testRoot,'vitest.config.mjs');
  await writeFile(config,`export default {root:${JSON.stringify(testRoot)},test:{globals:true,environment:'happy-dom'}};`);
  const output=execFileSync('pnpm',['exec','vitest','run','--config',config],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  await writeFile(path.join(here,`${profile}-regression.txt`),output);
  console.log(profile,output.slice(output.lastIndexOf(' Test Files')));
}
