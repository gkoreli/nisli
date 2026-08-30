/**
 * Plaid adapter. Plaid signs and names data differently from Ledger; every
 * account and transaction is normalized here before it reaches the domain.
 * Connections are handed in with their credential decrypted in memory only.
 */

export type PlaidEnvironment = 'development' | 'production';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export const PLAID_API_VERSION = '2020-09-14' as const;

/** Exact provider response data retained beside Ledger's normalized projection. */
export interface ProviderObservation<TPayload extends JsonObject = JsonObject> {
  schema: string;
  schemaVersion: typeof PLAID_API_VERSION;
  payload: TPayload;
}

export interface ProviderErrorOptions {
  status?: number;
  code?: string;
  requestId?: string;
}

export class ProviderError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(message: string, {
    status = 502,
    code = 'PLAID_ERROR',
    requestId,
  }: ProviderErrorOptions = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type PlaidAccountType = 'credit' | 'investment' | 'brokerage' | string;

interface PlaidBalances extends JsonObject {
  current?: number | null;
  available?: number | null;
  limit?: number | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  last_updated_datetime?: string | null;
}

interface PlaidAccountResponse extends JsonObject {
  account_id: string;
  name: string;
  mask?: string | null;
  official_name?: string | null;
  type: PlaidAccountType;
  subtype?: string | null;
  balances?: PlaidBalances | null;
}

interface PlaidPersonalFinanceCategory extends JsonObject {
  primary: string;
  detailed: string;
  confidence_level?: string | null;
  version?: string | null;
}

interface PlaidTransactionResponse extends JsonObject {
  transaction_id: string;
  account_id: string;
  date: string;
  authorized_date?: string | null;
  merchant_name?: string | null;
  name: string;
  amount: number;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  pending?: boolean | null;
  pending_transaction_id?: string | null;
  personal_finance_category?: PlaidPersonalFinanceCategory | null;
}

interface PlaidRemovedTransactionResponse extends JsonObject {
  transaction_id: string;
  account_id: string;
}

interface PlaidErrorResponse {
  error_code?: string;
  error_message?: string;
  display_message?: string;
  request_id?: string;
}

interface PlaidAccountsResponse extends JsonObject {
  accounts: PlaidAccountResponse[];
  item?: (JsonObject & { institution_name?: string | null }) | undefined;
  request_id?: string;
}

interface PlaidLinkTokenResponse {
  link_token: string;
}

interface PlaidExchangeResponse {
  access_token: string;
  item_id: string;
}

interface PlaidSyncResponse extends JsonObject {
  added: PlaidTransactionResponse[];
  modified: PlaidTransactionResponse[];
  removed: PlaidRemovedTransactionResponse[];
  next_cursor: string;
  has_more: boolean;
  transactions_update_status?: string | null;
  request_id?: string;
}

export type ProviderAccountKind = 'checking' | 'savings' | 'credit' | 'investment' | 'loan';

export interface ProviderAccount {
  id: string;
  name: string;
  mask: string;
  kind: ProviderAccountKind;
  type: string;
  subtype: string | null;
  balanceMinor: number;
  currency: string;
  source: ProviderObservation<PlaidAccountResponse>;
}

export interface ProviderCategory {
  taxonomy: 'personal_finance_category';
  primary: string;
  detailed: string;
  confidenceLevel: string | null;
  version: string;
}

export interface ProviderTransaction {
  id: string;
  accountId: string;
  bookedOn: string;
  authorizedOn?: string;
  description: string;
  amountMinor: number;
  currency: string;
  pending: boolean;
  replacesId?: string;
  providerCategory?: ProviderCategory;
  source: ProviderObservation<PlaidTransactionResponse>;
}

export interface ProviderRemoval {
  id: string;
  accountId: string;
  source: ProviderObservation<PlaidRemovedTransactionResponse>;
}

export interface PlaidSyncPageReceipt {
  requestId: string | null;
  cursor: string | null;
  nextCursor: string;
  hasMore: boolean;
  updateStatus: string;
  source: ProviderObservation<PlaidSyncResponse>;
}

export interface PlaidSyncReceipt {
  schema: 'plaid.TransactionsSync';
  schemaVersion: typeof PLAID_API_VERSION;
  pages: PlaidSyncPageReceipt[];
}

export interface PlaidItemCredential {
  access_token?: string;
  checkpoint?: string | null;
}

export interface PlaidExchangeRequest extends Record<string, unknown> {
  public_token?: string;
  institution?: string;
}

export interface PlaidConnection extends PlaidItemCredential {
  id: string;
  provider: 'plaid';
  environment: PlaidEnvironment;
  institution: string;
  checkpoint: null;
  status: 'ok';
  createdAt: string;
  accounts: ProviderAccount[];
}

export interface PlaidAccountSnapshot {
  accounts: ProviderAccount[];
  institution?: string;
  source: ProviderObservation<PlaidAccountsResponse>;
}

export interface PlaidSyncResult {
  added: ProviderTransaction[];
  modified: ProviderTransaction[];
  removed: ProviderRemoval[];
  accounts: ProviderAccount[];
  checkpoint: string | null;
  complete: true;
  updateStatus: string;
  historyReady: boolean;
  receipt: PlaidSyncReceipt;
  accountObservation: ProviderObservation<PlaidAccountsResponse>;
}

export interface PlaidProvider {
  readonly name: 'plaid';
  readonly env: PlaidEnvironment;
  linkToken(item?: PlaidItemCredential): Promise<{ link_token: string }>;
  exchange(body: PlaidExchangeRequest): Promise<PlaidConnection>;
  accounts(item: PlaidItemCredential): Promise<PlaidAccountSnapshot>;
  sync(item: PlaidItemCredential): Promise<PlaidSyncResult>;
  remove(item: Partial<PlaidItemCredential>): Promise<void>;
}

export interface PlaidProviderOptions {
  clientId: string;
  secret: string;
  env: PlaidEnvironment;
  redirectUri?: string;
}

const accountKind = (account: PlaidAccountResponse): ProviderAccountKind => {
  if (account.type === 'credit') return 'credit';
  if (account.type === 'investment' || account.type === 'brokerage') return 'investment';
  if (account.type === 'loan') return 'loan';
  if (account.subtype === 'savings' || account.subtype === 'money market' || account.subtype === 'cd') return 'savings';
  return 'checking';
};

const observation = <TPayload extends JsonObject>(schema: string, payload: TPayload): ProviderObservation<TPayload> => ({
  schema,
  schemaVersion: PLAID_API_VERSION,
  payload: structuredClone(payload),
});

const isoCurrency = (
  isoCode: string | null | undefined,
  unofficialCode: string | null | undefined,
  schema: string,
): string => {
  if (isoCode) return isoCode;
  if (unofficialCode) {
    throw new ProviderError(`${schema} uses unsupported unofficial currency ${unofficialCode}`, {
      code: 'PLAID_UNSUPPORTED_CURRENCY',
    });
  }
  throw new ProviderError(`${schema} did not provide a currency`, { code: 'PLAID_CONTRACT_ERROR' });
};

const minorUnits = (amount: number, currency: string, schema: string): number => {
  let fractionDigits: number;
  try {
    const resolved = new Intl.NumberFormat('en', { style: 'currency', currency })
      .resolvedOptions().maximumFractionDigits;
    if (resolved === undefined) throw new RangeError('Currency fraction digits are unavailable');
    fractionDigits = resolved;
  } catch {
    throw new ProviderError(`${schema} provided invalid ISO currency ${currency}`, {
      code: 'PLAID_CONTRACT_ERROR',
    });
  }
  const normalized = Math.round(amount * (10 ** fractionDigits));
  if (!Number.isSafeInteger(normalized)) {
    throw new ProviderError(`${schema} amount exceeds Ledger's safe integer range`, {
      code: 'PLAID_CONTRACT_ERROR',
    });
  }
  return normalized;
};

const plaidAccount = (account: PlaidAccountResponse): ProviderAccount => {
  const balance = account.balances?.current ?? account.balances?.available;
  if (balance === null || balance === undefined) {
    throw new ProviderError('plaid.AccountBase did not provide a current or available balance', {
      code: 'PLAID_CONTRACT_ERROR',
    });
  }
  const currency = isoCurrency(
    account.balances?.iso_currency_code,
    account.balances?.unofficial_currency_code,
    'plaid.AccountBase',
  );
  return {
    id: account.account_id,
    name: account.name,
    mask: account.mask ?? '',
    kind: accountKind(account),
    type: account.type,
    subtype: account.subtype ?? null,
    balanceMinor: minorUnits(balance, currency, 'plaid.AccountBase') * (account.type === 'credit' ? -1 : 1),
    currency,
    source: observation('plaid.AccountBase', account),
  };
};

const plaidTransaction = (transaction: PlaidTransactionResponse): ProviderTransaction => {
  const currency = isoCurrency(
    transaction.iso_currency_code,
    transaction.unofficial_currency_code,
    'plaid.Transaction',
  );
  return {
    id: transaction.transaction_id,
    accountId: transaction.account_id,
    bookedOn: transaction.date,
    ...(transaction.authorized_date ? { authorizedOn: transaction.authorized_date } : {}),
    description: transaction.merchant_name || transaction.name,
    amountMinor: -minorUnits(transaction.amount, currency, 'plaid.Transaction'),
    currency,
    pending: !!transaction.pending,
    ...(transaction.pending_transaction_id ? { replacesId: transaction.pending_transaction_id } : {}),
    ...(transaction.personal_finance_category
    ? { providerCategory: {
      taxonomy: 'personal_finance_category',
      primary: transaction.personal_finance_category.primary,
        detailed: transaction.personal_finance_category.detailed,
        confidenceLevel: transaction.personal_finance_category.confidence_level ?? null,
        // The request pins PFCv2. Older responses can omit this otherwise
        // redundant value; the exact omission remains visible in `source`.
        version: transaction.personal_finance_category.version ?? 'v2',
      } }
      : {}),
    source: observation('plaid.Transaction', transaction),
  };
};

const plaidRemoval = (removed: PlaidRemovedTransactionResponse): ProviderRemoval => ({
  id: removed.transaction_id,
  accountId: removed.account_id,
  source: observation('plaid.RemovedTransaction', removed),
});

const errorName = (error: unknown): string => error instanceof Error ? error.name : '';
const errorCode = (error: unknown): string | undefined => error instanceof ProviderError ? error.code : undefined;
const accessToken = (item: PlaidItemCredential): string => {
  if (!item.access_token) {
    throw new ProviderError('Bank connection must be reauthenticated', {
      status: 409,
      code: 'INVALID_ACCESS_TOKEN',
    });
  }
  return item.access_token;
};

const asErrorResponse = (value: unknown): PlaidErrorResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.error_code === 'string' ? { error_code: record.error_code } : {}),
    ...(typeof record.error_message === 'string' ? { error_message: record.error_message } : {}),
    ...(typeof record.display_message === 'string' ? { display_message: record.display_message } : {}),
    ...(typeof record.request_id === 'string' ? { request_id: record.request_id } : {}),
  };
};

