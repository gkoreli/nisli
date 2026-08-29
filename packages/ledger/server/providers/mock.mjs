/** Mock provider: a believable "Chase" with deterministic daily transactions, no credentials. */
import { randomUUID, createHash } from 'node:crypto';

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

export function mockItem(institution) {
  const id = randomUUID();
  return {
    id, institution: institution || 'Chase', cursor: null, createdAt: new Date().toISOString(),
    accounts: MOCK_ACCOUNTS.map((a, i) => ({ id: `${id.slice(0, 8)}-acct-${i}`, ...a })),
  };
}

export function mockSync(item) {
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
  return { added, modified: [], removed: [], accounts: item.accounts, cursor: item.cursor ?? null };
}

/** @type {import('./plaid.mjs').Provider} */
export const mock = {
  name: 'mock',
  env: 'mock',
  linkToken: async () => ({ mock: true }),
  exchange: async (body) => mockItem(body.institution),
  accounts: async (item) => item.accounts,
  sync: async (item) => mockSync(item),
  remove: async () => {},
};
