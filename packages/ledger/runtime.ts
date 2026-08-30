export const LEDGER_BUN_VERSION = '1.4.0';

/** Refuse silent runtime drift in the processes that handle financial data. */
export function assertLedgerBunRuntime(): void {
  const actual = process.versions.bun;
  if (actual !== LEDGER_BUN_VERSION) {
    throw new Error(`Ledger requires Bun ${LEDGER_BUN_VERSION}; running ${actual ?? 'Node.js'}`);
  }
}
