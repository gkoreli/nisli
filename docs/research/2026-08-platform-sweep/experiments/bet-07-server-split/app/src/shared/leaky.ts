/**
 * A shared module a developer FORGOT to mark `server-only`. Used by the
 * `unmarked-privileged` negative control.
 *
 * `derivePrivilegedSignature` never references `ROTATION_SECRET`, so a client
 * that imports only the function tree-shakes the sentinel away while shipping
 * the privileged algorithm. That is the point of the control: it shows sentinel
 * grep is not a fail-closed detector.
 */
export const ROTATION_SECRET = 'NISLI_SENTINEL_ROTATION_c51d77ae';

export const derivePrivilegedSignature = (payload: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};
