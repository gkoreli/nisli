/**
 * The Ledger's screens, proven: every screen mounts at five widths with the
 * engine's estimating measurer and holds every claim — every fit plan
 * satisfied, no text overflowing, no figure truncated, every control named
 * and reachable, every field labelled, every dialog modal and labelled,
 * ids unique, no block failed, the screen settled. No browser, no eyes.
 *
 * The store boots from a mocked server (`fetch` is stubbed for `/api/*` with
 * the shapes `data/api.ts` and `data/bank.ts` read), with a ledger shaped
 * like a real one: three accounts, a bank connection, a month of
 * transactions, budgets and rules — so the tables, stats, bars and meters
 * carry real figures at every width.
 *
 * A claim a screen legitimately makes at a width is a finding, not a reason
 * to loosen the proof: it is recorded in KNOWN with its exact text, asserted
 * still present (so a fix is noticed), and everything else must hold.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from 'vitest';
import { settle, flushEffects } from '@nisli/core';
import { prove, mount, estimator, type Claim } from '@nisli/engine/test';
import type { Ledger, Transaction } from '../data/model.js';
import type { BankConnection, BankStatus, FinancialComposition } from '../data/bank.js';
import type { BackupInfo, LedgerResponse } from '../data/api.js';

// ── The server ─────────────────────────────────────────────────────────

const month = new Date().toISOString().slice(0, 7);
const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
const lastMonth = (() => { const [y, m] = month.split('-').map(Number); const d = new Date(y!, m! - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

const CONNECTION = 'conn-chase';

const transactions: Transaction[] = [
  { id: 't01', accountId: 'checking', categoryId: 'salary', date: day(1), amount: 685_000, payee: 'ACME Corp Payroll' },
  { id: 't02', accountId: 'checking', categoryId: 'housing', date: day(2), amount: -245_000, payee: 'Mission Street Apartments LLC' },
  { id: 't03', accountId: 'card', categoryId: 'groceries', date: day(3), amount: -12_345, payee: 'Whole Foods Market #10235', bank: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, transactionId: 'p1' } },
  { id: 't04', accountId: 'card', categoryId: 'dining', date: day(4), amount: -4_850, payee: 'Grandmother’s Lasagne al Forno', note: 'birthday dinner with the whole family', bank: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, transactionId: 'p2' } },
  { id: 't05', accountId: 'card', categoryId: 'transport', date: day(5), amount: -6_700, payee: 'Uber' },
  { id: 't06', accountId: 'checking', categoryId: 'utilities', date: day(6), amount: -18_900, payee: 'Pacific Gas & Electric Company' },
  { id: 't07', accountId: 'card', categoryId: 'shopping', date: day(8), amount: -1_234_567, payee: 'REI' },
  { id: 't08', accountId: 'card', categoryId: 'uncategorized', date: day(9), amount: -2_150, payee: 'SQ *BLUE BOTTLE COFFEE' },
  { id: 't09', accountId: 'savings', categoryId: 'interest', date: day(10), amount: 1_234, payee: 'Interest payment' },
  { id: 't10', accountId: 'checking', categoryId: 'transfer', date: day(11), amount: -100_000, payee: 'Transfer to savings' },
  { id: 't11', accountId: 'savings', categoryId: 'transfer', date: day(11), amount: 100_000, payee: 'Transfer from checking' },
  { id: 't12', accountId: 'card', categoryId: 'fun', date: day(12), amount: -1_599, payee: 'Netflix' },
  { id: 't13', accountId: 'card', categoryId: 'groceries', date: day(14), amount: -8_912, payee: 'Trader Joe’s' },
  { id: 't14', accountId: 'card', categoryId: 'health', date: day(15), amount: -25_000, payee: 'One Medical' },
  { id: 't15', accountId: 'card', categoryId: 'uncategorized', date: day(16), amount: -3_300, payee: 'AMZN Mktp US*2K4L9' },
  { id: 't16', accountId: 'checking', categoryId: 'salary', date: `${lastMonth}-01`, amount: 685_000, payee: 'ACME Corp Payroll' },
  { id: 't17', accountId: 'checking', categoryId: 'housing', date: `${lastMonth}-02`, amount: -245_000, payee: 'Mission Street Apartments LLC' },
  { id: 't18', accountId: 'card', categoryId: 'fun', date: `${lastMonth}-12`, amount: -1_599, payee: 'Netflix' },
  { id: 't19', accountId: 'card', categoryId: 'groceries', date: `${lastMonth}-20`, amount: -15_600, payee: 'Whole Foods Market #10235' },
];

const ledger = (): Ledger => ({
  accounts: [
    { id: 'checking', name: 'Everyday Checking', kind: 'checking', opening: 1_250_000, institution: 'Chase', currency: 'USD', external: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, accountId: 'acc-1', status: 'active' } },
    { id: 'savings', name: 'High-Yield Savings', kind: 'savings', opening: 4_200_000, institution: 'Marcus by Goldman Sachs', currency: 'USD' },
    { id: 'card', name: 'Sapphire Preferred', kind: 'credit', opening: -84_200, institution: 'Chase', currency: 'USD', external: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, accountId: 'acc-2', status: 'active' } },
  ],
  categories: [
    { id: 'groceries', name: 'Groceries' }, { id: 'dining', name: 'Dining out' }, { id: 'transport', name: 'Transport' },
    { id: 'housing', name: 'Housing' }, { id: 'utilities', name: 'Utilities' }, { id: 'shopping', name: 'Shopping' },
    { id: 'health', name: 'Health' }, { id: 'fun', name: 'Entertainment' }, { id: 'travel', name: 'Travel' },
    { id: 'salary', name: 'Salary', income: true }, { id: 'interest', name: 'Interest', income: true },
    { id: 'transfer', name: 'Transfer' }, { id: 'uncategorized', name: 'Uncategorized' },
  ],
  transactions,
  budgets: [
    { id: 'b1', categoryId: 'groceries', limit: 60_000 },
    { id: 'b2', categoryId: 'dining', limit: 20_000 },
    { id: 'b3', categoryId: 'shopping', limit: 30_000 },
    { id: 'b4', categoryId: 'fun', limit: 5_000 },
  ],
  rules: [
    { id: 'r1', match: 'whole foods', categoryId: 'groceries' },
    { id: 'r2', match: 'blue bottle', categoryId: 'dining' },
    { id: 'r3', match: 'amzn', categoryId: 'shopping' },
  ],
  settings: { name: 'Goga', currency: 'USD', locale: 'en-US', appearance: 'light' },
  sync: { [CONNECTION]: { at: new Date(Date.now() - 3_600_000).toISOString(), added: 12 } },
  bankHistory: [],
  pendingBankRebuild: [],
});

const connection: BankConnection = {
  id: CONNECTION, provider: 'plaid', environment: 'production', institution: 'Chase', status: 'ok',
  historyStatus: 'HISTORICAL_UPDATE_COMPLETE', createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  accounts: [
    { id: 'acc-1', name: 'Everyday Checking', mask: '4821', type: 'depository', subtype: 'checking', kind: 'checking', balanceMinor: 1_536_100, currency: 'USD' },
    { id: 'acc-2', name: 'Sapphire Preferred', mask: '9917', type: 'credit', subtype: 'credit card', kind: 'credit', balanceMinor: -1_384_853, currency: 'USD' },
  ],
};
const bankStatus: BankStatus = { mode: 'plaid', env: 'production', oauthRedirect: true, syncHour: 6 };
const composition: FinancialComposition = { accounts: { live: 2, legacy: 1, unowned: 0 }, transactions: { live: 2, legacy: 17, unowned: 0 }, history: 0, legacyConfiguration: 0 };
const backups: BackupInfo[] = [
  { name: 'ledger-2026-08-29T06-00-00.json', date: new Date(Date.now() - 86_400_000).toISOString(), bytes: 48_213 },
  { name: 'ledger-2026-08-28T06-00-00.json', date: new Date(Date.now() - 2 * 86_400_000).toISOString(), bytes: 47_990 },
];

let version = 7;
const routes: Record<string, (method: string, body: unknown) => { status: number; body: unknown }> = {
  '/api/health': () => ({ status: 200, body: { ok: true, mode: 'plaid', host: 'test', version: '0.2.0' } }),
  '/api/ledger': (method) => method === 'PUT'
    ? { status: 200, body: { version: ++version } }
    : { status: 200, body: { version, ledger: ledger() } satisfies LedgerResponse },
  '/api/backups': () => ({ status: 200, body: backups }),
  '/api/bank/status': () => ({ status: 200, body: bankStatus }),
  '/api/bank/connections': () => ({ status: 200, body: [connection] }),
  '/api/bank/composition': () => ({ status: 200, body: composition }),
};
const served: string[] = [];
vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
  const method = init?.method ?? 'GET';
  served.push(`${method} ${path}`);
  const route = routes[path];
  const r = route ? route(method, init?.body ? JSON.parse(init.body as string) : undefined) : { status: 404, body: { error: { message: `no mock for ${method} ${path}` } } };
  return { ok: r.status < 400, status: r.status, statusText: String(r.status), json: async () => r.body } as unknown as Response;
}));
localStorage.clear();

// The store boots on import: the mock must be standing first, so every screen is imported after it.
const store = await import('../data/store.js');
await store.ready;
const { OverviewScreen } = await import('./overview.js');
const { AccountsScreen } = await import('./accounts.js');
const { AccountScreen } = await import('./account.js');
const { TransactionsScreen } = await import('./transactions.js');
const { BudgetsScreen } = await import('./budgets.js');
const { ImportScreen } = await import('./import.js');
const { RulesScreen } = await import('./rules.js');
const { ConnectionsScreen } = await import('./connections.js');
const { SettingsScreen } = await import('./settings.js');

// ── The proof ──────────────────────────────────────────────────────────

const WIDTHS = [1280, 1024, 768, 480, 360] as const;

/**
 * Findings: claims a screen makes today, by exact text, at the widths it makes
 * them. Each is a todo for the screen or the engine, not for the proof; the
 * test asserts they are still made (so a fix retires its line) and that nothing
 * else is claimed.
 */
