import { describe, it, expect } from 'vitest';
import { add, currencyOf, negate, only, others, plus, zero, type Amounts } from './money.js';
import type { Account, Transaction } from '../model.js';

describe('MoneyStats (finance §1)', () => {
  it('plus merges per currency and never across', () => {
    expect(plus({ USD: 1 }, { USD: 2, GEL: 5 })).toEqual({ GEL: 5, USD: 3 });
  });

  it('returns keys in sorted order, deterministically', () => {
    const a = plus({ USD: 1 }, { GEL: 5, EUR: 2 });
    expect(Object.keys(a)).toEqual(['EUR', 'GEL', 'USD']);
    expect(Object.keys(plus({ GEL: 5, EUR: 2 }, { USD: 1 }))).toEqual(['EUR', 'GEL', 'USD']);
  });

  it('upper-cases currency codes on add', () => {
    expect(Object.keys(add(zero, 'usd', 1))).toEqual(['USD']);
    expect(only(add(zero, 'usd', 1), 'USD')).toBe(1);
  });

  it('throws RangeError on a non-integer amount — money is never silently rounded', () => {
    expect(() => add(zero, 'USD', 0.5)).toThrow(RangeError);
    expect(() => add(zero, 'USD', Number.NaN)).toThrow(RangeError);
  });

  it('throws RangeError on an unsafe sum', () => {
    const max = add(zero, 'USD', Number.MAX_SAFE_INTEGER);
    expect(() => plus(max, { USD: 1 })).toThrow(RangeError);
  });

  it('does not mutate its inputs', () => {
    const a: Amounts = { USD: 1 };
    add(a, 'USD', 5);
    expect(a).toEqual({ USD: 1 });
    expect(zero).toEqual({});
  });

  it('negate flips every currency', () => {
    expect(negate({ GEL: 5, USD: -3 })).toEqual({ GEL: -5, USD: 3 });
  });

  it('only reads one currency, 0 when absent; others keeps the rest', () => {
    const a = { GEL: 5, USD: 3 };
    expect(only(a, 'USD')).toBe(3);
    expect(only(a, 'EUR')).toBe(0);
    expect(others(a, 'USD')).toEqual({ GEL: 5 });
    expect(others(a, 'EUR')).toEqual({ GEL: 5, USD: 3 });
  });

  it('currencyOf: transaction, then account, then default, upper-cased', () => {
    const accounts = new Map<string, Account>([
      ['gel', { id: 'gel', name: 'Gel', kind: 'checking', opening: 0, institution: 'T', currency: 'gel' }],
    ]);
    const t = (over: Partial<Transaction>): Transaction =>
      ({ id: 't', accountId: 'gel', categoryId: 'misc', date: '2026-08-01', amount: -1, payee: 'X', ...over });
    expect(currencyOf(t({ currency: 'eur' }), accounts, 'USD')).toBe('EUR');
    expect(currencyOf(t({}), accounts, 'USD')).toBe('GEL');
    expect(currencyOf(t({ accountId: 'missing' }), accounts, 'usd')).toBe('USD');
  });
});
