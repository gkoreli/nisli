// aliased bundler path (@app -> src) + aliased import binding
import { getUser as fetchUser, listUsers } from '@app/server/users.server.js';
// through the barrel, including a renamed re-export
import { deleteUser, formatName, saveUser } from '../server/api.js';

type WithId = { __fnId: string };

/** Re-exported so the harness can invoke real stubs from the built bundle. */
export { deleteUser, fetchUser, listUsers, saveUser };

export const stubIds = {
  deleteUser: (deleteUser as unknown as WithId).__fnId,
  getUser: (fetchUser as unknown as WithId).__fnId,
  listUsers: (listUsers as unknown as WithId).__fnId,
  updateUser: (saveUser as unknown as WithId).__fnId,
};

export const label = formatName('Ada', 'Lovelace');
