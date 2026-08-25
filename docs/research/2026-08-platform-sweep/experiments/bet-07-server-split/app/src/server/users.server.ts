import { serverFn } from '../runtime/server-fn.js';
import { formatName } from '../shared/format.js';
import { DB_TOKEN, privilegedLookup } from '../shared/secrets.js';

/** type-only export — must be erased, must not become a stub */
export type User = { id: string; name: string };
/** type-only re-export from another server module — must be erased too */
export type { AdminAudit } from './admin.server.js';

// direct export 1
export const getUser = serverFn<{ id: string }, User & { fingerprint: string }>({
  input: 'object',
  handler: async (input) => {
    const looked = privilegedLookup(input.id);
    // HMR-body probe marker: NISLI_SENTINEL_HANDLER_BODY_9d20ba61
    return { id: input.id, name: formatName('Ada', 'Lovelace'), fingerprint: looked.fingerprint };
  },
});

// direct export 2
export const updateUser = serverFn<{ id: string; name: string }, { ok: true; token: string }>({
  input: 'object',
  handler: async (input) => ({ ok: true, token: `${DB_TOKEN}:${input.name}` }),
});

// aliased local export
const listUsersFn = serverFn<'none', User[]>({
  input: 'none',
  handler: async () => [{ id: '1', name: formatName('Grace', 'Hopper') }],
});
export { listUsersFn as listUsers };

// value re-export from a second server module — must reuse admin.server.ts's id
export { deleteUser } from './admin.server.js';
