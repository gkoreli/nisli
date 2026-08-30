import { describe, expect, it } from 'vitest';
import {
  categorizeProviderFact,
  PLAID_PFC_LEDGER_MAPPING_VERSION,
  PLAID_PFC_TAXONOMY,
  PLAID_PFC_VERSION,
} from './categorization.ts';
import type { ProviderCategoryFact } from './categorization.ts';

const fact = (
  primary: string,
  detailed = `${primary}_OTHER`,
  confidence: string | null = 'VERY_HIGH',
): ProviderCategoryFact => ({
  provider: 'plaid',
  taxonomy: PLAID_PFC_TAXONOMY,
  version: PLAID_PFC_VERSION,
  primary,
  detailed,
  confidence,
});

describe('Plaid PFC v2 anti-corruption mapping', () => {
  it.each([
    ['INCOME', 'salary', 'Salary'],
    ['LOAN_DISBURSEMENTS', 'loans', 'Loans'],
    ['LOAN_PAYMENTS', 'loans', 'Loans'],
    ['TRANSFER_IN', 'transfer', 'Transfer'],
    ['TRANSFER_OUT', 'transfer', 'Transfer'],
    ['BANK_FEES', 'bank-fees', 'Bank fees'],
    ['ENTERTAINMENT', 'fun', 'Entertainment'],
    ['FOOD_AND_DRINK', 'dining', 'Dining out'],
    ['GENERAL_MERCHANDISE', 'shopping', 'Shopping'],
    ['HOME_IMPROVEMENT', 'housing', 'Housing'],
    ['MEDICAL', 'health', 'Health'],
    ['PERSONAL_CARE', 'personal-care', 'Personal care'],
    ['GENERAL_SERVICES', 'services', 'Services'],
    ['GOVERNMENT_AND_NON_PROFIT', 'government-and-non-profit', 'Government and non-profit'],
    ['TRANSPORTATION', 'transport', 'Transport'],
    ['TRAVEL', 'travel', 'Travel'],
    ['RENT_AND_UTILITIES', 'utilities', 'Utilities'],
    ['OTHER', 'other', 'Other'],
  ])('maps official primary %s to %s', (primary, categoryId, categoryName) => {
    expect(categorizeProviderFact(fact(primary))).toMatchObject({ categoryId, categoryName });
  });

  it.each([
    ['INCOME_INTEREST_EARNED', 'interest'],
    ['INCOME_DIVIDENDS', 'interest'],
    ['INCOME_WAGES', 'salary'],
  ])('maps income detail %s to %s', (detailed, categoryId) => {
    expect(categorizeProviderFact(fact('INCOME', detailed))).toMatchObject({ categoryId });
  });

  it.each([
    ['FOOD_AND_DRINK_GROCERIES', 'groceries'],
    ['FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR', 'groceries'],
    ['FOOD_AND_DRINK_RESTAURANT', 'dining'],
  ])('maps food detail %s to %s', (detailed, categoryId) => {
    expect(categorizeProviderFact(fact('FOOD_AND_DRINK', detailed))).toMatchObject({ categoryId });
  });

  it.each([
    ['RENT_AND_UTILITIES_RENT', 'housing'],
    ['RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', 'utilities'],
  ])('maps rent and utility detail %s to %s', (detailed, categoryId) => {
    expect(categorizeProviderFact(fact('RENT_AND_UTILITIES', detailed))).toMatchObject({ categoryId });
  });

  it.each(['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'])('accepts and preserves %s confidence', (confidence) => {
    expect(categorizeProviderFact(fact('TRAVEL', 'TRAVEL_FLIGHTS', confidence))?.decision).toEqual({
      source: 'provider',
      provider: 'plaid',
      taxonomy: PLAID_PFC_TAXONOMY,
      taxonomyVersion: PLAID_PFC_VERSION,
      primary: 'TRAVEL',
      detailed: 'TRAVEL_FLIGHTS',
      confidence,
      mappingVersion: PLAID_PFC_LEDGER_MAPPING_VERSION,
    });
  });

  it('accepts and preserves a null confidence', () => {
    expect(categorizeProviderFact(fact('OTHER', 'OTHER_OTHER', null))?.decision.confidence).toBeNull();
  });

  it.each([
    fact('FUTURE_PRIMARY'),
    { ...fact('TRAVEL'), provider: 'another-provider' },
    { ...fact('TRAVEL'), taxonomy: 'legacy_category' },
    { ...fact('TRAVEL'), version: 'v1' },
  ])('does not guess outside the supported taxonomy: $primary/$provider/$taxonomy/$version', (input) => {
    expect(categorizeProviderFact(input)).toBeUndefined();
  });
});
