/**
 * Ledger server — the system of record (TENETS §2) and the only place
 * provider secrets live (§4). Bun owns HTTP and static-file delivery.
 *
 * Env:
 *   PORT  (default 5201)
 *   HOST  (default 127.0.0.1). For Tailscale access run with HOST=<your
 *         tailscale IP> (e.g. 100.x.y.z) or keep localhost and use
 *         `tailscale serve`. Never bind 0.0.0.0 on a public network.
 *   PLAID_CLIENT_ID + PLAID_SECRET are required. PLAID_ENV is development
 *         or production; Sandbox is deliberately not a runtime mode.
 *   LEDGER_KEY  64 hex chars for token encryption; else server/data/.key.
 *
 * Logs: one line per request — method, path, status, ms. Never a token,
 * payee or amount (§8).
 */
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLedgerBunRuntime } from '../runtime.ts';
import {
  getLedger,
  publicLedgerDocument,
  putLedger,
  listBackups,
  restoreBackup,
  loadConnections,
  updateConnections,
  updateLedger,
  StoreError,
} from './store.ts';
import {
  plaidProvider,
  ProviderError,
  type PlaidEnvironment,
} from './providers/plaid.ts';
import {
  BankingError,
  createBankingService,
  shouldRunDaily,
  type BankingServiceDependencies,
  type LinkCompletion,
} from './bank-sync.ts';
import type { BankConnection, ConnectionView } from './banking/domain.ts';
import type { CategoryDecision, Ledger } from '../src/data/model.ts';

assertLedgerBunRuntime();

const PORT = Number(process.env.PORT ?? 5201);
const HOST = process.env.HOST ?? '127.0.0.1';
const CLIENT_ID = process.env.PLAID_CLIENT_ID ?? '';
const SECRET = process.env.PLAID_SECRET ?? '';
const configuredPlaidEnvironment = process.env.PLAID_ENV ?? '';
const REDIRECT_URI = process.env.PLAID_REDIRECT_URI ?? '';
const SYNC_HOUR = Number(process.env.LEDGER_SYNC_HOUR ?? 6);
const MAX_JSON_BYTES = 50_000_000;

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) throw new Error('PORT must be an integer from 1 to 65535');
if (!Number.isInteger(SYNC_HOUR) || SYNC_HOUR < 0 || SYNC_HOUR > 23) throw new Error('LEDGER_SYNC_HOUR must be an integer from 0 to 23');
if (!CLIENT_ID || !SECRET) throw new Error('PLAID_CLIENT_ID and PLAID_SECRET are required; Ledger has no runtime mock mode');
if (!['development', 'production'].includes(configuredPlaidEnvironment)) {
  throw new Error('PLAID_ENV must be development or production; Ledger does not run against invented Sandbox data');
}
const PLAID_ENV = configuredPlaidEnvironment as PlaidEnvironment;

