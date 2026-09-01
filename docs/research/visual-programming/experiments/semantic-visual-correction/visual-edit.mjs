import { observe } from '../../examples/import-transactions/runtime.mjs';

const contains = (mark, x, y) => {
  const [left, top, width, height] = mark.box;
  return x >= left && x <= left + width && y >= top && y <= top + height;
};

const includesObservation = (observation, source, propagation) => {
  if (propagation === 'observation') return observation.id === source.observation.id;
  if (propagation === 'phase') return observation.at.phase === source.observation.at.phase;
  if (propagation === 'topology') return observation.at.topology === source.observation.at.topology;
  if (propagation === 'all') return true;
  throw new Error(`Unknown propagation ${propagation}`);
};

/**
 * Applies a visual correction. The authoring address is a point in a rendered
 * observation; stable identity is resolved internally and is never an input.
 */
export function applyVisualCorrection(program, input) {
  const source = observe(program, input.at);
  const selected = [...source.marks].reverse().find((mark) => contains(mark, ...input.point));
  if (!selected) throw new Error(`Nothing painted at ${input.point.join(',')}`);
  if (!program.identities.some((identity) => identity.id === selected.id)) {
    throw new Error(`Painted region ${selected.id} has no stable identity`);
  }

  const brushView = observe(program, input.brush.at);
  const brush = [...brushView.marks].reverse().find((mark) => contains(mark, ...input.brush.point));
  if (!brush) throw new Error(`Nothing to sample at ${input.brush.point.join(',')}`);
  if (brush.op !== selected.op) throw new Error('The sampled visual material is incompatible with the target');
  const change = Object.fromEntries(
    ['material', 'font'].flatMap((key) => brush[key] === undefined ? [] : [[key, brush[key]]]),
  );
  if (Object.keys(change).length === 0) throw new Error('The sampled region has no visual material');

  const revised = structuredClone(program);
  const changedObservations = [];
  for (const observation of revised.observations) {
    if (!includesObservation(observation, source, input.propagation)) continue;
    const mark = observation.marks.find((candidate) => candidate.id === selected.id);
    if (!mark) continue;
    Object.assign(mark, change);
    changedObservations.push(observation.id);
  }

  revised.edits.push({
    sequence: revised.edits.length + 1,
    operation: 'paint-correction',
    from: source.observation.id,
    point: input.point,
    brush: { from: brushView.observation.id, point: input.brush.point },
    target: selected.id,
    scope: `${input.propagation}=${source.observation.at[input.propagation] ?? input.propagation}`,
    change,
    changedObservations,
  });

  return { program: revised, selected: selected.id, changedObservations };
}
