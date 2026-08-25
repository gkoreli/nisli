/**
 * Server-only shared module. Declares the `server-only` marker, so importing it
 * from a client-consumer environment must be a build error.
 */
import 'server-only';

export const DB_TOKEN = 'NISLI_SENTINEL_DB_TOKEN_7f3a91c4';
export const SIGNING_KEY = 'NISLI_SENTINEL_SIGNING_KEY_2b8e04df';

export const privilegedLookup = (id: string) => ({
  id,
  fingerprint: `${DB_TOKEN.slice(0, 6)}:${id}`,
});
