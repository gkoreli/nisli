import { serverFn } from '../runtime/server-fn.js';
import { SIGNING_KEY } from '../shared/secrets.js';

export type AdminAudit = { deleted: string; audit: string };

export const deleteUser = serverFn<{ id: string }, AdminAudit>({
  input: 'object',
  handler: async (input) => ({
    deleted: input.id,
    audit: `${SIGNING_KEY.slice(0, 8)}#${input.id}`,
  }),
});
