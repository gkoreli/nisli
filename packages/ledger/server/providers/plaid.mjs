/**
 * Plaid provider. Adapter interface (TENETS §7), shared with mock.mjs:
 *   { name, env, linkToken(), exchange(body) → item (with access_token), accounts(item),
 *     sync(item) → { added, modified, removed, accounts, cursor }, remove(item) }
 * Items are handed in with the token decrypted in memory; they never leave the server.
 */
import { mockItem, mockSync } from './mock.mjs';

export class ProviderError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }

const plaidAccount = (a) => ({
  id: a.account_id, name: a.name, mask: a.mask ?? '', type: a.type, subtype: a.subtype ?? null,
  balance: a.balances?.current ?? a.balances?.available ?? 0,
});
const tx = (t) => ({ id: t.transaction_id, account_id: t.account_id, date: t.date, name: t.merchant_name || t.name, amount: t.amount, pending: !!t.pending, category: t.personal_finance_category?.primary });

export function plaidProvider({ clientId, secret, env = 'sandbox' }) {
  async function call(path, body) {
    const res = await fetch(`https://${env}.plaid.com${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError(json.error_message ?? json.display_message ?? `Plaid ${path} failed (${res.status})`);
    return json;
  }
  const accounts = async (item) => (await call('/accounts/get', { access_token: item.access_token })).accounts.map(plaidAccount);

  return {
    name: 'plaid',
    env,
    async linkToken() {
      const r = await call('/link/token/create', {
        client_name: 'Ledger', products: ['transactions'], country_codes: ['US'], language: 'en', user: { client_user_id: 'ledger' },
      });
      return { link_token: r.link_token };
    },
    async exchange(body) {
      if (body.mock) return mockItem(body.institution); // a mock item is still allowed alongside real ones
      if (!body.public_token) throw new ProviderError('public_token is required', 400);
      const ex = await call('/item/public_token/exchange', { public_token: body.public_token });
      const acc = await call('/accounts/get', { access_token: ex.access_token });
      return {
        id: ex.item_id, access_token: ex.access_token, institution: body.institution || acc.item?.institution_name || 'Bank',
        cursor: null, createdAt: new Date().toISOString(), accounts: acc.accounts.map(plaidAccount),
      };
    },
    accounts,
    async sync(item) {
      if (!item.access_token) return mockSync(item);
      let cursor = item.cursor ?? undefined;
      const out = { added: [], modified: [], removed: [] };
      for (let guard = 0; guard < 50; guard++) {
        const r = await call('/transactions/sync', { access_token: item.access_token, cursor, count: 500 });
        out.added.push(...r.added.map(tx)); out.modified.push(...r.modified.map(tx)); out.removed.push(...r.removed);
        cursor = r.next_cursor;
        if (!r.has_more) break;
      }
      const accts = await accounts(item).catch(() => item.accounts);
      return { ...out, accounts: accts, cursor: cursor ?? item.cursor ?? null };
    },
    async remove(item) {
      if (item.access_token) await call('/item/remove', { access_token: item.access_token }).catch(() => {});
    },
  };
}