const isTailnetAddress = (hostname: string): boolean => {
  if (hostname.endsWith('.ts.net') || hostname.startsWith('fd7a:115c:a1e0:')) return true;
  const octets = hostname.split('.').map(Number);
  return octets.length === 4
    && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    && octets[0] === 100
    && octets[1] !== undefined
    && octets[1] >= 64
    && octets[1] <= 127;
};
if (!['localhost', '127.0.0.1', '::1'].includes(HOST) && !isTailnetAddress(HOST)) {
  throw new Error('HOST must be loopback or a Tailscale address; refusing a LAN/public bind');
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(HERE, '..', 'dev', 'dist');
const activeProvider = plaidProvider({
  clientId: CLIENT_ID,
  secret: SECRET,
  env: PLAID_ENV,
  redirectUri: REDIRECT_URI,
});
const connectionOptions = { liveProvider: activeProvider.name, liveEnvironment: activeProvider.env };
const configuredConnections = () => loadConnections(connectionOptions);
const changeConnections: BankingServiceDependencies['updateConnections'] = (update) => updateConnections(update, connectionOptions);
const providerFor = (connection: BankConnection) => {
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
const VERSION = (JSON.parse(await readFile(join(HERE, '..', 'package.json'), 'utf8')) as { version: string }).version;
const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', HOST]);
if (REDIRECT_URI) allowedHosts.add(new URL(REDIRECT_URI).hostname);

const allowedHost = (header = ''): boolean => {
  try {
    const hostname = new URL(`http://${header}`).hostname;
    return allowedHosts.has(hostname) || hostname.endsWith('.ts.net');
  } catch {
    return false;
  }
};
const allowedOrigin = (header = ''): boolean => {
  if (!header) return true;
  try {
    return allowedHost(new URL(header).host);
  } catch {
    return false;
  }
};

type JsonObject = Record<string, unknown>;
type RouteResult = readonly [status: number, body: unknown];

/** Allowlist the transport contract so provider evidence can never leak by spread. */
const publicConnectionView = (connection: ConnectionView) => ({
  id: connection.id,
  provider: connection.provider,
  environment: connection.environment,
  institution: connection.institution,
  status: connection.status,
  accounts: connection.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    mask: account.mask,
    kind: account.kind,
    type: account.type,
    subtype: account.subtype,
    balanceMinor: account.balanceMinor,
    currency: account.currency,
  })),
  ...(connection.createdAt ? { createdAt: connection.createdAt } : {}),
  ...(connection.historyStatus ? { historyStatus: connection.historyStatus } : {}),
  ...(connection.error ? { error: { code: connection.error.code, message: connection.error.message } } : {}),
});

const isRecord = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isInteger = (value: unknown): value is number => Number.isSafeInteger(value);
const isOptional = <T>(value: unknown, validate: (candidate: unknown) => candidate is T): value is T | undefined =>
  value === undefined || validate(value);
const isCanonicalInstant = (value: unknown): value is string => {
  if (!isString(value)) return false;
  const instant = Date.parse(value);
  return Number.isFinite(instant) && new Date(instant).toISOString() === value;
};
const hasOnly = (value: JsonObject, keys: readonly string[]): boolean => Object.keys(value).every((key) => keys.includes(key));
const isCategoryDecision = (value: unknown): value is CategoryDecision => {
  if (!isRecord(value) || !isString(value.source)) return false;
  if (value.source === 'owner') return hasOnly(value, ['source']);
  if (value.source === 'rule') return hasOnly(value, ['source', 'ruleId']) && isString(value.ruleId);
  if (value.source === 'provider') return hasOnly(value, [
    'source', 'provider', 'taxonomy', 'taxonomyVersion', 'mappingVersion',
    'primary', 'detailed', 'confidence',
  ])
    && isString(value.provider)
    && isString(value.taxonomy)
    && isString(value.taxonomyVersion)
    && isString(value.mappingVersion)
    && isString(value.primary)
    && isString(value.detailed)
    && (value.confidence === null || isString(value.confidence));
  return value.source === 'unassigned'
    && hasOnly(value, ['source', 'reason'])
    && ['no-rule-or-provider-category', 'unmapped-provider-category'].includes(String(value.reason));
};
const isLedger = (value: unknown): value is Ledger => {
  if (!isRecord(value) || !Array.isArray(value.accounts) || !Array.isArray(value.categories)
    || !Array.isArray(value.transactions) || !Array.isArray(value.budgets) || !Array.isArray(value.rules)
    || !isRecord(value.settings) || Object.hasOwn(value, 'bankFacts')) return false;
  const accountKinds = new Set(['checking', 'savings', 'credit', 'investment', 'loan']);
  return value.accounts.every((account) => isRecord(account)
      && isString(account.id) && isString(account.name) && isString(account.kind) && accountKinds.has(account.kind)
      && isInteger(account.opening) && isString(account.institution) && isString(account.currency))
    && value.categories.every((category) => isRecord(category) && isString(category.id) && isString(category.name))
    && value.transactions.every((transaction) => isRecord(transaction)
      && isString(transaction.id) && isString(transaction.accountId) && isString(transaction.categoryId)
      && isString(transaction.date) && isOptional(transaction.authorizedDate, isString)
      && isInteger(transaction.amount) && isOptional(transaction.currency, isString)
      && isString(transaction.payee) && isOptional(transaction.pending, isBoolean)
      && isOptional(transaction.classification, isCategoryDecision)
      && isOptional(transaction.reviewedAt, isCanonicalInstant))
    && value.budgets.every((budget) => isRecord(budget)
      && isString(budget.id) && isString(budget.categoryId) && isInteger(budget.limit))
    && value.rules.every((rule) => isRecord(rule)
      && isString(rule.id) && isString(rule.match) && isString(rule.categoryId))
    && isString(value.settings.name) && isString(value.settings.currency) && isString(value.settings.locale);
};

