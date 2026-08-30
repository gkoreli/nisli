/**
 * Versioned anti-corruption mapping from Plaid's Personal Finance Category v2
 * taxonomy into Ledger-owned category identities. Provider vocabulary ends at
 * this boundary; the returned decision retains the exact source fact so the
 * automatic choice remains explainable and can be reprojected later.
 */

export const PLAID_PFC_TAXONOMY = 'personal_finance_category';
export const PLAID_PFC_VERSION = 'v2';
export const PLAID_PFC_LEDGER_MAPPING_VERSION = 'plaid-pfc-v2-ledger-v2';

export interface ProviderCategoryFact {
  provider: string;
  taxonomy: string;
  version: string;
  primary: string;
  detailed: string;
  confidence: string | null;
}

export interface ProviderCategoryDecision {
  source: 'provider';
  provider: string;
  taxonomy: string;
  taxonomyVersion: string;
  primary: string;
  detailed: string;
  confidence: string | null;
  mappingVersion: typeof PLAID_PFC_LEDGER_MAPPING_VERSION;
}

export interface ProviderCategoryMapping {
  categoryId: string;
  categoryName: string;
  decision: ProviderCategoryDecision;
}

type LedgerCategory = Pick<ProviderCategoryMapping, 'categoryId' | 'categoryName'>;

const category = (categoryId: string, categoryName: string): LedgerCategory => ({ categoryId, categoryName });

const CATEGORIES = {
  salary: category('salary', 'Salary'),
  interest: category('interest', 'Interest'),
  loans: category('loans', 'Loans'),
  transfer: category('transfer', 'Transfer'),
  bankFees: category('bank-fees', 'Bank fees'),
  entertainment: category('fun', 'Entertainment'),
  groceries: category('groceries', 'Groceries'),
  dining: category('dining', 'Dining out'),
  shopping: category('shopping', 'Shopping'),
  housing: category('housing', 'Housing'),
  health: category('health', 'Health'),
  personalCare: category('personal-care', 'Personal care'),
  services: category('services', 'Services'),
  governmentAndNonProfit: category('government-and-non-profit', 'Government and non-profit'),
  transport: category('transport', 'Transport'),
  travel: category('travel', 'Travel'),
  utilities: category('utilities', 'Utilities'),
  other: category('other', 'Other'),
} as const;

const INCOME_INTEREST_DETAILS = new Set([
  'INCOME_DIVIDENDS',
  'INCOME_INTEREST_EARNED',
]);

const FOOD_GROCERY_DETAILS = new Set([
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR',
  'FOOD_AND_DRINK_GROCERIES',
]);

const LOAN_PAYMENT_TRANSFER_DETAILS = new Set([
  // Paying a credit-card balance moves money between owned accounts. The
  // purchases already carry their spending categories, so treating this as
  // spending would count the same money twice.
  'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
]);

const categoryFor = ({ primary, detailed }: ProviderCategoryFact): LedgerCategory | undefined => {
  switch (primary) {
    case 'INCOME':
      return INCOME_INTEREST_DETAILS.has(detailed) ? CATEGORIES.interest : CATEGORIES.salary;
    case 'LOAN_DISBURSEMENTS':
      // Borrowed proceeds are a balance-sheet movement, not earned income.
      return CATEGORIES.transfer;
    case 'LOAN_PAYMENTS':
      return LOAN_PAYMENT_TRANSFER_DETAILS.has(detailed) ? CATEGORIES.transfer : CATEGORIES.loans;
    case 'TRANSFER_IN':
    case 'TRANSFER_OUT':
      return CATEGORIES.transfer;
    case 'BANK_FEES':
      return CATEGORIES.bankFees;
    case 'ENTERTAINMENT':
      return CATEGORIES.entertainment;
    case 'FOOD_AND_DRINK':
      return FOOD_GROCERY_DETAILS.has(detailed) ? CATEGORIES.groceries : CATEGORIES.dining;
    case 'GENERAL_MERCHANDISE':
      return CATEGORIES.shopping;
    case 'HOME_IMPROVEMENT':
      return CATEGORIES.housing;
    case 'MEDICAL':
      return CATEGORIES.health;
    case 'PERSONAL_CARE':
      return CATEGORIES.personalCare;
    case 'GENERAL_SERVICES':
      return CATEGORIES.services;
    case 'GOVERNMENT_AND_NON_PROFIT':
      return CATEGORIES.governmentAndNonProfit;
    case 'TRANSPORTATION':
      return CATEGORIES.transport;
    case 'TRAVEL':
      return CATEGORIES.travel;
    case 'RENT_AND_UTILITIES':
      return detailed === 'RENT_AND_UTILITIES_RENT' ? CATEGORIES.housing : CATEGORIES.utilities;
    case 'OTHER':
      return CATEGORIES.other;
    default:
      return undefined;
  }
};

/** Map one authoritative Plaid PFC v2 fact into Ledger vocabulary. */
export function categorizeProviderFact(fact: ProviderCategoryFact): ProviderCategoryMapping | undefined {
  if (fact.provider !== 'plaid'
    || fact.taxonomy !== PLAID_PFC_TAXONOMY
    || fact.version !== PLAID_PFC_VERSION) return undefined;
  const mapped = categoryFor(fact);
  if (!mapped) return undefined;
  return {
    ...mapped,
    decision: {
      source: 'provider',
      provider: fact.provider,
      taxonomy: fact.taxonomy,
      taxonomyVersion: fact.version,
      primary: fact.primary,
      detailed: fact.detailed,
      confidence: fact.confidence,
      mappingVersion: PLAID_PFC_LEDGER_MAPPING_VERSION,
    },
  };
}
