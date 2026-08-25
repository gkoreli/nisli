/** Plain barrel — a normal client module that re-exports server functions. */
export { deleteUser, getUser } from './users.server.js';
export { updateUser as saveUser } from './users.server.js';
export type { User } from './users.server.js';
export { formatName } from '../shared/format.js';
