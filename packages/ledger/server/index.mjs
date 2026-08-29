/**
 * Ledger bank server — the only place Plaid secrets and access tokens live.
 *
 * Zero dependencies. With PLAID_CLIENT_ID and PLAID_SECRET set it talks to
 * Plaid (PLAID_ENV: sandbox | development | production); without them it runs
 * in mock mode and serves a believable "Chase" so the whole flow works locally.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 5201);
const CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const SECRET = process.env.PLAID_SECRET ?? '';
const ENV = process.env.PLAID_ENV ?? 'sandbox';
const MODE = CLIENT_ID && SECRET ? 'plaid' : 'mock';
const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data', 'items.json');

// ── Persistence ───────────────────────────────────────────────────────
async function loadItems() {
  try { return JSON.parse(await readFile(DATA, 'utf8')); } catch { return []; }
}
async function saveItems(items) {
  await mkdir(dirname(DATA), { recursive: true });
  await writeFile(DATA, JSON.stringify(items, null, 2));
}
const publicItem = ({ access_token, ...item }) => item;

// ── Plaid ─────────────────────────────────────────────────────────────
class PlaidError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }
async function plaid(path, body) {
  const res = await fetch(`https://${ENV}.plaid.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, secret: SECRET, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new PlaidError(json.error_message ?? json.display_message ?? `Plaid ${path} failed (${res.status})`);
  return json;
}
const plaidAccount = (a) => ({
  id: a.account_id, name: a.name, mask: a.mask ?? '', type: a.type, subtype: a.subtype ?? null,
  balance: a.balances?.current ?? a.balances?.available ?? 0,
});

// ── Mock ──────────────────────────────────────────────────────────────
const MOCK_ACCOUNTS = [
  { name: 'Chase Total Checking', mask: '4821', type: 'depository', subtype: 'checking', balance: 5230.18 },
  { name: 'Chase Savings', mask: '9017', type: 'depository', subtype: 'savings', balance: 12840.55 },
  { name: 'Chase Sapphire Preferred', mask: '3305', type: 'credit', subtype: 'credit card', balance: 1466.02 },
];
const PAYEES = {
  checking: [['WHOLE FOODS MKT #10233', 20, 140], ['UBER *TRIP HELP.UBER.COM', 8, 40], ['TRADER JOE S #145', 15, 90], ['PG&E WEB ONLINE', 60, 220], ['ZELLE PAYMENT FROM ALEX M', -200, -40], ['DIRECT DEP ACME CORP PAYROLL', -3400, -3400], ['CHASE CREDIT CRD AUTOPAY', 400, 900], ['SHELL OIL 57444', 30, 75]],
  savings: [['INTEREST PAYMENT', -14, -9], ['ONLINE TRANSFER FROM CHK 4821', -1000, -500]],
  'credit card': [['AMAZON.COM*2K3L9', 12, 180], ['NETFLIX.COM', 15.99, 15.99], ['BLUE BOTTLE COFFEE', 5, 14], ['APPLE.COM/BILL', 2.99, 12.99], ['DELTA AIR 0062334', 180, 640], ['CHIPOTLE 2213', 11, 24], ['Payment Thank You - Web', -900, -400]],
};
function rng(seed) {
  let s = Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) || 1;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
const isoDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
function mockSync(item) {
  const day = isoDaysAgo(0);
  const added = [];
  for (const acct of item.accounts) {
    const rand = rng(`${item.id}|${acct.id}|${day}`);
    const pool = PAYEES[acct.subtype] ?? PAYEES.checking;
    const n = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const [name, lo, hi] = pool[Math.floor(rand() * pool.length)];
      const daysAgo = Math.floor(rand() * 14);
      const amount = Math.round((lo + rand() * (hi - lo)) * 100) / 100;
      const date = isoDaysAgo(daysAgo);
      // Stable id per (account, payee, date, slot): a re-sync on the same day repeats, later days add.
      const id = createHash('sha1').update(`${acct.id}|${name}|${date}|${i}`).digest('hex').slice(0, 24);
      added.push({ id, account_id: acct.id, date, name, amount, pending: daysAgo < 2 });
    }
  }
  return { added, modified: [], removed: [], accounts: item.accounts };
}

// ── HTTP ──────────────────────────────────────────────────────────────
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readJson = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
});

async function route(method, path, body) {
  if (method === 'GET' && path === '/api/bank/status') return [200, { mode: MODE, env: ENV }];

  if (method === 'POST' && path === '/api/bank/link-token') {
    if (MODE === 'mock') return [200, { mock: true }];
    const r = await plaid('/link/token/create', {
      client_name: 'Ledger', products: ['transactions'], country_codes: ['US'], language: 'en', user: { client_user_id: 'ledger' },
    });
    return [200, { link_token: r.link_token }];
  }

  if (method === 'POST' && path === '/api/bank/exchange') {
    const items = await loadItems();
    let item;
    if (body.mock || MODE === 'mock') {
      const id = randomUUID();
      item = {
        id, institution: body.institution || 'Chase', cursor: null, createdAt: new Date().toISOString(),
        accounts: MOCK_ACCOUNTS.map((a, i) => ({ id: `${id.slice(0, 8)}-acct-${i}`, ...a })),
      };
    } else {
      if (!body.public_token) return [400, { error: { message: 'public_token is required' } }];
      const ex = await plaid('/item/public_token/exchange', { public_token: body.public_token });
      const acc = await plaid('/accounts/get', { access_token: ex.access_token });
      item = {
        id: ex.item_id, access_token: ex.access_token, institution: body.institution || acc.item?.institution_name || 'Bank',
        cursor: null, createdAt: new Date().toISOString(), accounts: acc.accounts.map(plaidAccount),
      };
    }
    await saveItems([...items.filter((x) => x.id !== item.id), item]);
    return [200, publicItem(item)];
  }

  if (method === 'GET' && path === '/api/bank/items') return [200, (await loadItems()).map(publicItem)];

  if (method === 'POST' && path === '/api/bank/sync') {
    const items = await loadItems();
    const item = items.find((x) => x.id === body.itemId);
    if (!item) return [404, { error: { message: 'Unknown item' } }];
    if (!item.access_token) return [200, mockSync(item)];
    let cursor = item.cursor ?? undefined;
    const out = { added: [], modified: [], removed: [], accounts: item.accounts };
    for (let guard = 0; guard < 50; guard++) {
      const r = await plaid('/transactions/sync', { access_token: item.access_token, cursor, count: 500 });
      const tx = (t) => ({ id: t.transaction_id, account_id: t.account_id, date: t.date, name: t.merchant_name || t.name, amount: t.amount, pending: !!t.pending, category: t.personal_finance_category?.primary });
      out.added.push(...r.added.map(tx)); out.modified.push(...r.modified.map(tx)); out.removed.push(...r.removed);
      cursor = r.next_cursor;
      if (!r.has_more) break;
    }
    const acc = await plaid('/accounts/get', { access_token: item.access_token }).catch(() => null);
    if (acc) item.accounts = acc.accounts.map(plaidAccount);
    out.accounts = item.accounts;
    item.cursor = cursor ?? item.cursor;
    await saveItems(items);
    return [200, out];
  }

  const del = method === 'DELETE' && /^\/api\/bank\/items\/([^/]+)$/.exec(path);
  if (del) {
    const items = await loadItems();
    const item = items.find((x) => x.id === decodeURIComponent(del[1]));
    if (!item) return [404, { error: { message: 'Unknown item' } }];
    if (item.access_token) await plaid('/item/remove', { access_token: item.access_token }).catch(() => {});
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
    const body = req.method === 'POST' ? await readJson(req) : {};
    const [s, out] = await route(req.method ?? 'GET', url.pathname, body);
    status = s;
    json(res, s, out);
  } catch (err) {
    status = err instanceof PlaidError ? err.status : 500;
    json(res, status, { error: { message: err?.message ?? 'Server error' } });
  } finally {
    console.log(`${req.method} ${url.pathname} → ${status} (${Date.now() - started}ms)`);
  }
}).listen(PORT, () => console.log(`ledger bank server: ${MODE} mode (${ENV}) on http://localhost:${PORT}`));
