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
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLedger, putLedger, listBackups, restoreBackup, loadConnections, updateConnections, updateLedger, StoreError } from './store.mjs';
import { mock } from './providers/mock.mjs';
import { plaidProvider, ProviderError } from './providers/plaid.mjs';
import { BankingError, createBankingService, shouldRunDaily } from './bank-sync.mjs';

const PORT = Number(process.env.PORT ?? 5201);
const HOST = process.env.HOST ?? '127.0.0.1';
const CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const SECRET = process.env.PLAID_SECRET ?? '';
const REDIRECT_URI = process.env.PLAID_REDIRECT_URI ?? '';
const SYNC_HOUR = Number(process.env.LEDGER_SYNC_HOUR ?? 6);
if (!Number.isInteger(SYNC_HOUR) || SYNC_HOUR < 0 || SYNC_HOUR > 23) throw new Error('LEDGER_SYNC_HOUR must be an integer from 0 to 23');
const isTailnetAddress = (hostname) => {
  if (hostname.endsWith('.ts.net') || hostname.startsWith('fd7a:115c:a1e0:')) return true;
  const octets = hostname.split('.').map(Number);
  return octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
};
if (!['localhost', '127.0.0.1', '::1'].includes(HOST) && !isTailnetAddress(HOST)) {
  throw new Error('HOST must be loopback or a Tailscale address; refusing a LAN/public bind');
}
const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(HERE, '..', 'dev', 'dist');
const activeProvider = CLIENT_ID && SECRET ? plaidProvider({
  clientId: CLIENT_ID, secret: SECRET, env: process.env.PLAID_ENV ?? 'sandbox', redirectUri: REDIRECT_URI,
}) : mock;
const connectionOptions = { liveProvider: activeProvider.name, liveEnvironment: activeProvider.env };
const configuredConnections = () => loadConnections(connectionOptions);
const changeConnections = (update) => updateConnections(update, connectionOptions);
const providerFor = (connection) => {
  if (connection.provider === mock.name) return mock;
  if (connection.provider === activeProvider.name && connection.environment === activeProvider.env) return activeProvider;
  if (connection.provider === activeProvider.name) {
    throw new BankingError(`Provider environment ${connection.environment} is not configured`, 409, 'PROVIDER_ENVIRONMENT_MISMATCH');
  }
  throw new BankingError(`Provider ${connection.provider} is not configured`, 409, 'PROVIDER_UNAVAILABLE');
};
const banking = createBankingService({
  activeProvider,
  providerFor,
  loadConnections: configuredConnections,
  updateConnections: changeConnections,
  getLedger,
  updateLedger,
});
const VERSION = JSON.parse(await readFile(join(HERE, '..', 'package.json'), 'utf8')).version;
const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', HOST]);
if (REDIRECT_URI) allowedHosts.add(new URL(REDIRECT_URI).hostname);
const allowedHost = (header = '') => {
  try {
    const hostname = new URL(`http://${header}`).hostname;
    return allowedHosts.has(hostname) || hostname.endsWith('.ts.net');
  } catch { return false; }
};
const allowedOrigin = (header = '') => {
  if (!header) return true;
  try { return allowedHost(new URL(header).host); } catch { return false; }
};

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 5e7) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});
const bad = (message) => [400, { error: { message } }];

async function route(method, path, body) {
  // ── Ledger document ──
  if (method === 'GET' && path === '/api/health') return [200, { ok: true, mode: activeProvider.name, host: HOST, version: VERSION }];
  if (method === 'GET' && path === '/api/ledger') return [200, await getLedger()];
  if (method === 'PUT' && path === '/api/ledger') {
    if (typeof body.version !== 'number' || body.ledger === undefined || body.ledger === null) return bad('body must be { version: number, ledger }');
    return [200, await putLedger(body.version, body.ledger)];
  }
  if (method === 'GET' && path === '/api/backups') return [200, await listBackups()];
  if (method === 'POST' && path === '/api/backups/restore') return [200, await restoreBackup(body.name)];

  // ── Bank ──
  if (method === 'GET' && path === '/api/bank/status') return [200, { mode: activeProvider.name, env: activeProvider.env, oauthRedirect: !!REDIRECT_URI, syncHour: SYNC_HOUR }];
  if (method === 'POST' && path === '/api/bank/link-token') {
    return [200, await banking.beginLink(body.connectionId)];
  }
  if (method === 'POST' && path === '/api/bank/exchange') {
    return [200, await banking.connect(body)];
  }
  if (method === 'GET' && path === '/api/bank/connections') return [200, await banking.list()];
  if (method === 'GET' && path === '/api/bank/composition') return [200, await banking.composition()];
  if (method === 'POST' && path === '/api/bank/sync-all') return [200, await banking.syncAll()];
  if (method === 'POST' && path === '/api/bank/use-live-data') return [200, await banking.useLiveDataOnly()];
  const connectionRoute = /^\/api\/bank\/connections\/([^/]+)(?:\/(sync|rebuild))?$/.exec(path);
  if (connectionRoute) {
    const connectionId = decodeURIComponent(connectionRoute[1]);
    const command = connectionRoute[2];
    if (method === 'DELETE' && !command) return [200, await banking.disconnect(connectionId)];
    if (method === 'POST' && command === 'sync') return [200, await banking.syncOne(connectionId)];
    if (method === 'POST' && command === 'rebuild') return [200, await banking.rebuildOne(connectionId)];
  }
  return [404, { error: { message: `No route for ${method} ${path}` } }];
}

