import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { signal, resource, flush } from '../../../../../packages/core/src/index.ts';
import { parseCsv } from '../../../../../packages/ledger/src/data/csv.ts';

const source = ts.createSourceFile('import.ts', readFileSync('packages/ledger/src/screens/import.ts', 'utf8'), ts.ScriptTarget.Latest, true);
function original(name: string, scope: Record<string, unknown>) {
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!expression) throw new Error(`Missing ${name}`);
  const js = ts.transpileModule(`const extracted = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(scope), `${js};return extracted;`)(...Object.values(scope));
}
const guess = original('guess', {});
const guessMapping = original('guessMapping', { guess });
const files = () => {
  let resolve!: (text: string) => void;
  const slow = { text: () => new Promise<string>(r => { resolve = r; }) };
  const fast = { text: async () => 'date,payee,amount\n2026-08-30,Newest B,-20' };
  return { slow, fast, finishOld: () => resolve('date,payee,amount\n2026-08-29,Stale A,-10') };
};

describe('source lifetime in the actual CSV import loader', () => {
  it('the current imperative loader keeps the newest file after out-of-order reads', async () => {
    const rows = signal<string[][]>([]);
    const mapping = signal(undefined);
    const loadFile = original('loadFile', { rows, mapping, parseCsv, guessMapping });
    const f = files();
    const oldRead = loadFile(f.slow);
    await loadFile(f.fast);
    f.finishOld();
    await oldRead;
    console.log(JSON.stringify({ loader: 'actual loadFile', finalPayee: rows.value[1]?.[1] }));
    expect(rows.value[1]?.[1]).toBe('Newest B');
  });

  it('the existing resource primitive preserves the newest result with the same parser and mapping', async () => {
    const f = files();
    const selected = signal<typeof f.slow | undefined>(undefined);
    const result = resource(() => selected.value, async file => {
      const rows = parseCsv(await file.text());
      const headers = (rows[0] ?? []).map((h, i) => h.trim() || `Column ${i + 1}`);
      return { rows, mapping: guessMapping(headers, rows[1] ?? []) };
    });
    try {
      selected.value = f.slow;
      flush();
      await Promise.resolve();
      selected.value = f.fast;
      flush();
      await vi.waitFor(() => expect(result.data.value?.rows[1]?.[1]).toBe('Newest B'));
      f.finishOld();
      await Promise.resolve();
      await Promise.resolve();
      expect(result.data.value?.rows[1]?.[1]).toBe('Newest B');
      console.log(JSON.stringify({ loader: 'existing resource', finalPayee: result.data.value?.rows[1]?.[1] }));
    } finally { result.dispose(); }
  });
});
