/**
 * Plaid adapter. Plaid signs and names data differently from Ledger; every
 * account and transaction is normalized here before it reaches the domain.
 * Connections are handed in with their credential decrypted in memory only.
 */

export class ProviderError extends Error {
  constructor(message, { status = 502, code = 'PLAID_ERROR', requestId } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

const accountKind = (account) => {
  if (account.type === 'credit') return 'credit';
  if (account.type === 'investment' || account.type === 'brokerage') return 'investment';
  if (account.subtype === 'savings' || account.subtype === 'money market' || account.subtype === 'cd') return 'savings';
  return 'checking';
};
const plaidAccount = (account) => {
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
const plaidTransaction = (transaction) => ({
  id: transaction.transaction_id,
  accountId: transaction.account_id,
  bookedOn: transaction.date,
  authorizedOn: transaction.authorized_date ?? undefined,
  description: transaction.merchant_name || transaction.name,
  amountMinor: -Math.round(transaction.amount * 100),
  currency: transaction.iso_currency_code ?? transaction.unofficial_currency_code ?? 'USD',
  pending: !!transaction.pending,
  replacesId: transaction.pending_transaction_id ?? undefined,
  providerCategory: transaction.personal_finance_category?.primary ?? undefined,
});

export function plaidProvider({ clientId, secret, env = 'sandbox', redirectUri = '' }) {
  async function call(path, body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try {
        res = await fetch(`https://${env}.plaid.com${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientId, secret, ...body }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (attempt < 2 && error?.name !== 'AbortError' && error?.name !== 'TimeoutError') {
          await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
          continue;
        }
        throw new ProviderError(error?.name === 'AbortError' || error?.name === 'TimeoutError'
          ? `Plaid ${path} timed out`
          : `Plaid ${path} could not be reached`, { code: 'PLAID_NETWORK_ERROR' });
      }
      const json = await res.json().catch(() => ({}));
      if (res.ok) return json;
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
        continue;
      }
      throw new ProviderError(json.error_message ?? json.display_message ?? `Plaid ${path} failed (${res.status})`, {
        status: json.error_code === 'ITEM_LOGIN_REQUIRED' ? 409 : res.status === 429 ? 429 : res.status >= 400 && res.status < 500 ? 400 : 502,
        code: json.error_code,
        requestId: json.request_id,
      });
    }
    throw new ProviderError(`Plaid ${path} failed`, { code: 'PLAID_RETRY_EXHAUSTED' });
  }
  const accounts = async (item) => (await call('/accounts/get', { access_token: item.access_token })).accounts.map(plaidAccount);

  return {
    name: 'plaid',
    env,
    async linkToken(item) {
      const request = {
        client_name: 'Ledger', country_codes: ['US'], language: 'en', user: { client_user_id: 'ledger' },
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
        ...(item?.access_token
          ? { access_token: item.access_token }
          : { products: ['transactions'], transactions: { days_requested: 730 } }),
      };
      const r = await call('/link/token/create', request);
      return { link_token: r.link_token };
    },
    async exchange(body) {
      if (!body.public_token) throw new ProviderError('public_token is required', { status: 400, code: 'INVALID_REQUEST' });
      const ex = await call('/item/public_token/exchange', { public_token: body.public_token });
      const acc = await call('/accounts/get', { access_token: ex.access_token });
      return {
        id: ex.item_id,
        provider: 'plaid',
        environment: env,
        access_token: ex.access_token,
        institution: body.institution || acc.item?.institution_name || 'Bank',
        checkpoint: null,
        status: 'ok',
        createdAt: new Date().toISOString(),
        accounts: acc.accounts.map(plaidAccount),
      };
    },
    accounts,
    async sync(item) {
      const initialCheckpoint = item.checkpoint ?? undefined;
      let cursor;
      let out;
      let updateStatus;
      let complete = false;
      for (let pass = 0; pass < 2; pass++) {
        cursor = initialCheckpoint;
        out = { added: [], modified: [], removed: [] };
        updateStatus = 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN';
        complete = false;
        try {
          for (let page = 0; page < 50; page++) {
            const r = await call('/transactions/sync', { access_token: item.access_token, cursor, count: 500 });
            out.added.push(...r.added.map(plaidTransaction));
            out.modified.push(...r.modified.map(plaidTransaction));
            out.removed.push(...r.removed.map((removed) => removed.transaction_id));
            cursor = r.next_cursor;
            updateStatus = r.transactions_update_status ?? updateStatus;
            if (!r.has_more) { complete = true; break; }
          }
        } catch (error) {
          if (pass === 0 && error?.code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') continue;
          throw error;
        }
        break;
      }
      if (!complete) throw new ProviderError('Plaid sync exceeded the pagination safety limit; the checkpoint was not advanced', { code: 'SYNC_PAGINATION_LIMIT' });
      const currentAccounts = await accounts(item);
      return {
        ...out,
        accounts: currentAccounts,
        checkpoint: cursor ?? item.checkpoint ?? null,
        complete: true,
        updateStatus,
        historyReady: updateStatus === 'HISTORICAL_UPDATE_COMPLETE',
      };
    },
    async remove(item) {
      if (!item.access_token) return;
      try {
        await call('/item/remove', { access_token: item.access_token });
      } catch (error) {
        // An invalid/already-removed credential no longer grants access, which
        // satisfies the disconnect command's security outcome.
        if (!['INVALID_ACCESS_TOKEN', 'ITEM_NOT_FOUND'].includes(error?.code)) throw error;
      }
    },
  };
}
