/* Blame test: is intent's [data-align] rule set the CAUSE of the measured bleed? */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'dist';
const CSS = { a: process.env.CSS_A, b: process.env.CSS_B };
let variant = 'a';
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/assets/site.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(readFileSync(CSS[variant])); }
  if (url.pathname === '/assets/intent.css') { res.writeHead(200, { 'content-type': 'text/css' }); return res.end(''); }
  let p = join(ROOT, url.pathname);
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const SNAP = `(() => [...document.querySelectorAll('*')].map((el) => {
  const c = getComputedStyle(el); const rec = {};
  for (let i = 0; i < c.length; i++) { const k = c[i]; if (!k.startsWith('--')) rec[k] = c.getPropertyValue(k); }
  const r = el.getBoundingClientRect();
  return { tag: el.tagName, rec, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
}))()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
const page = await ctx.newPage();
const snap = async (v, path) => { variant = v; await page.goto(base + path, { waitUntil: 'load' }); return page.evaluate(SNAP); };

let P = 0, B = 0; const detail = [];
for (const path of process.argv.slice(2)) {
  const a = await snap('a', path), b = await snap('b', path);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    for (const k in a[i].rec) if (a[i].rec[k] !== b[i].rec[k]) { P++; if (detail.length < 8) detail.push(`${path} #${i} <${a[i].tag}> ${k}: ${a[i].rec[k]} -> ${b[i].rec[k]}`); }
    if (a[i].box.join() !== b[i].box.join()) { B++; if (detail.length < 8) detail.push(`${path} #${i} <${a[i].tag}> BOX ${a[i].box} -> ${b[i].box}`); }
  }
}
console.log(`props=${P} boxes=${B}`);
for (const d of detail) console.log('  ' + d);
await browser.close(); server.close();
