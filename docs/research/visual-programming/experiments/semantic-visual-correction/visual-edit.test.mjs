import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { decodeNvis, encodeNvis } from '../../examples/import-transactions/codec.mjs';
import { loadVisualProgram, observe } from '../../examples/import-transactions/runtime.mjs';
import { applyVisualCorrection } from './visual-edit.mjs';

const file = fileURLToPath(new URL('../../examples/import-transactions/import-transactions.nvis', import.meta.url));
const original = loadVisualProgram(readFileSync(file));

test('a painted point resolves to identity and propagates across the phase', () => {
  const result = applyVisualCorrection(original, {
    at: { width: 1280, phase: 'populated' },
    point: [710, 100],
    brush: { at: { width: 1280, phase: 'empty' }, point: [80, 400] },
    propagation: 'phase',
  });

  assert.equal(result.selected, 'step.preview');
  assert.deepEqual(result.changedObservations, ['populated@wide', 'populated@narrow']);
  assert.equal(observe(result.program, { width: 1280, phase: 'populated' }).marks
    .find((mark) => mark.id === 'step.preview').material, 'note');
  assert.equal(observe(result.program, { width: 360, phase: 'populated' }).marks
    .find((mark) => mark.id === 'step.preview').material, 'note');
});

test('observations outside the correction scope do not drift', () => {
  const result = applyVisualCorrection(original, {
    at: { width: 1280, phase: 'populated' },
    point: [710, 100],
    brush: { at: { width: 1280, phase: 'empty' }, point: [80, 400] },
    propagation: 'phase',
  });

  for (const id of ['empty@wide', 'empty@narrow']) {
    assert.deepEqual(
      result.program.observations.find((observation) => observation.id === id),
      original.observations.find((observation) => observation.id === id),
    );
  }
});

test('the visual correction survives binary save and reload', () => {
  const result = applyVisualCorrection(original, {
    at: { width: 1280, phase: 'populated' },
    point: [710, 100],
    brush: { at: { width: 1280, phase: 'empty' }, point: [80, 400] },
    propagation: 'phase',
  });
  const bytes = encodeNvis(result.program);
  const reloaded = decodeNvis(bytes);
  const edit = reloaded.edits.at(-1);

  assert.equal(edit.target, 'step.preview');
  assert.deepEqual(edit.point, [710, 100]);
  assert.deepEqual(edit.brush, { from: 'empty@wide', point: [80, 400] });
  assert.deepEqual(edit.changedObservations, ['populated@wide', 'populated@narrow']);
  assert.equal(observe(reloaded, { width: 360, phase: 'populated' }).marks
    .find((mark) => mark.id === 'step.preview').material, 'note');
});

test('a painted region without stable identity is rejected', () => {
  assert.throws(() => applyVisualCorrection(original, {
    at: { width: 1280, phase: 'populated' },
    point: [730, 125],
    brush: { at: { width: 1280, phase: 'empty' }, point: [80, 400] },
    propagation: 'phase',
  }), /has no stable identity/);
});
