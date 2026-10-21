import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { signal } from '../../../../../packages/core/src/index.ts';
import { createDraft } from '../../../../../packages/engine/src/blocks/form/draft.ts';
import type { Field } from '../../../../../packages/engine/src/blocks/form/schema.ts';

// Extract the actual trusted repository declarations: no simplified copies of
// the field rules. Execute only the computed callback; no app/server boot.
function fieldsFrom(file: string, name: string, scope: Record<string, unknown>): Field<Record<string, unknown>>[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) {
      expression = node.initializer.arguments[0]!.getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!expression) throw new Error(`No ${name} declaration in ${file}`);
  const js = ts.transpileModule(`const extracted = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(scope), `${js}\nreturn extracted();`)(...Object.values(scope));
}

const categories = signal([{ id: 'groceries', name: 'Groceries', income: false }, { id: 'salary', name: 'Salary', income: true }]);
const accounts = signal([{ id: 'bank-account', name: 'Bank' }]);
const own = (fields: Field<Record<string, unknown>>[], initial: Record<string, unknown>) => createDraft({ mode: 'owned', fields: signal(fields), initial: signal(initial), key: signal(1) });

describe('falsification: existing Form fields alone define a trusted machine operation', () => {
  it('bank-owned amount cannot be changed through the headless draft', () => {
    const fields = fieldsFrom('packages/ledger/src/screens/transaction-dialog.ts', 'fields', { props: { transaction: signal({ bank: { provider: 'plaid' } }) }, accounts, categories });
    const draft = own(fields, { date: '2026-08-29', kind: 'expense', amount: 12.34, payee: 'Bank observation', accountId: 'bank-account', categoryId: 'groceries', note: '' });
    try {
      expect(fields.find(f => f.name === 'amount')?.readOnly).toBe(true);
      draft.set('amount', 999);
      const result = draft.submit();
      console.log(JSON.stringify({ probe: 'readOnly boundary', ok: result.ok, amount: result.value.amount }));
      expect(result.ok && result.value.amount !== 12.34).toBe(false);
    } finally { draft.dispose(); }
  });

  it('a successful money field submission is a normalized finite number', () => {
    const fields = fieldsFrom('packages/ledger/src/screens/budgets.ts', 'fields', { categories });
    const draft = own(fields, { categoryId: 'groceries', limit: '25.50' });
    try {
      const result = draft.submit();
      console.log(JSON.stringify({ probe: 'normalization boundary', ok: result.ok, limit: result.value.limit, type: typeof result.value.limit }));
      expect(result.ok && typeof result.value.limit === 'number' && Number.isFinite(result.value.limit)).toBe(true);
    } finally { draft.dispose(); }
  });

  it('an unbounded money field rejects Infinity', () => {
    const fields = fieldsFrom('packages/ledger/src/screens/budgets.ts', 'fields', { categories });
    const draft = own(fields, { categoryId: 'groceries', limit: Infinity });
    try {
      const result = draft.submit();
      console.log(JSON.stringify({ probe: 'finite boundary', ok: result.ok, finite: Number.isFinite(result.value.limit) }));
      expect(result.ok).toBe(false);
    } finally { draft.dispose(); }
  });

  it('control: ordinary missing required values are rejected', () => {
    const fields = fieldsFrom('packages/ledger/src/screens/budgets.ts', 'fields', { categories });
    const draft = own(fields, { categoryId: '', limit: undefined });
    try { expect(draft.submit().ok).toBe(false); } finally { draft.dispose(); }
  });
});