export function plaidProvider({
  clientId,
  secret,
  env,
  redirectUri = '',
}: PlaidProviderOptions): PlaidProvider {
  async function call<TResponse>(path: string, body: object): Promise<TResponse> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await fetch(`https://${env}.plaid.com${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Plaid-Version': PLAID_API_VERSION,
          },
          body: JSON.stringify({ client_id: clientId, secret, ...body }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error: unknown) {
        const name = errorName(error);
        if (attempt < 2 && name !== 'AbortError' && name !== 'TimeoutError') {
          await new Promise<void>((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
        throw new ProviderError(name === 'AbortError' || name === 'TimeoutError'
          ? `Plaid ${path} timed out`
          : `Plaid ${path} could not be reached`, { code: 'PLAID_NETWORK_ERROR' });
      }

      const payload: unknown = await response.json().catch(() => ({}));
      if (response.ok) return payload as TResponse;

      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise<void>((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
        continue;
      }

      const error = asErrorResponse(payload);
      throw new ProviderError(
        error.error_message ?? error.display_message ?? `Plaid ${path} failed (${response.status})`,
        {
          status: error.error_code === 'ITEM_LOGIN_REQUIRED'
            ? 409
            : response.status === 429
              ? 429
              : response.status >= 400 && response.status < 500
                ? 400
                : 502,
          ...(error.error_code ? { code: error.error_code } : {}),
          ...(error.request_id ? { requestId: error.request_id } : {}),
        },
      );
    }
    throw new ProviderError(`Plaid ${path} failed`, { code: 'PLAID_RETRY_EXHAUSTED' });
  }

  const accounts = async (item: PlaidItemCredential): Promise<PlaidAccountSnapshot> => {
    const response = await call<PlaidAccountsResponse>('/accounts/get', { access_token: accessToken(item) });
    return {
      accounts: response.accounts.map(plaidAccount),
      ...(response.item?.institution_name ? { institution: response.item.institution_name } : {}),
      source: observation('plaid.AccountsGetResponse', response),
    };
  };

  return {
    name: 'plaid',
    env,

    async linkToken(item?: PlaidItemCredential): Promise<{ link_token: string }> {
      const request = {
        client_name: 'Ledger',
        country_codes: ['US'],
        language: 'en',
        user: { client_user_id: 'ledger' },
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
        ...(item?.access_token
          ? { access_token: item.access_token }
          : { products: ['transactions'], transactions: { days_requested: 730 } }),
      };
      const response = await call<PlaidLinkTokenResponse>('/link/token/create', request);
      return { link_token: response.link_token };
    },

    async exchange(body: PlaidExchangeRequest): Promise<PlaidConnection> {
      if (!body.public_token) {
        throw new ProviderError('public_token is required', { status: 400, code: 'INVALID_REQUEST' });
      }
      const exchange = await call<PlaidExchangeResponse>('/item/public_token/exchange', {
        public_token: body.public_token,
      });
      return {
        id: exchange.item_id,
        provider: 'plaid',
        environment: env,
        access_token: exchange.access_token,
        institution: body.institution || 'Bank',
        checkpoint: null,
        status: 'ok',
        createdAt: new Date().toISOString(),
        // A public token is one-use. Account enrichment deliberately happens
        // only after the application service has durably staged this Item.
        accounts: [],
      };
    },

    accounts,

    async sync(item: PlaidItemCredential): Promise<PlaidSyncResult> {
      const initialCheckpoint = item.checkpoint ?? undefined;
      let cursor: string | undefined;
      let output: Pick<PlaidSyncResult, 'added' | 'modified' | 'removed'> = {
        added: [],
        modified: [],
        removed: [],
      };
      let updateStatus = 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN';
      let complete = false;
      let pages: PlaidSyncPageReceipt[] = [];

      for (let pass = 0; pass < 2; pass++) {
        cursor = initialCheckpoint;
        output = { added: [], modified: [], removed: [] };
        updateStatus = 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN';
        complete = false;
        pages = [];
        try {
          for (let page = 0; page < 50; page++) {
            const pageCursor = cursor ?? null;
            const response = await call<PlaidSyncResponse>('/transactions/sync', {
              access_token: accessToken(item),
              cursor,
              count: 500,
              options: {
                include_original_description: true,
                personal_finance_category_version: 'v2',
              },
            });
            output.added.push(...response.added.map(plaidTransaction));
            output.modified.push(...response.modified.map(plaidTransaction));
            output.removed.push(...response.removed.map(plaidRemoval));
            cursor = response.next_cursor;
            updateStatus = response.transactions_update_status ?? updateStatus;
            pages.push({
              requestId: response.request_id ?? null,
              cursor: pageCursor,
              nextCursor: response.next_cursor,
              hasMore: response.has_more,
              updateStatus,
              source: observation('plaid.TransactionsSyncResponse', response),
            });
            if (!response.has_more) {
              complete = true;
              break;
            }
          }
        } catch (error: unknown) {
          if (pass === 0 && errorCode(error) === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') continue;
          throw error;
        }
        break;
      }

      if (!complete) {
        throw new ProviderError(
          'Plaid sync exceeded the pagination safety limit; the checkpoint was not advanced',
          { code: 'SYNC_PAGINATION_LIMIT' },
        );
      }
      const currentAccounts = await accounts(item);
      return {
        ...output,
        accounts: currentAccounts.accounts,
        checkpoint: cursor ?? item.checkpoint ?? null,
        complete: true,
        updateStatus,
        historyReady: updateStatus === 'HISTORICAL_UPDATE_COMPLETE',
        receipt: {
          schema: 'plaid.TransactionsSync',
          schemaVersion: PLAID_API_VERSION,
          pages,
        },
        accountObservation: currentAccounts.source,
      };
    },

    async remove(item: Partial<PlaidItemCredential>): Promise<void> {
      if (!item.access_token) return;
      try {
        await call<unknown>('/item/remove', { access_token: item.access_token });
      } catch (error: unknown) {
        // An invalid/already-removed credential no longer grants access, which
        // satisfies the disconnect command's security outcome.
        if (!['INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND'].includes(errorCode(error) ?? '')) throw error;
      }
    },
  };
}
