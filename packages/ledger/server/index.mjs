/**
 * Ledger server — the system of record (TENETS §2) and the only place
 * provider secrets live (§4). Zero dependencies; routing only.
 *
 * Env:
 *   PORT  (default 5201)
 *   HOST  (default 127.0.0.1). For Tailscale access run with HOST=<your
 *         tailscale IP> (e.g. 100.x.y.z) or keep localhost and use
 *         `tailscale serve`. Never bind 0.0.0.0 on a public network.
 *   PLAID_CLIENT_ID + PLAID_SECRET → plaid mode (PLAID_ENV: sandbox |
 *         development | production); otherwise mock mode.
 *   LEDGER_KEY  64 hex chars for token encryption; else server/data/.key.
 *
 * Logs: one line per request — method, path, status, ms. Never a token,
 * payee or amount (§8).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLedger, putLedger, listBackups, restoreBackup, loadItems, saveItems, publicItem, StoreError } from './store.mjs';
import { mock } from './providers/mock.mjs';
import { plaidProvider, ProviderError } from './providers/plaid.mjs';

const PORT = Number(process.env.PORT ?? 5201);
const HOST = process.env.HOST ?? '127.0.0.1';
const CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const SECRET = process.env.PLAID_SECRET ?? '';
const provider = CLIENT_ID && SECRET ? plaidProvider({ clientId: CLIENT_ID, secret: SECRET, env: process.env.PLAID_ENV ?? 'sandbox' }) : mock;
const VERSION = JSON.parse(await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 5e7) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});
const bad = (message) => [400, { error: { message } }];

async function route(method, path, body) {
  // ── Ledger document ──
  if (method === 'GET' && path === '/api/health') return [200, { ok: true, mode: provider.name, host: HOST, version: VERSION }];
  if (method === 'GET' && path === '/api/ledger') return [200, await getLedger()];
  if (method === 'PUT' && path === '/api/ledger') {
    if (typeof body.version !== 'number' || body.ledger === undefined || body.ledger === null) return bad('body must be { version: number, ledger }');
    return [200, await putLedger(body.version, body.ledger)];
  }
  if (method === 'GET' && path === '/api/backups') return [200, await listBackups()];
  if (method === 'POST' && path === '/api/backups/restore') return [200, await restoreBackup(body.name)];

  // ── Bank ──
  if (method === 'GET' && path === '/api/bank/status') return [200, { mode: provider.name, env: provider.env }];
  if (method === 'POST' && path === '/api/bank/link-token') return [200, await provider.linkToken()];
  if (method === 'POST' && path === '/api/bank/exchange') {
    const items = await loadItems();
    const item = await provider.exchange(body);
    await saveItems([...items.filter((x) => x.id !== item.id), item]);
    return [200, publicItem(item)];
  }
  if (method === 'GET' && path === '/api/bank/items') return [200, (await loadItems()).map(publicItem)];
  if (method === 'POST' && path === '/api/bank/sync') {
    const items = await loadItems();
    const item = items.find((x) => x.id === body.itemId);
    if (!item) return [404, { error: { message: 'Unknown item' } }];
    const out = await provider.sync(item);
    item.accounts = out.accounts;
    item.cursor = out.cursor ?? item.cursor;
    await saveItems(items);
    return [200, out];
  }
  const del = method === 'DELETE' && /^\/api\/bank\/items\/([^/]+)$/.exec(path);
  if (del) {
    const items = await loadItems();
    const item = items.find((x) => x.id === decodeURIComponent(del[1]));
    if (!item) return [404, { error: { message: 'Unknown item' } }];
    await provider.remove(item);
    await saveItems(items.filter((x) => x !== item));
    return [200, { ok: true }];
  }
  return [404, { error: { message: `No route for ${method} ${path}` } }];
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const started = Date.now();
  let status = 500;
  try {
    const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : {};
    const [s, out] = await route(req.method ?? 'GET', url.pathname, body);
    status = s;
    json(res, s, out);
  } catch (err) {
    if (err instanceof StoreError && err.status === 409) { status = 409; json(res, 409, { error: { message: err.message }, version: err.version, ledger: err.ledger }); }
    else { status = err instanceof StoreError || err instanceof ProviderError ? err.status : 500; json(res, status, { error: { message: err?.message ?? 'Server error' } }); }
  } finally {
    console.log(`${req.method} ${url.pathname} → ${status} (${Date.now() - started}ms)`);
  }
}).listen(PORT, HOST, () => console.log(`ledger server: ${provider.name} mode (${provider.env}) on http://${HOST}:${PORT}`));
