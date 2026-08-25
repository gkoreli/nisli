// Negative control: privileged shared module the developer forgot to mark.
// Only the algorithm is imported, so the sentinel constant is tree-shaken away
// while the privileged code ships.
import { derivePrivilegedSignature } from '../shared/leaky.js';

export const signature = derivePrivilegedSignature('bet-07');
