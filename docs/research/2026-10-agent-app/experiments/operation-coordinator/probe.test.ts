import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { coordinator } from './coordinator.ts';

// Evaluate actual connection-screen closures with traced dependencies. Provider,
// persistence and query semantics stay in those dependencies, never reimplemented.
function original(name: string, scope: Record<string, unknown>) {
  const file = 'packages/ledger/src/screens/connections.ts';
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) expression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!expression) throw new Error(`Missing ${name}`);
  const js = ts.transpileModule(`const extracted = ${expression};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return Function(...Object.keys(scope), `${js};return extracted;`)(...Object.values(scope)) as (input?: unknown) => Promise<unknown>;
}

const fixture = (fail?: string) => {
  const trace: string[] = [];
  const step = <T = void>(name: string, value?: T) => async () => {
    trace.push(name);
    if (name === fail) throw new Error(name);
    return value;
  };
  const summary = { added: 2 };
  const scope = {
    flushNow: step('flush'),
    syncConnection: async (id: string) => { expect(id).toBe('bank-1'); return step('sync', summary)(); },
    syncAllItems: step('sync', [{ added: 2, ok: true }]),
    reloadFromServer: step('reload'),
    items: { refetch: step('connections') },
    composition: { refetch: step('composition') },
    notify: () => { trace.push('notify'); },
  };
  return { trace, scope };
};

describe('operation coordinator over actual Ledger connection closures', () => {
  for (const fail of [undefined, 'flush', 'sync', 'reload', 'connections', 'composition']) {
    it(`preserves syncOne effect trace when ${fail ?? 'nothing'} fails`, async () => {
      const before = fixture(fail);
      await original('syncOne', before.scope)({ id: 'bank-1' }).catch(() => {});
      const after = fixture(fail);
      const task = coordinator({
        completion: 'remote', prepare: after.scope.flushNow,
        execute: after.scope.syncConnection,
        reconcile: after.scope.reloadFromServer,
        refresh: [after.scope.items.refetch, after.scope.composition.refetch], refreshOn: 'settled',
      });
      const result = await task.invoke('bank-1');
      expect(after.trace).toEqual(before.trace);
      expect(result.effect).toBe(fail === 'flush' ? 'not-started' : fail === 'sync' ? 'unconfirmed' : 'acknowledged');
      expect(task.phase.value).toBe(fail ? result.effect === 'acknowledged' ? 'acknowledged-needs-attention' : result.effect === 'unconfirmed' ? 'outcome-unknown' : 'failed' : 'confirmed-remotely');
      console.log(JSON.stringify({ original: 'syncOne', fail: fail ?? null, trace: after.trace, effect: result.effect, phase: task.phase.value }));
    });
  }

  for (const fail of [undefined, 'flush', 'sync', 'reload', 'connections', 'composition']) {
    it(`preserves syncAll success-only refresh policy when ${fail ?? 'nothing'} fails`, async () => {
      const before = fixture(fail);
      await original('syncAll', before.scope)().catch(() => {});
      const after = fixture(fail);
      const task = coordinator({
        completion: 'remote', prepare: after.scope.flushNow,
        execute: after.scope.syncAllItems,
        reconcile: after.scope.reloadFromServer,
        refresh: [after.scope.items.refetch, after.scope.composition.refetch], refreshOn: 'success',
      });
      const result = await task.invoke(undefined);
      // Notification stays authored domain/presentation logic.
      if (!result.failure) after.scope.notify();
      expect(after.trace).toEqual(before.trace);
    });
  }

  it('does not describe a synchronous local write as remotely saved', async () => {
    const task = coordinator({ completion: 'local', execute: (value: number) => value, refresh: [], refreshOn: 'success' });
    const result = await task.invoke(10);
    expect(result).toMatchObject({ effect: 'acknowledged', completion: 'local', value: 10 });
    expect(task.phase.value).toBe('accepted-locally');
  });

  it('shares one session across UI and programmatic callers without double execution', async () => {
    let resolve!: (value: number) => void;
    let calls = 0;
    const task = coordinator({ completion: 'remote', execute: () => { calls++; return new Promise<number>(r => { resolve = r; }); }, refresh: [], refreshOn: 'success' });
    const first = task.invoke(undefined);
    await Promise.resolve();
    await expect(task.invoke(undefined)).rejects.toThrow('busy');
    resolve(1);
    expect((await first).effect).toBe('acknowledged');
    expect(calls).toBe(1);
  });

  it('does not replay an applied side effect after a failed read-back', async () => {
    let writes = 0;
    const task = coordinator({ completion: 'remote', execute: () => { writes++; return 42; }, reconcile: async () => { throw new Error('offline during read-back'); }, refresh: [], refreshOn: 'success' });
    const result = await task.invoke(undefined);
    expect(result).toMatchObject({ effect: 'acknowledged', failure: { phase: 'reconcile' } });
    expect(writes).toBe(1);
  });
});
