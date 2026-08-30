import { describe, expect, it } from 'vitest';
import type { Transaction } from './model.js';
import { needsSpendingReview, sameReviewBasis, spendingReviewCause, spendingReviewQueue } from './review.js';

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'transaction', accountId: 'checking', categoryId: 'dining', date: '2026-08-20',
  amount: -1_000, payee: 'Synthetic merchant', pending: false,
  classification: {
    source: 'provider', provider: 'plaid', taxonomy: 'personal_finance_category', taxonomyVersion: 'v2',
    mappingVersion: 'plaid-pfc-v2-ledger-v2', primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_RESTAURANTS',
    confidence: 'LOW',
  },
  bank: { provider: 'plaid', environment: 'sandbox', connectionId: 'connection', transactionId: 'provider-transaction' },
  ...overrides,
});

describe('spending review policy', () => {
  it('flags only posted expenses whose category is unassigned or below high provider confidence', () => {
    expect(spendingReviewCause(transaction())?.label).toBe('Low category confidence');
    expect(spendingReviewCause(transaction({ classification: { source: 'unassigned', reason: 'unmapped-provider-category' } }))?.code).toBe('uncategorized');
    expect(spendingReviewCause(transaction({ classification: undefined }))?.label).toBe('Unknown category confidence');
    expect(needsSpendingReview(transaction({ classification: { ...transaction().classification!, confidence: 'HIGH' } as Transaction['classification'] }))).toBe(false);
    expect(needsSpendingReview(transaction({ pending: true }))).toBe(false);
    expect(needsSpendingReview(transaction({ amount: 1_000 }))).toBe(false);
    expect(needsSpendingReview(transaction({ categoryId: 'transfer' }))).toBe(false);
    expect(needsSpendingReview(transaction({ reviewedAt: '2026-08-30T12:00:00.000Z' }))).toBe(false);
  });

  it('limits the queue to the reporting month and ranks the largest impact first', () => {
    const queue = spendingReviewQueue([
      transaction({ id: 'small', amount: -500 }),
      transaction({ id: 'large', amount: -5_000, date: '2026-08-01' }),
      transaction({ id: 'prior', amount: -9_000, date: '2026-07-31' }),
    ], '2026-08');
    expect(queue.map(({ id }) => id)).toEqual(['large', 'small']);
  });

  it('defines review identity from provider facts and classification, not owner metadata', () => {
    const base = transaction({ note: 'First', reviewedAt: '2026-08-30T12:00:00.000Z' });
    expect(sameReviewBasis(base, { ...base, note: 'Changed', reviewedAt: undefined })).toBe(true);
    expect(sameReviewBasis(base, { ...base, amount: -1_001 })).toBe(false);
    expect(sameReviewBasis(base, {
      ...base,
      classification: { ...base.classification!, confidence: 'MEDIUM' } as Transaction['classification'],
    })).toBe(false);
  });
});