const MIME = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
async function serveStatic(method, pathname, res) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  let relative;
  try { relative = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return false; }
  const safe = normalize(relative);
  if (safe.startsWith('..') || safe.includes('\0')) return false;
  let file = join(DIST_DIR, safe || 'index.html');
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    if (pathname.startsWith('/assets/')) return false;
    file = join(DIST_DIR, 'index.html');
  }
  const data = await readFile(file).catch(() => null);
  if (!data) return false;
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': data.byteLength,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  res.end(method === 'HEAD' ? undefined : data);
  return true;
}

const msUntilNextSync = (now = new Date()) => {
  const next = new Date(now);
  next.setHours(SYNC_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
};
async function runDailySyncIfDue() {
  const [{ ledger }, connections] = await Promise.all([getLedger(), configuredConnections()]);
  if (!ledger || !shouldRunDaily(connections, ledger, new Date(), SYNC_HOUR)) return [];
  const results = await banking.syncAll();
  const failed = results.filter((result) => !result.ok).length;
  console.log(`daily bank sync → ${results.length - failed} ok, ${failed} failed`);
  return results;
}
const needsSoonRetry = (results) => results.some((result) => !result.ok
  || (result.historyStatus && result.historyStatus !== 'HISTORICAL_UPDATE_COMPLETE'));
function scheduleDailySync(delay = msUntilNextSync()) {
  const timer = setTimeout(async () => {
    let results = [];
    try { results = await runDailySyncIfDue(); }
    catch (error) { console.error(`daily bank sync failed: ${error?.message ?? 'unknown error'}`); }
    scheduleDailySync(needsSoonRetry(results) ? 15 * 60 * 1000 : msUntilNextSync());
  }, delay);
  timer.unref();
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const started = Date.now();
  let status = 500;
  try {
    if (!allowedHost(req.headers.host)) {
      status = 421;
      json(res, status, { error: { message: 'Unrecognized host' } });
      return;
    }
    const unsafe = ['POST', 'PUT', 'DELETE'].includes(req.method ?? '');
    if (unsafe && (req.headers['sec-fetch-site'] === 'cross-site' || !allowedOrigin(req.headers.origin))) {
      status = 403;
      json(res, status, { error: { message: 'Cross-origin API writes are not allowed' } });
      return;
    }
    if (!url.pathname.startsWith('/api/')) {
      if (await serveStatic(req.method ?? 'GET', url.pathname, res)) { status = 200; return; }
      status = 404;
      json(res, status, { error: { message: 'Not found' } });
      return;
    }
    if (['POST', 'PUT'].includes(req.method ?? '') && !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      status = 415;
      json(res, status, { error: { message: 'API writes require application/json' } });
      return;
    }
    const body = req.method === 'POST' || req.method === 'PUT' ? await readJson(req) : {};
    const [s, out] = await route(req.method ?? 'GET', url.pathname, body);
    status = s;
    json(res, s, out);
  } catch (err) {
    if (err instanceof StoreError && err.status === 409) { status = 409; json(res, 409, { error: { message: err.message }, version: err.version, ledger: err.ledger }); }
    else {
      status = err instanceof StoreError || err instanceof ProviderError || Number.isInteger(err?.status) ? err.status : 500;
      json(res, status, { error: { code: err?.code, message: err?.message ?? 'Server error' } });
    }
  } finally {
    const logPath = url.pathname.replace(/^\/api\/bank\/connections\/[^/]+/, '/api/bank/connections/:id');
    console.log(`${req.method} ${logPath} → ${status} (${Date.now() - started}ms)`);
  }
}).listen(PORT, HOST, () => {
  console.log(`ledger server: ${activeProvider.name} mode (${activeProvider.env}) on http://${HOST}:${PORT}`);
  void runDailySyncIfDue()
    .then((results) => scheduleDailySync(needsSoonRetry(results) ? 15 * 60 * 1000 : msUntilNextSync()))
    .catch((error) => {
      console.error(`daily bank sync failed: ${error?.message ?? 'unknown error'}`);
      scheduleDailySync(15 * 60 * 1000);
    });
});
