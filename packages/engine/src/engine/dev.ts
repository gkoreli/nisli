/**
 * The dev gate, the same probe core's diagnostics use (core does not export
 * `isDev`): Vite/vitest `import.meta.env`, then `process.env.NODE_ENV`, then
 * loud by default. Engine diagnostics — the report stamp and ring buffer —
 * exist only in dev.
 */
function probe(): boolean {
  const env = (import.meta as ImportMeta & { env?: { DEV?: unknown; PROD?: unknown } }).env;
  if (env && typeof env.DEV === 'boolean') return env.DEV;
  if (env && typeof env.PROD === 'boolean') return !env.PROD;
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV;
  if (typeof nodeEnv === 'string') return nodeEnv !== 'production';
  return true;
}

const probed = probe();
let override: boolean | null = null;

export function isDev(): boolean {
  return override ?? probed;
}

/** Test seam: force dev on/off, or `null` to restore the probe. */
export function setDevMode(on: boolean | null): void {
  override = on;
}

/** The current override, so a caller that forces dev can restore exactly what was there. */
export function devOverride(): boolean | null {
  return override;
}
