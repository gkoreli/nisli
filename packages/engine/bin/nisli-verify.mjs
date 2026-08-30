#!/usr/bin/env node
/**
 * nisli-verify — load a running app in Chromium at every route × width and
 * read the engine's evidence. See src/verify/index.ts for what is checked.
 *
 *   nisli-verify --base http://localhost:5200 --routes / /transactions --widths 1280 360 [--ignore <regex>...] [--open /transactions='[data-nisli-action=add]'] [--height 800] [--timeout 15000] [--json]
 *
 * Exit 0 when there are no findings, 1 when there are, 2 on a usage error.
 * Needs playwright (with Chromium) installed beside the app.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const usage = () => {
  console.error('usage: nisli-verify --base <url> --routes <path>... --widths <px>... [--ignore <regex>...] [--open <route>=<selector>...] [--height <px>] [--timeout <ms>] [--settle <ms>] [--json]');
  process.exit(2);
};

const opts = { base: '', routes: [], widths: [], ignore: [], open: [], height: 800, timeout: 15000, settle: 250, json: false };
let key = null;
for (const a of args) {
  if (a === '--help' || a === '-h') usage();
  if (a === '--json') { opts.json = true; key = null; continue; }
  if (a.startsWith('--')) { key = a.slice(2); if (!(key in opts)) { console.error(`unknown option --${key}`); usage(); } continue; }
  if (key === null) { console.error(`unexpected argument ${a}`); usage(); }
  if (key === 'base') opts.base = a;
  else if (key === 'routes') opts.routes.push(a);
  else if (key === 'widths') opts.widths.push(Number(a));
  else if (key === 'ignore') opts.ignore.push(new RegExp(a));
  else if (key === 'open') { const i = a.indexOf('='); if (i < 1) { console.error(`--open wants <route>=<selector>, got ${a}`); usage(); } opts.open.push({ route: a.slice(0, i), selector: a.slice(i + 1) }); }
  else if (key === 'height' || key === 'timeout' || key === 'settle') opts[key] = Number(a);
}
if (!opts.base || !opts.routes.length || !opts.widths.length || opts.widths.some((w) => !Number.isFinite(w) || w <= 0)) usage();

// The source in a checkout (Node ≥ 22.18 strips types) — never a stale dist beside it — else the built runner of a published package.
const dist = join(HERE, '..', 'dist', 'verify', 'index.js');
const src = join(HERE, '..', 'src', 'verify', 'index.ts');
const { verify, format } = await import(pathToFileURL(existsSync(src) ? src : dist).href);

const result = await verify({ baseUrl: opts.base, routes: opts.routes, widths: opts.widths, ignore: opts.ignore, open: opts.open, height: opts.height, timeout: opts.timeout, settle: opts.settle });
console.log(opts.json ? JSON.stringify(result, null, 2) : format(result));
process.exit(result.ok ? 0 : 1);
