import { UNCATEGORIZED, type Transaction } from './model.js';

export type SpendingReviewCause =
  | { code: 'uncategorized'; label: 'Uncategorized' }
  | { code: 'provider-confidence'; label: string };

const highConfidence = new Set(['HIGH', 'VERY_HIGH']);

/** Why a posted expense needs owner attention, independent of prior review. */
export function spendingReviewCause(transaction: Transaction): SpendingReviewCause | undefined {
  if (transaction.pending || transaction.amount >= 0 || transaction.categoryId === 'transfer') return undefined;
  if (transaction.categoryId === UNCATEGORIZED || transaction.classification?.source === 'unassigned') {
    return { code: 'uncategorized', label: 'Uncategorized' };
  }
  if (transaction.bank && !transaction.classification) {
    return { code: 'provider-confidence', label: 'Unknown category confidence' };
  }
  if (transaction.classification?.source !== 'provider') return undefined;
  const confidence = transaction.classification.confidence?.toUpperCase() ?? 'UNKNOWN';
  if (highConfidence.has(confidence)) return undefined;
  const label = confidence === 'MEDIUM'
    ? 'Medium category confidence'
    : confidence === 'LOW'
      ? 'Low category confidence'
      : 'Unknown category confidence';
  return { code: 'provider-confidence', label };
}

export const needsSpendingReview = (transaction: Transaction): boolean =>
  !transaction.reviewedAt && !!spendingReviewCause(transaction);

/** Posted expenses needing review in a reporting month, largest impact first. */
export function spendingReviewQueue(transactions: readonly Transaction[], period: string): Transaction[] {
  return transactions
    .filter((transaction) => transaction.date.slice(0, 7) === period && needsSpendingReview(transaction))
    .toSorted((left, right) => Math.abs(right.amount) - Math.abs(left.amount)
      || (left.date < right.date ? 1 : left.date > right.date ? -1 : left.id.localeCompare(right.id)));
}

/** Facts and effective classification an owner saw when reviewing a transaction. */
export function sameReviewBasis(left: Transaction, right: Transaction): boolean {
  return left.accountId === right.accountId
    && left.categoryId === right.categoryId
    && left.date === right.date
    && left.authorizedDate === right.authorizedDate
    && left.amount === right.amount
    && left.currency === right.currency
    && left.payee === right.payee
    && left.pending === right.pending
    && JSON.stringify(left.classification) === JSON.stringify(right.classification)
    && JSON.stringify(left.bank) === JSON.stringify(right.bank);
}
