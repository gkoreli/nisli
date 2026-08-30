/**
 * Plaid adapter. Plaid signs and names data differently from Ledger; every
 * account and transaction is normalized here before it reaches the domain.
 * Connections are handed in with their credential decrypted in memory only.
 */

export type PlaidEnvironment = 'development' | 'production';

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

interface PlaidBalances {
  current?: number | null;
  available?: number | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
}

interface PlaidAccountResponse {
  account_id: string;
  name: string;
  mask?: string | null;
  type: PlaidAccountType;
  subtype?: string | null;
  balances?: PlaidBalances | null;
}

interface PlaidPersonalFinanceCategory {
  primary?: string | null;
}

interface PlaidTransactionResponse {
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

interface PlaidRemovedTransactionResponse {
  transaction_id: string;
}

interface PlaidErrorResponse {
  error_code?: string;
  error_message?: string;
  display_message?: string;
  request_id?: string;
}

interface PlaidAccountsResponse {
  accounts: PlaidAccountResponse[];
  item?: { institution_name?: string | null };
}

interface PlaidLinkTokenResponse {
  link_token: string;
}

interface PlaidExchangeResponse {
  access_token: string;
  item_id: string;
}

interface PlaidSyncResponse {
  added: PlaidTransactionResponse[];
  modified: PlaidTransactionResponse[];
  removed: PlaidRemovedTransactionResponse[];
  next_cursor: string;
  has_more: boolean;
  transactions_update_status?: string | null;
}

export type ProviderAccountKind = 'checking' | 'savings' | 'credit' | 'investment';

export interface ProviderAccount {
  id: string;
  name: string;
  mask: string;
  kind: ProviderAccountKind;
  type: string;
  subtype: string | null;
  balanceMinor: number;
  currency: string;
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
  providerCategory?: string;
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

export interface PlaidSyncResult {
  added: ProviderTransaction[];
  modified: ProviderTransaction[];
  removed: string[];
  accounts: ProviderAccount[];
  checkpoint: string | null;
  complete: true;
  updateStatus: string;
  historyReady: boolean;
}

export interface PlaidProvider {
  readonly name: 'plaid';
  readonly env: PlaidEnvironment;
  linkToken(item?: PlaidItemCredential): Promise<{ link_token: string }>;
  exchange(body: PlaidExchangeRequest): Promise<PlaidConnection>;
  accounts(item: PlaidItemCredential): Promise<ProviderAccount[]>;
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
  if (account.subtype === 'savings' || account.subtype === 'money market' || account.subtype === 'cd') return 'savings';
  return 'checking';
};

const plaidAccount = (account: PlaidAccountResponse): ProviderAccount => {
  const balance = account.balances?.current ?? account.balances?.available ?? 0;
  return {
    id: account.account_id,
    name: account.name,
    mask: account.mask ?? '',
    kind: accountKind(account),
    type: account.type,
    subtype: account.subtype ?? null,
    balanceMinor: Math.round(balance * 100) * (account.type === 'credit' ? -1 : 1),
    currency: account.balances?.iso_currency_code ?? account.balances?.unofficial_currency_code ?? 'USD',
  };
};

const plaidTransaction = (transaction: PlaidTransactionResponse): ProviderTransaction => ({
  id: transaction.transaction_id,
  accountId: transaction.account_id,
  bookedOn: transaction.date,
  ...(transaction.authorized_date ? { authorizedOn: transaction.authorized_date } : {}),
  description: transaction.merchant_name || transaction.name,
  amountMinor: -Math.round(transaction.amount * 100),
  currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? 'USD',
  pending: !!transaction.pending,
  ...(transaction.pending_transaction_id ? { replacesId: transaction.pending_transaction_id } : {}),
  ...(transaction.personal_finance_category?.primary
    ? { providerCategory: transaction.personal_finance_category.primary }
    : {}),
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
          headers: { 'Content-Type': 'application/json' },
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

  const accounts = async (item: PlaidItemCredential): Promise<ProviderAccount[]> => {
    const response = await call<PlaidAccountsResponse>('/accounts/get', { access_token: accessToken(item) });
    return response.accounts.map(plaidAccount);
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
      const accountResponse = await call<PlaidAccountsResponse>('/accounts/get', {
        access_token: exchange.access_token,
      });
      return {
        id: exchange.item_id,
        provider: 'plaid',
        environment: env,
        access_token: exchange.access_token,
        institution: body.institution || accountResponse.item?.institution_name || 'Bank',
        checkpoint: null,
        status: 'ok',
        createdAt: new Date().toISOString(),
        accounts: accountResponse.accounts.map(plaidAccount),
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

      for (let pass = 0; pass < 2; pass++) {
        cursor = initialCheckpoint;
        output = { added: [], modified: [], removed: [] };
        updateStatus = 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN';
        complete = false;
        try {
          for (let page = 0; page < 50; page++) {
            const response = await call<PlaidSyncResponse>('/transactions/sync', {
              access_token: accessToken(item),
              cursor,
              count: 500,
            });
            output.added.push(...response.added.map(plaidTransaction));
            output.modified.push(...response.modified.map(plaidTransaction));
            output.removed.push(...response.removed.map((removed) => removed.transaction_id));
            cursor = response.next_cursor;
            updateStatus = response.transactions_update_status ?? updateStatus;
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
        accounts: currentAccounts,
        checkpoint: cursor ?? item.checkpoint ?? null,
        complete: true,
        updateStatus,
        historyReady: updateStatus === 'HISTORICAL_UPDATE_COMPLETE',
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
