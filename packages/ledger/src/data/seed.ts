import type { Ledger, Transaction } from './model.js';

// Deterministic pseudo-random so the seed is the same every time.
let s = 42;
const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const payees: Record<string, string[]> = {
  groceries: ['Whole Foods', 'Trader Joe’s', 'Safeway', 'Farmers Market'],
  dining: ['Blue Bottle', 'Nopa', 'Sushi Ran', 'Tartine', 'Chipotle'],
  transport: ['Clipper', 'Uber', 'Shell', 'BART'],
  housing: ['Landlord'],
  utilities: ['PG&E', 'Comcast', 'Water District'],
  shopping: ['Amazon', 'Apple', 'REI', 'Uniqlo'],
  health: ['Kaiser', 'Walgreens', 'CVS'],
  fun: ['Netflix', 'Spotify', 'AMC', 'Steam'],
  travel: ['United', 'Airbnb', 'Hertz'],
  salary: ['Acme Corp Payroll'],
  interest: ['Marcus Interest'],
  transfer: ['Transfer'],
};

const monthly: Array<[cat: string, amount: number, day: number]> = [
  ['housing', -245000, 1],
  ['utilities', -18500, 5],
  ['utilities', -8900, 12],
  ['salary', 685000, 1],
  ['salary', 685000, 15],
  ['fun', -1599, 3],
  ['fun', -1099, 9],
];

export function seed(): Ledger {
  const transactions: Transaction[] = [];
  let id = 1;
  const today = new Date(2026, 7, 27);
  for (let m = 0; m < 8; m++) {
    const year = 2026;
    const month = m + 1;
    const days = new Date(year, month, 0).getDate();
    const date = (d: number) => `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const inFuture = (d: number) => new Date(year, month - 1, d) > today;
    for (const [cat, amount, day] of monthly) {
      if (inFuture(day)) continue;
      transactions.push({ id: `t${id++}`, accountId: cat === 'salary' ? 'checking' : 'checking', categoryId: cat, date: date(day), amount, payee: pick(payees[cat]!) });
    }
    const n = 28 + Math.floor(rand() * 14);
    for (let i = 0; i < n; i++) {
      const day = 1 + Math.floor(rand() * days);
      if (inFuture(day)) continue;
      const cat = pick(['groceries', 'groceries', 'groceries', 'dining', 'dining', 'transport', 'shopping', 'health', 'fun', 'travel'] as const);
      const base = { groceries: 6500, dining: 3200, transport: 1800, shopping: 7800, health: 4200, fun: 2400, travel: 32000 }[cat];
      const amount = -Math.round(base * (0.4 + rand() * 1.4));
      const accountId = cat === 'travel' || cat === 'shopping' ? 'credit' : rand() < 0.3 ? 'credit' : 'checking';
      transactions.push({ id: `t${id++}`, accountId, categoryId: cat, date: date(day), amount, payee: pick(payees[cat]!) });
    }
    if (!inFuture(20)) {
      transactions.push({ id: `t${id++}`, accountId: 'checking', categoryId: 'transfer', date: date(20), amount: -100000, payee: 'Transfer to savings' });
      transactions.push({ id: `t${id++}`, accountId: 'savings', categoryId: 'transfer', date: date(20), amount: 100000, payee: 'Transfer from checking' });
      if (!inFuture(days)) transactions.push({ id: `t${id++}`, accountId: 'savings', categoryId: 'interest', date: date(days), amount: 4100 + m * 120, payee: 'Marcus Interest' });
      transactions.push({ id: `t${id++}`, accountId: 'checking', categoryId: 'transfer', date: date(22), amount: -180000, payee: 'Credit card payment' });
      transactions.push({ id: `t${id++}`, accountId: 'credit', categoryId: 'transfer', date: date(22), amount: 180000, payee: 'Payment received' });
    }
  }
  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return {
    accounts: [
      { id: 'checking', name: 'Everyday Checking', kind: 'checking', opening: 412000, institution: 'Chase', currency: 'USD' },
      { id: 'savings', name: 'High-Yield Savings', kind: 'savings', opening: 1850000, institution: 'Marcus', currency: 'USD' },
      { id: 'credit', name: 'Sapphire Card', kind: 'credit', opening: -64000, institution: 'Chase', currency: 'USD' },
      { id: 'brokerage', name: 'Index Funds', kind: 'investment', opening: 4120000, institution: 'Vanguard', currency: 'USD' },
    ],
    categories: [
      { id: 'groceries', name: 'Groceries' }, { id: 'dining', name: 'Dining out' }, { id: 'transport', name: 'Transport' },
      { id: 'housing', name: 'Housing' }, { id: 'utilities', name: 'Utilities' }, { id: 'shopping', name: 'Shopping' },
      { id: 'health', name: 'Health' }, { id: 'fun', name: 'Entertainment' }, { id: 'travel', name: 'Travel' },
      { id: 'salary', name: 'Salary', income: true }, { id: 'interest', name: 'Interest', income: true }, { id: 'transfer', name: 'Transfer' },
      { id: 'uncategorized', name: 'Uncategorized' },
    ],
    rules: [
      { id: 'r1', match: 'whole foods', categoryId: 'groceries' }, { id: 'r2', match: 'trader joe', categoryId: 'groceries' },
      { id: 'r3', match: 'uber', categoryId: 'transport' }, { id: 'r4', match: 'netflix', categoryId: 'fun' },
      { id: 'r5', match: 'payroll', categoryId: 'salary' }, { id: 'r6', match: 'amazon', categoryId: 'shopping' },
    ],
    transactions,
    budgets: [
      { id: 'b1', categoryId: 'groceries', limit: 60000 }, { id: 'b2', categoryId: 'dining', limit: 30000 },
      { id: 'b3', categoryId: 'transport', limit: 15000 }, { id: 'b4', categoryId: 'shopping', limit: 25000 },
      { id: 'b5', categoryId: 'fun', limit: 8000 }, { id: 'b6', categoryId: 'travel', limit: 40000 },
    ],
    settings: { name: 'Goga', currency: 'USD', locale: 'en-US' },
  };
}
