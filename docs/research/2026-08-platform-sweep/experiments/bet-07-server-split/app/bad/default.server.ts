// Grammar control: default export has no name to key a function id on.
import { serverFn } from '../runtime/server-fn.js';

export default serverFn<'none', { ok: true }>({
  input: 'none',
  handler: async () => ({ ok: true }),
});
