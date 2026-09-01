import { decodeNvis } from './codec.mjs';

const token = /\{([^}]+)\}/g;
const bindText = (value, data) => String(value ?? '').replace(token, (_, key) => String(data[key] ?? ''));

export function loadVisualProgram(bytes) {
  const program = decodeNvis(bytes);
  if (program.format !== 'nisli-visual-program') throw new Error(`Unknown visual program ${program.format}`);
  return program;
}

export function observe(program, context) {
  const topology = context.width < program.continuity.width.narrowBelow ? 'narrow' : 'wide';
  const observation = program.observations.find((candidate) =>
    candidate.at.phase === context.phase && candidate.at.topology === topology);
  if (!observation) throw new Error(`No observation for ${context.phase}@${topology}`);
  const scale = context.width / observation.frame[0];
  const data = context.data ?? {};
  const marks = observation.marks.map((source) => ({
    ...source,
    box: [source.box[0] * scale, source.box[1], source.box[2] * scale, source.box[3]],
    value: source.value === undefined ? undefined : bindText(source.value, data),
    rows: source.op === 5 ? (data[source.port] ?? []) : undefined,
  }));
  return {
    program,
    observation,
    context: { ...context, topology },
    frame: [context.width, observation.frame[1]],
    marks,
  };
}

export function activate(view, x, y) {
  return [...view.marks].reverse().find((mark) => {
    if (!mark.port || mark.op !== 3) return false;
    const [left, top, width, height] = mark.box;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  })?.port;
}
