// Grammar control: a server module exporting a non-serverFn value. A stub for
// `API_KEY` would silently turn a secret into a client-callable endpoint.
import { serverFn } from '../runtime/server-fn.js';

export const API_KEY = 'NISLI_SENTINEL_APIKEY_4e6c18b2';

export const ping = serverFn<'none', { ok: true }>({
  input: 'none',
  handler: async () => ({ ok: true }),
});