class HttpError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

const json = (status: number, body: unknown): Response => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const bad = (message: string): RouteResult => [400, { error: { message } }];

async function readJson(request: Request): Promise<JsonObject> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new HttpError('Request body is too large', 413, 'BODY_TOO_LARGE');
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > MAX_JSON_BYTES) throw new HttpError('Request body is too large', 413, 'BODY_TOO_LARGE');
  if (buffer.byteLength === 0) return {};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(buffer));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value as JsonObject;
  } catch {
    throw new HttpError('Request body must be a JSON object', 400, 'INVALID_JSON');
  }
}

async function route(method: string, path: string, body: JsonObject): Promise<RouteResult> {
  if (method === 'GET' && path === '/api/health') return [200, { ok: true, mode: activeProvider.name, host: HOST, version: VERSION }];
  if (method === 'GET' && path === '/api/ledger') return [200, publicLedgerDocument(await getLedger())];
  if (method === 'PUT' && path === '/api/ledger') {
    if (typeof body.version !== 'number' || !isLedger(body.ledger)) return bad('body must be { version: number, ledger: Ledger }');
    return [200, await putLedger(body.version, body.ledger)];
  }
  if (method === 'GET' && path === '/api/backups') return [200, await listBackups()];
  if (method === 'POST' && path === '/api/backups/restore') {
    if (typeof body.name !== 'string') return bad('body must be { name: string }');
    return [200, await restoreBackup(body.name)];
  }

  if (method === 'GET' && path === '/api/bank/status') {
    return [200, { mode: activeProvider.name, env: activeProvider.env, oauthRedirect: !!REDIRECT_URI, syncHour: SYNC_HOUR }];
  }
  if (method === 'POST' && path === '/api/bank/link-token') {
    return [200, await banking.beginLink(typeof body.connectionId === 'string' ? body.connectionId : undefined)];
  }
  if (method === 'POST' && path === '/api/bank/exchange') return [200, publicConnectionView(await banking.connect(body as LinkCompletion))];
  if (method === 'GET' && path === '/api/bank/connections') return [200, (await banking.list()).map(publicConnectionView)];
  if (method === 'GET' && path === '/api/bank/composition') return [200, await banking.composition()];
  if (method === 'POST' && path === '/api/bank/sync-all') return [200, await banking.syncAll()];
  if (method === 'POST' && path === '/api/bank/use-live-data') return [200, await banking.useLiveDataOnly()];
  const connectionRoute = /^\/api\/bank\/connections\/([^/]+)(?:\/(sync|rebuild))?$/.exec(path);
  if (connectionRoute?.[1]) {
    const connectionId = decodeURIComponent(connectionRoute[1]);
    const command = connectionRoute[2];
    if (method === 'DELETE' && !command) return [200, await banking.disconnect(connectionId)];
    if (method === 'POST' && command === 'sync') return [200, await banking.syncOne(connectionId)];
    if (method === 'POST' && command === 'rebuild') return [200, await banking.rebuildOne(connectionId)];
  }
  return [404, { error: { message: `No route for ${method} ${path}` } }];
}

