/**
 * MoneyStats — per-currency integer-cent sums (finance §1, tenet 6).
 *
 * Invariants: every stored value satisfies `Number.isSafeInteger`; a
 * non-integer or unsafe sum throws `RangeError` — money is never silently
 * rounded. There is no cross-currency total and no conversion function: a
 * report is per-currency or it names what it excluded. Keys are ISO-4217
 * upper-case and sorted in every returned object (tenet 13).
 */
import type { Account, Transaction } from '../model.js';

/** Integer minor units; may be negative. */
export type Cents = number;
/** ISO-4217 code → cents; an absent key is 0. */
export type Amounts = Readonly<Record<string, Cents>>;

export const zero: Amounts = Object.freeze({});

const sorted = (record: Record<string, Cents>): Amounts => {
  const out: Record<string, Cents> = {};
  for (const key of Object.keys(record).sort()) out[key] = record[key]!;
  return out;
};

export function add(a: Amounts, currency: string, cents: Cents): Amounts {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`money is integer cents, got ${cents}`);
  const code = currency.toUpperCase();
  const sum = (a[code] ?? 0) + cents;
  if (!Number.isSafeInteger(sum)) throw new RangeError(`unsafe money sum for ${code}`);
  return sorted({ ...a, [code]: sum });
}

export function plus(a: Amounts, b: Amounts): Amounts {
  let out: Amounts = zero;
  for (const [currency, cents] of Object.entries(a)) out = add(out, currency, cents);
  for (const [currency, cents] of Object.entries(b)) out = add(out, currency, cents);
  return out;
}

export function negate(a: Amounts): Amounts {
  let out: Amounts = zero;
  for (const [currency, cents] of Object.entries(a)) out = add(out, currency, -cents);
  return out;
}

/** The one currency's cents; 0 when absent. */
export const only = (a: Amounts, currency: string): Cents => a[currency.toUpperCase()] ?? 0;

/** Everything except `currency`. */
export function others(a: Amounts, currency: string): Amounts {
  const code = currency.toUpperCase();
  let out: Amounts = zero;
  for (const [c, cents] of Object.entries(a)) if (c.toUpperCase() !== code) out = add(out, c, cents);
  return out;
}

/** `t.currency ?? account.currency ?? defaultCurrency`, upper-cased. */
export const currencyOf = (
  t: Transaction,
  accountById: ReadonlyMap<string, Account>,
  defaultCurrency: string,
): string => (t.currency ?? accountById.get(t.accountId)?.currency ?? defaultCurrency).toUpperCase();
