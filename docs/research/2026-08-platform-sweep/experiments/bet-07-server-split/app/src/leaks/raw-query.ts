// Negative control: read the server module as text, bypassing stub substitution.
import serverSource from '../server/users.server.ts?raw';

export const leakedLength = serverSource.length;
export const leakedSource = serverSource;
