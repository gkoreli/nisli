/**
 * Finance domain layer (ADR 0039 §1, Ledger bounded context; tenets 0, 5, 6,
 * 11, 12, 13). Every function is total, synchronous and deterministic over
 * plain readonly data: no signal reads, no `new Date()`, no `Intl`, no store
 * import — `today`, the `Period` and the money formatter are injected at the
 * edge by the caller.
 */
import type { Account, Budget, Transaction } from '../model.js';

export interface FinanceInput {
  transactions: readonly Transaction[];
  accounts: readonly Account[];
  budgets: readonly Budget[];
  /** Currency reported when a transaction and its account are silent. From settings, passed in — the domain never reads settings. */
  defaultCurrency: string;
}

export * as money from './money.js';
export type { Cents, Amounts } from './money.js';
export * from './period.js';
export * from './flow.js';
export * from './commitment.js';
export * from './rollup.js';
export * from './delta.js';
export * from './safe-to-spend.js';
