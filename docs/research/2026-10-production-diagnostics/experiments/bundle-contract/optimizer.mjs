import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { here, esbuild } from './run.mjs';
const rows=[];
for(const [name,modules,retained] of [
  ['local-literal',{entry:'const DEV=false; function audit(){console.log("audit sentinel")} if(DEV) audit();'},false],
  ['local-node-env',{entry:'const DEV=process.env.NODE_ENV!=="production"; function audit(){console.log("audit sentinel")} if(DEV) audit();'},false],
  ['safe-runtime-fallback',{entry:'const DEV=typeof process==="undefined" || process.env.NODE_ENV!=="production"; function audit(){console.log("audit sentinel")} if(DEV) audit();'},true],
  ['imported-constant',{entry:'import { DEV } from "env"; function audit(){console.log("audit sentinel")} if(DEV) audit();',env:'export const DEV=false;'},true],
]) {
  const out=await esbuild.build({entryPoints:['entry'],bundle:true,platform:'browser',minify:true,write:false,plugins:[{name:'virtual',setup(b){b.onResolve({filter:/.*/},a=>({path:a.path,namespace:'virtual'}));b.onLoad({filter:/.*/,namespace:'virtual'},a=>({contents:modules[a.path]}));}}]});
  const output=out.outputFiles[0].text;
  assert.equal(output.includes('audit sentinel'),retained,name);
  rows.push({name,source:modules,output,auditRetained:retained});
}
await writeFile(path.join(here,'optimizer-results.json'),JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
console.log('PASS: local static guards remove the sentinel; safe runtime fallback and imported constants fail this removal contract in esbuild 0.28.1.');
