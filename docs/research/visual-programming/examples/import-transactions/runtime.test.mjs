import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { activate, loadVisualProgram, observe } from './runtime.mjs';

const file = fileURLToPath(new URL('./import-transactions.nvis', import.meta.url));
const bytes = readFileSync(file);
const program = loadVisualProgram(bytes);
const data = {
  fileName: 'chase-checking.csv',
  accountName: 'Checking account',
  rowsFound: 23,
  readyCount: 23,
  problemCount: 0,
  previewRows: [
    { date: 'May 24', payee: 'Grocery Store', amount: '-$85.42', status: 'Ready' },
    { date: 'May 23', payee: 'Payroll Deposit', amount: '$2,300.00', status: 'Ready' },
  ],
};

test('the file is an executable NVIS binary, not the construction fixture', () => {
  assert.equal(bytes.subarray(0, 4).toString(), 'NVIS');
  assert.equal(program.name, 'Import transactions');
  assert.equal(program.observations.length, 4);
  assert.equal(program.ports.length, 8);
});

test('state selects observations while identity survives', () => {
  const empty = observe(program, { width: 1280, phase: 'empty', data });
  const populated = observe(program, { width: 1280, phase: 'populated', data });
  assert.equal(empty.observation.id, 'empty@wide');
  assert.equal(populated.observation.id, 'populated@wide');
  assert(empty.marks.some((mark) => mark.id === 'step.file'));
  assert(populated.marks.some((mark) => mark.id === 'step.file'));
  assert(!empty.marks.some((mark) => mark.id === 'step.preview'));
  assert(populated.marks.some((mark) => mark.id === 'step.preview'));
});

test('width evaluates topology directly without generating UI code', () => {
  const narrow = observe(program, { width: 360, phase: 'populated', data });
  const middle = observe(program, { width: 768, phase: 'populated', data });
  const wide = observe(program, { width: 1280, phase: 'populated', data });
  assert.equal(narrow.context.topology, 'narrow');
  assert.equal(middle.context.topology, 'narrow');
  assert.equal(wide.context.topology, 'wide');
  assert.equal(middle.frame[0], 768);
  assert(middle.marks.every((mark) => mark.box[0] + mark.box[2] <= 768.001));
});

test('visual controls expose semantic ports to domain code', () => {
  const empty = observe(program, { width: 360, phase: 'empty', data });
  const choose = empty.marks.find((mark) => mark.id === 'file.control');
  const [x, y, width, height] = choose.box;
  assert.equal(activate(empty, x + width / 2, y + height / 2), 'file');

  const populated = observe(program, { width: 1280, phase: 'populated', data });
  assert.equal(populated.marks.find((mark) => mark.id === 'import.action').value, 'Import 23 transactions');
  assert.deepEqual(populated.marks.find((mark) => mark.id === 'preview.rows').rows, data.previewRows);
});