const MIME: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function staticResponse(method: string, pathname: string): Promise<Response | null> {
  if (method !== 'GET' && method !== 'HEAD') return null;
  let relative: string;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  const safe = normalize(relative);
  if (safe.startsWith('..') || safe.includes('\0')) return null;
  let filePath = join(DIST_DIR, safe || 'index.html');
  let file = Bun.file(filePath);
  if (!(await file.exists())) {
    if (pathname.startsWith('/assets/')) return null;
    filePath = join(DIST_DIR, 'index.html');
    file = Bun.file(filePath);
    if (!(await file.exists())) return null;
  }
  const headers = new Headers({
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Content-Length': String(file.size),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  return new Response(method === 'HEAD' ? null : file, { status: 200, headers });
}

const msUntilNextSync = (now = new Date()): number => {
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
type DailySyncResults = Awaited<ReturnType<typeof runDailySyncIfDue>>;
const needsSoonRetry = (results: DailySyncResults): boolean => results.some((result) => !result.ok
  || ('historyStatus' in result && result.historyStatus !== 'HISTORICAL_UPDATE_COMPLETE'));

function scheduleDailySync(delay = msUntilNextSync()): void {
  const timer = setTimeout(async () => {
    try {
      const results = await runDailySyncIfDue();
      scheduleDailySync(needsSoonRetry(results) ? 15 * 60 * 1000 : msUntilNextSync());
    } catch (error: unknown) {
      console.error(`daily bank sync failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      scheduleDailySync(15 * 60 * 1000);
    }
  }, delay);
  timer.unref();
}

const errorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Server error';
const errorStatus = (error: unknown): number => {
  if (error instanceof StoreError || error instanceof ProviderError || error instanceof BankingError || error instanceof HttpError) return error.status;
  return 500;
};

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  maxRequestBodySize: MAX_JSON_BYTES,
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    const started = performance.now();
    let status = 500;
    try {
      if (!allowedHost(request.headers.get('host') ?? '')) {
        status = 421;
        return json(status, { error: { message: 'Unrecognized host' } });
      }
      const unsafe = ['POST', 'PUT', 'DELETE'].includes(method);
      if (unsafe && (request.headers.get('sec-fetch-site') === 'cross-site' || !allowedOrigin(request.headers.get('origin') ?? ''))) {
        status = 403;
        return json(status, { error: { message: 'Cross-origin API writes are not allowed' } });
      }
      if (!url.pathname.startsWith('/api/')) {
        const response = await staticResponse(method, url.pathname);
        if (response) {
          status = response.status;
          return response;
        }
        status = 404;
        return json(status, { error: { message: 'Not found' } });
      }
      if (['POST', 'PUT'].includes(method) && !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
        status = 415;
        return json(status, { error: { message: 'API writes require application/json' } });
      }
      const body = method === 'POST' || method === 'PUT' ? await readJson(request) : {};
      const [routeStatus, output] = await route(method, url.pathname, body);
      status = routeStatus;
      return json(status, output);
    } catch (error: unknown) {
      if (error instanceof StoreError && error.status === 409) {
        status = 409;
        return json(status, { error: { message: error.message }, version: error.version, ledger: error.ledger });
      }
      status = errorStatus(error);
      return json(status, { error: { code: errorCode(error), message: errorMessage(error) } });
    } finally {
      const logPath = url.pathname.replace(/^\/api\/bank\/connections\/[^/]+/, '/api/bank/connections/:id');
      console.log(`${method} ${logPath} → ${status} (${Math.round(performance.now() - started)}ms)`);
    }
  },
});

console.log(`ledger server: ${activeProvider.name} mode (${activeProvider.env}) on ${server.url}`);
void runDailySyncIfDue()
  .then((results) => scheduleDailySync(needsSoonRetry(results) ? 15 * 60 * 1000 : msUntilNextSync()))
  .catch((error: unknown) => {
    console.error(`daily bank sync failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    scheduleDailySync(15 * 60 * 1000);
  });
