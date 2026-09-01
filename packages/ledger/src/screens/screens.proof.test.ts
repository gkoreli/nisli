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
import { addDays } from '../data/finance/index.js';
import { localDate, localMonth } from '../data/calendar.js';
import type { Ledger, Transaction } from '../data/model.js';
import type { BankConnection, BankStatus, FinancialComposition } from '../data/bank.js';
import type { BackupInfo, LedgerResponse } from '../data/api.js';

// ── The server ─────────────────────────────────────────────────────────

const month = localMonth();
const day = (d: number) => `${month}-${String(d).padStart(2, '0')}`;
const lastMonth = (() => { const [y, m] = month.split('-').map(Number); const d = new Date(y!, m! - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

const CONNECTION = 'conn-chase';

const transactions: Transaction[] = [
  { id: 't01', accountId: 'checking', categoryId: 'salary', date: day(1), amount: 685_000, payee: 'ACME Corp Payroll' },
  { id: 't02', accountId: 'checking', categoryId: 'housing', date: day(2), amount: -245_000, payee: 'Mission Street Apartments LLC' },
  {
    id: 't03', accountId: 'card', categoryId: 'groceries', date: day(3), amount: -12_345, payee: 'Whole Foods Market #10235',
    classification: {
      source: 'provider', provider: 'plaid', taxonomy: 'personal_finance_category', taxonomyVersion: 'v2', mappingVersion: 'plaid-pfc-v2-ledger-v2',
      primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES', confidence: 'LOW',
    },
    bank: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, transactionId: 'p1' },
  },
  {
    id: 't04', accountId: 'card', categoryId: 'dining', date: day(4), amount: -4_850, payee: 'Grandmother’s Lasagne al Forno', note: 'birthday dinner with the whole family',
    classification: {
      source: 'provider', provider: 'plaid', taxonomy: 'personal_finance_category', taxonomyVersion: 'v2', mappingVersion: 'plaid-pfc-v2-ledger-v2',
      primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANTS', confidence: 'LOW',
    },
    reviewedAt: '2026-08-30T12:00:00.000Z',
    bank: { provider: 'plaid', environment: 'production', connectionId: CONNECTION, transactionId: 'p2' },
  },
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

/** The same ledger with its lists reversed: same intent, the data perturbed (ADR 0044). */
const perturbedLedger = (): Ledger => {
  const l = ledger();
  l.transactions = [...l.transactions].reverse();
  l.budgets = [...l.budgets].reverse();
  return l;
};

type Screen = { make: () => ReturnType<typeof OverviewScreen>; variants?: (() => ReturnType<typeof OverviewScreen>)[] };
const screens: Record<string, Screen> = {
  OverviewScreen: {
    make: () => OverviewScreen({}),
    // DECISION_UNSTABLE: the store's transactions shuffled must stamp identical plans.
    variants: [() => { store.applyRestored(perturbedLedger(), 900); return OverviewScreen({}); }],
  },
  AccountsScreen: { make: () => AccountsScreen({}) },
  'AccountScreen({ id: "card" })': { make: () => AccountScreen({ id: 'card' }) },
  TransactionsScreen: { make: () => TransactionsScreen({}) },
  BudgetsScreen: { make: () => BudgetsScreen({}) },
  ImportScreen: { make: () => ImportScreen({}) },
  RulesScreen: { make: () => RulesScreen({}) },
  ConnectionsScreen: { make: () => ConnectionsScreen({}) },
  SettingsScreen: { make: () => SettingsScreen({}) },
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
  it('the category review filter exposes the reason and ranks spending impact at 360', () => {
    const t = mount(() => TransactionsScreen({}), {}, { width: 360, scheme: 'light', measure: estimator(360) });
    try {
      const review = [...t.frame.querySelectorAll('button')].find((button) => button.textContent?.includes('Review categories'));
      expect(review).toBeDefined();
      review!.click();
      flushEffects();
      const rows = [...t.frame.querySelectorAll<HTMLTableRowElement>('tbody tr')];
      expect(t.frame.textContent).toContain('3 need category review');
      expect(t.frame.textContent).toContain('Low category confidence');
      expect(rows[0]?.textContent).toContain('Whole Foods Market');
      expect(t.frame.textContent).not.toContain('Grandmother’s Lasagne al Forno');
      rows[0]!.click();
      flushEffects();
      expect(t.frame.textContent).toContain('Category review needed: Low category confidence');
      expect([...t.frame.querySelectorAll('button')].some((button) => button.textContent?.includes('Confirm category'))).toBe(true);
    } finally { t.unmount(); }
  });
  it('a reviewed category can be returned to the queue', () => {
    const t = mount(() => TransactionsScreen({}), {}, { width: 360, scheme: 'light', measure: estimator(360) });
    try {
      const reviewed = [...t.frame.querySelectorAll<HTMLTableRowElement>('tbody tr')]
        .find((row) => row.textContent?.includes('Grandmother’s Lasagne al Forno'));
      expect(reviewed).toBeDefined();
      reviewed!.click();
      flushEffects();
      expect(t.frame.textContent).toContain('This category was reviewed');
      expect([...t.frame.querySelectorAll('button')].some((button) => button.textContent?.includes('Review again'))).toBe(true);
    } finally { t.unmount(); }
  });
  it('the overview answers the five questions with its arithmetic shown, and the connections screen the bank once its queries settle', async () => {
    const o = mount(() => OverviewScreen({}), {}, { width: 1280, scheme: 'light', measure: estimator(1280) });
    try {
      const text = o.frame.textContent ?? '';
      // Five decision-bearing stats, Safe to spend first, arithmetic in the hint.
      expect(o.frame.querySelectorAll('nisli-stat').length).toBe(5);
      expect(text).toMatch(/cash on hand − .+ bills due by \d{4}-\d{2}-\d{2} − .+ open in budgets = /);
      // The cash basis and the credit-card exclusion are ambient lines, not a tap away.
      expect(text).toContain('Cash on hand is the posted balance of 1 checking account');
      expect(text).toContain('Credit-card payments are filed as transfers and are not counted in bills.');
      // Money in / Money out / Net over the whole period, pending disclosed; stat = sum of its rollup rows.
      expect(text).toContain('$6,862.34');
      expect(text).toContain('$15,633.23');
      expect(text).toContain('-$8,770.89');
      expect(text).toContain('$6,862.34 in − $15,633.23 out');
      expect(text).toContain('nothing pending');
      // Honest delta: percent against the previous same-elapsed window, named.
      expect(text).toMatch(/% vs |no .+ data to compare/);
      // Runway names its basis; this fixture has no three complete months of outflow.
      expect(text).toContain('runway is not measurable');
      // Coming up renders at every data shape: Empty is declared intent, the lines still say their zeros.
      expect(text).toContain('No bills expected in the next 30 days');
      expect(text).toContain('Committed in the next 30 days: $0.00 across 0 bills.');
      expect(text).toContain('No recurring income detected yet.');
      // Income categories have a chart-of-account presence; spending rows are exact.
      expect(text).toContain('Salary');
      expect(text).toContain('$6,850.00');
      expect(text).toContain('Groceries');
      expect(text).toContain('$212.57');
      // The transfer tripwire and the review line are ambient, with their trace.
      expect(text).toContain('Transfers moved $1,000.00 between accounts and net to zero in each currency.');
      expect(text).toContain('3 transactions need a category — these totals may shift.');
      expect(text).toContain('Review categories →');
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
  for (const [name, { make, variants }] of Object.entries(screens)) {
    it(name, async () => {
      const proof = await prove(make, { widths: WIDTHS, scheme: 'light', variants });
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

describe('coming up, over a ledger where series are detected', () => {
  it('lists upcoming and overdue occurrences, the committed line, and the next income', () => {
    const T = localDate();
    const at = (n: number) => addDays(T, n);
    const l = ledger();
    l.accounts.push({ id: 'gel', name: 'GEL Checking', kind: 'checking', opening: 100_000, institution: 'Local Bank', currency: 'GEL' });
    l.transactions = [
      ...l.transactions,
      // A monthly subscription whose next occurrence is ahead (T+25).
      { id: 's1', accountId: 'card', categoryId: 'fun', date: at(-65), amount: -999, payee: 'Spotify' },
      { id: 's2', accountId: 'card', categoryId: 'fun', date: at(-35), amount: -999, payee: 'Spotify' },
      { id: 's3', accountId: 'card', categoryId: 'fun', date: at(-5), amount: -999, payee: 'Spotify' },
      // A monthly bill already overdue (expected T−5), projected forward to T+25 too.
      { id: 'g1', accountId: 'checking', categoryId: 'health', date: at(-95), amount: -4_500, payee: 'Gym Membership' },
      { id: 'g2', accountId: 'checking', categoryId: 'health', date: at(-65), amount: -4_500, payee: 'Gym Membership' },
      { id: 'g3', accountId: 'checking', categoryId: 'health', date: at(-35), amount: -4_500, payee: 'Gym Membership' },
      // Recurring income, next expected around T+30.
      { id: 'i1', accountId: 'checking', categoryId: 'salary', date: at(-62), amount: 200_000, payee: 'Consulting Retainer' },
      { id: 'i2', accountId: 'checking', categoryId: 'salary', date: at(-31), amount: 200_000, payee: 'Consulting Retainer' },
      { id: 'i3', accountId: 'checking', categoryId: 'salary', date: at(-1), amount: 200_000, payee: 'Consulting Retainer' },
      // A bill in another currency stays separate; it is never formatted or added as USD.
      { id: 'fx1', accountId: 'gel', categoryId: 'utilities', date: at(-65), amount: -3_000, payee: 'Local Utility' },
      { id: 'fx2', accountId: 'gel', categoryId: 'utilities', date: at(-35), amount: -3_000, payee: 'Local Utility' },
      { id: 'fx3', accountId: 'gel', categoryId: 'utilities', date: at(-5), amount: -3_000, payee: 'Local Utility' },
    ];
    store.applyRestored(l, 910);
    const o = mount(() => OverviewScreen({}), {}, { width: 1280, scheme: 'light', measure: estimator(1280) });
    try {
      const text = o.frame.textContent ?? '';
      // The committed line keeps USD and GEL apart: Spotify + Gym in USD, Local Utility in GEL.
      expect(text).toContain('$54.99');
      expect(text).toContain('GEL');
      expect(text).toContain('across 3 bills.');
      expect(text).not.toContain('$84.99');
      expect(text).toContain('Next expected income: Consulting Retainer ~$2,000.00 around');
      const rows = [...o.frame.querySelectorAll<HTMLTableRowElement>('tbody tr')];
      const gym = rows.filter((r) => r.textContent?.includes('Gym Membership'));
      expect(gym.length).toBe(2); // the overdue occurrence and the projected one
      // Overdue is visible: exactly one Gym row's Due cell carries the warning-toned Text.
      expect(gym.filter((r) => r.querySelector('nisli-text') !== null).length).toBe(1);
      const spotify = rows.filter((r) => r.textContent?.includes('Spotify'));
      expect(spotify.length).toBe(1);
      expect(spotify[0]!.querySelector('nisli-text')).toBeNull();
    } finally {
      o.unmount();
      store.applyRestored(ledger(), 911);
    }
  });
});
