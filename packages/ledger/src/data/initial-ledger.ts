import type { Ledger } from './model.js';

/**
 * The first real ledger document. It contains only reference categories and
 * owner preferences—never invented accounts, balances, transactions, rules,
 * or budgets.
 */
export function initialLedger(): Ledger {
  return {
    accounts: [],
    categories: [
      { id: 'groceries', name: 'Groceries' },
      { id: 'dining', name: 'Dining out' },
      { id: 'transport', name: 'Transport' },
      { id: 'housing', name: 'Housing' },
      { id: 'utilities', name: 'Utilities' },
      { id: 'shopping', name: 'Shopping' },
      { id: 'health', name: 'Health' },
      { id: 'fun', name: 'Entertainment' },
      { id: 'travel', name: 'Travel' },
      { id: 'salary', name: 'Salary', income: true },
      { id: 'interest', name: 'Interest', income: true },
      { id: 'transfer', name: 'Transfer' },
      { id: 'uncategorized', name: 'Uncategorized' },
    ],
    transactions: [],
    budgets: [],
    rules: [],
    settings: { name: 'Goga', currency: 'USD', locale: 'en-US' },
    sync: {},
    bankHistory: [],
    pendingBankRebuild: [],
  };
}
