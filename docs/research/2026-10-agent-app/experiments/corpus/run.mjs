import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const dir = 'packages/ledger/src/screens';
const calls = new Set(['Form', 'Dialog', 'confirm', 'notify', 'query', 'resource', 'flushNow', 'reloadFromServer']);
const output = [];
for (const name of readdirSync(dir).filter(n => n.endsWith('.ts') && !n.includes('.test.')).sort()) {
  const file = `${dir}/${name}`;
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const signals = [];
  const rules = [];
  const walk = node => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      const key = calls.has(callee) ? callee : ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'refetch' ? 'refetch' : undefined;
      if (key) found.push({ kind: key, line });
    }
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(source) === 'signal') signals.push({ name: node.name.getText(source), line });
    if (ts.isPropertyAssignment(node) && ['when', 'validate', 'readOnly', 'options'].includes(node.name.getText(source))) rules.push({ kind: node.name.getText(source), line, executable: ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer) });
    ts.forEachChild(node, walk);
  };
  walk(source);
  output.push({ file, lines: text.trimEnd().split('\n').length, calls: found, signals, rules });
}
const counts = {};
for (const row of output) for (const call of row.calls) counts[call.kind] = (counts[call.kind] ?? 0) + 1;
console.log(JSON.stringify({ scope: 'Ledger screens only; syntax counts, not savings or independent bugs', files: output.length, lines: output.reduce((n, r) => n + r.lines, 0), counts, signalDeclarations: output.reduce((n, r) => n + r.signals.length, 0), screens: output }, null, 2));