const KNOWN: Record<string, { code: Claim['code']; detail: string; widths: readonly number[] }[]> = {};

const screens: Record<string, () => ReturnType<typeof OverviewScreen>> = {
  OverviewScreen: () => OverviewScreen({}),
  AccountsScreen: () => AccountsScreen({}),
  'AccountScreen({ id: "card" })': () => AccountScreen({ id: 'card' }),
  TransactionsScreen: () => TransactionsScreen({}),
  BudgetsScreen: () => BudgetsScreen({}),
  ImportScreen: () => ImportScreen({}),
  RulesScreen: () => RulesScreen({}),
  ConnectionsScreen: () => ConnectionsScreen({}),
  SettingsScreen: () => SettingsScreen({}),
};

const key = (c: Claim) => `${c.code} ${c.detail}`;

describe('the store booted from the mocked server', () => {
  it('holds the fixture ledger', () => {
    expect(served[0]).toBe('GET /api/ledger');
    expect(store.syncState.value).toBe('saved');
    expect(store.accounts.value.map((a) => a.id)).toEqual(['checking', 'savings', 'card']);
    expect(store.transactions.value).toHaveLength(transactions.length);
  });
});

describe('the screens carry the fixture, so the proof is over real content', () => {
  it('the transactions table holds every row, with figures, at 360', () => {
    const t = mount(() => TransactionsScreen({}), {}, { width: 360, scheme: 'light', measure: estimator(360) });
    try {
      expect(t.frame.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(transactions.length);
      expect(t.frame.textContent).toContain('$12,345.67');
      expect(t.frame.textContent).toContain('Grandmother’s Lasagne al Forno');
    } finally { t.unmount(); }
  });
  it('the overview shows stats and bars, and the connections screen the bank once its queries settle', async () => {
    const o = mount(() => OverviewScreen({}), {}, { width: 1280, scheme: 'light', measure: estimator(1280) });
    try {
      expect(o.frame.querySelectorAll('nisli-stat').length).toBeGreaterThan(0);
      expect(o.frame.querySelectorAll('nisli-bars, nisli-meter').length).toBeGreaterThan(0);
    } finally { o.unmount(); }
    const c = mount(() => ConnectionsScreen({}), {}, { width: 1280, scheme: 'light', measure: estimator(1280) });
    try {
      await settle(); flushEffects();
      expect(c.frame.textContent).toContain('Chase');
      expect(c.frame.textContent).toContain('4821');
    } finally { c.unmount(); }
  });
});

describe('every screen is proven at 1280, 1024, 768, 480 and 360', () => {
  for (const [name, make] of Object.entries(screens)) {
    it(name, async () => {
      const proof = await prove(make, { widths: WIDTHS, scheme: 'light' });
      const known = KNOWN[name] ?? [];
      const expected = new Set(known.flatMap((k) => k.widths.map((w) => `${w} ${k.code} ${k.detail}`)));
      const found = new Set(proof.claims.map((c) => `${c.width} ${key(c)}`));
      // Everything not recorded as a finding must hold.
      expect([...found].filter((f) => !expected.has(f))).toEqual([]);
      // Every recorded finding is still made — a fixed one retires its line.
      expect([...expected].filter((e) => !found.has(e))).toEqual([]);
      expect(proof.byWidth.map((w) => w.width)).toEqual([...WIDTHS]);
      for (const w of proof.byWidth) expect(w.turns, `${name} at ${w.width} settled`).toBeLessThan(12);
    });
  }
});
