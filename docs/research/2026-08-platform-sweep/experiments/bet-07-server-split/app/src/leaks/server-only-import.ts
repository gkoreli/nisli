// Negative control: client imports a `server-only`-marked shared module.
import { DB_TOKEN, privilegedLookup } from '../shared/secrets.js';

export const token = DB_TOKEN;
export const lookup = privilegedLookup;
