export type AccountKind = 'checking' | 'savings' | 'credit' | 'investment';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Opening balance, in cents. Current balance = opening + sum(transactions). */
  opening: number;
  institution: string;
  /** Present when a bank connection owns this account. */
  external?: { provider: 'plaid'; itemId: string; accountId: string };
}

export interface Category {
  id: string;
  name: string;
  /** Spending categories get budgets; income does not. */
  income?: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Cents; negative is money out. */
  amount: number;
  payee: string;
  note?: string;
  /** The bank's own id, when synced; dedupes and lets removals apply. */
  externalId?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  /** Monthly limit, cents. */
  limit: number;
}

/** Payee text containing `match` (case-insensitive) is filed under `categoryId`. */
export interface Rule {
  id: string;
  match: string;
  categoryId: string;
}

export type Appearance = 'system' | 'light' | 'dark';

export interface Settings {
  name: string;
  currency: string;
  locale: string;
  /** Which colour scheme the engine should use; `system` follows the device. */
  appearance?: Appearance;
}

export interface Ledger {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  rules: Rule[];
  settings: Settings;
  /** Last sync per bank connection (item id). */
  sync?: Record<string, { at: string; added: number }>;
}

export const UNCATEGORIZED = 'uncategorized';
