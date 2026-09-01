// This file stands in for a future visual editor. The application source is
// the generated .nvis file; the runtime never imports this construction script.

const SURFACE = 1;
const TEXT = 2;
const CONTROL = 3;
const RULE = 4;
const REPEAT = 5;

const mark = (id, op, box, extra = {}) => ({ id, op, box, ...extra });
const surface = (id, box, material = 'surface') => mark(id, SURFACE, box, { material });
const text = (id, box, value, extra = {}) => mark(id, TEXT, box, { value, ...extra });
const control = (id, box, value, port, material = 'control') => mark(id, CONTROL, box, { value, port, material });

const title = (width) => [
  surface('world', [0, 0, width, 800], 'world'),
  text('screen.title', [width < 600 ? 18 : 42, 24, width - 64, 36], 'Import transactions', { font: 'title' }),
  mark('screen.rule', RULE, [width < 600 ? 14 : 36, 68, width - (width < 600 ? 28 : 72), 1], { material: 'rule' }),
];

const wideEmpty = {
  id: 'empty@wide',
  at: { phase: 'empty', topology: 'wide', width: 1280 },
  frame: [1280, 620],
  marks: [
    ...title(1280),
    surface('step.file', [42, 92, 1196, 450]),
    text('step.file.title', [72, 118, 300, 28], '1. File', { font: 'heading' }),
    text('file.label', [72, 168, 300, 22], 'CSV file', { font: 'label' }),
    control('file.control', [72, 198, 520, 172], 'Choose CSV file', 'file'),
    text('account.label', [632, 168, 300, 22], 'Into account', { font: 'label' }),
    control('account.control', [632, 198, 420, 48], 'Select an account', 'account'),
    surface('file.note', [72, 394, 520, 100], 'note'),
    text('file.note.text', [96, 416, 470, 54], 'Your bank can usually export transactions as a CSV file.', { font: 'body' }),
  ],
};

const narrowEmpty = {
  id: 'empty@narrow',
  at: { phase: 'empty', topology: 'narrow', width: 360 },
  frame: [360, 710],
  marks: [
    ...title(360),
    surface('step.file', [12, 88, 336, 574]),
    text('step.file.title', [30, 112, 260, 28], '1. File', { font: 'heading' }),
    text('file.label', [30, 160, 260, 22], 'CSV file', { font: 'label' }),
    control('file.control', [30, 190, 300, 170], 'Choose CSV file', 'file'),
    text('account.label', [30, 388, 260, 22], 'Into account', { font: 'label' }),
    control('account.control', [30, 418, 300, 48], 'Select an account', 'account'),
    surface('file.note', [30, 494, 300, 118], 'note'),
    text('file.note.text', [50, 518, 260, 68], 'Your bank can usually export transactions as a CSV file.', { font: 'body' }),
  ],
};

const mappingMarks = (box, narrow = false) => {
  const [x, y, w, h] = box;
  const left = x + (narrow ? 18 : 24);
  const controlX = x + (narrow ? 116 : 136);
  const controlW = w - (controlX - x) - (narrow ? 18 : 24);
  const top = y + 70;
  const gap = narrow ? 48 : 62;
  return [
    surface('step.mapping', box),
    text('step.mapping.title', [left, y + 24, w - 42, 28], '2. Columns', { font: 'heading' }),
    ...['Date', 'Payee', 'Amount', 'Note'].flatMap((label, index) => [
      text(`mapping.${label.toLowerCase()}.label`, [left, top + index * gap + 12, controlX - left - 8, 24], label, { font: 'label' }),
      control(`mapping.${label.toLowerCase()}.control`, [controlX, top + index * gap, controlW, 44], label === 'Payee' ? 'Description' : label, `mapping.${label.toLowerCase()}`),
    ]),
  ];
};

const previewMarks = (box, narrow = false) => {
  const [x, y, w, h] = box;
  const pad = narrow ? 18 : 22;
  const inner = w - pad * 2;
  const statsY = y + 68;
  const statGap = 8;
  const statW = (inner - statGap * 2) / 3;
  const statHeight = narrow ? 82 : 68;
  const tableY = statsY + (narrow ? 98 : 84);
  return [
    surface('step.preview', box),
    text('step.preview.title', [x + pad, y + 24, w - pad * 2, 28], '3. Preview', { font: 'heading' }),
    ...[
      ['found', 'Rows found', 'rowsFound', 'stat.good'],
      ['ready', 'Ready to import', 'readyCount', 'stat.good'],
      ['problems', 'Problems', 'problemCount', 'stat.warning'],
    ].flatMap(([id, label, binding, material], index) => {
      const sx = x + pad + index * (statW + statGap);
      return [
        surface(`stat.${id}`, [sx, statsY, statW, statHeight], material),
        text(`stat.${id}.label`, [sx + 10, statsY + 8, statW - 20, narrow ? 30 : 18], label, { font: 'caption' }),
        text(`stat.${id}.value`, [sx + 10, statsY + (narrow ? 48 : 30), statW - 20, 28], `{${binding}}`, { font: 'stat' }),
      ];
    }),
    mark('preview.rows', REPEAT, [x + pad, tableY, inner, narrow ? 150 : 244], {
      port: 'previewRows',
      material: 'table',
      columns: narrow
        ? [['date', 0.22], ['payee', 0.46], ['amount', 0.32]]
        : [['date', 0.18], ['payee', 0.40], ['amount', 0.22], ['status', 0.20]],
    }),
    control('import.action', [x + w - pad - (narrow ? inner : 210), y + h - 64, narrow ? inner : 210, 44], 'Import {readyCount} transactions', 'importAction', 'primary'),
  ];
};

const widePopulated = {
  id: 'populated@wide',
  at: { phase: 'populated', topology: 'wide', width: 1280 },
  frame: [1280, 720],
  marks: [
    ...title(1280),
    surface('step.file', [32, 92, 288, 566]),
    text('step.file.title', [54, 116, 230, 28], '1. File', { font: 'heading' }),
    text('file.label', [54, 164, 220, 22], 'CSV file', { font: 'label' }),
    control('file.control', [54, 194, 244, 74], '{fileName}', 'file'),
    text('account.label', [54, 300, 220, 22], 'Into account', { font: 'label' }),
    control('account.control', [54, 330, 244, 48], '{accountName}', 'account'),
    ...mappingMarks([336, 92, 350, 566]),
    ...previewMarks([702, 92, 546, 566]),
  ],
};

const narrowPopulated = {
  id: 'populated@narrow',
  at: { phase: 'populated', topology: 'narrow', width: 360 },
  frame: [360, 1010],
  marks: [
    ...title(360),
    surface('step.file', [12, 88, 336, 94]),
    text('step.file.title', [30, 108, 126, 24], '1. File', { font: 'heading' }),
    text('file.summary', [30, 142, 294, 22], '{fileName} · {accountName}', { font: 'caption' }),
    ...mappingMarks([12, 198, 336, 304], true),
    ...previewMarks([12, 518, 336, 444], true),
  ],
};

export const visualProgram = {
  format: 'nisli-visual-program',
  version: 1,
  name: 'Import transactions',
  thesis: 'the rendered interface is the source code',
  axes: {
    phase: ['empty', 'populated'],
    width: { min: 320, max: 1440 },
  },
  materials: {
    world: { fill: 0xf6f7fbff, text: 0x172033ff },
    surface: { fill: 0xffffffff, stroke: 0xdde3ecff, text: 0x172033ff, radius: 14 },
    control: { fill: 0xffffffff, stroke: 0xcbd4e1ff, text: 0x243047ff, radius: 8 },
    primary: { fill: 0x2463ebff, stroke: 0x2463ebff, text: 0xffffffff, radius: 8 },
    note: { fill: 0xedf4ffff, stroke: 0xd4e3ffff, text: 0x294568ff, radius: 10 },
    rule: { fill: 0xe1e6eeff },
    'stat.good': { fill: 0xecf9f0ff, stroke: 0xb9e4c5ff, text: 0x196337ff, radius: 8 },
    'stat.warning': { fill: 0xfff4eaff, stroke: 0xf4cfb2ff, text: 0x93451fff, radius: 8 },
    table: { fill: 0xffffffff, stroke: 0xe1e6eeff, text: 0x243047ff, radius: 0 },
  },
  typography: {
    title: { size: 25, weight: 600 },
    heading: { size: 17, weight: 600 },
    label: { size: 13, weight: 600 },
    body: { size: 14, weight: 400 },
    caption: { size: 11, weight: 500 },
    stat: { size: 23, weight: 600 },
  },
  observations: [wideEmpty, narrowEmpty, widePopulated, narrowPopulated],
  identities: [
    { id: 'screen.title', continuity: 'hold' },
    { id: 'step.file', continuity: 'reflow' },
    { id: 'file.control', continuity: 'replace', port: 'file' },
    { id: 'account.control', continuity: 'replace', port: 'account' },
    { id: 'step.mapping', continuity: 'appear', when: 'phase=populated' },
    { id: 'step.preview', continuity: 'appear', when: 'phase=populated' },
    { id: 'preview.rows', continuity: 'fold', port: 'previewRows' },
    { id: 'import.action', continuity: 'survive', port: 'importAction' },
  ],
  continuity: {
    width: { mode: 'topology', narrowBelow: 960, preserveIdentity: true },
    phase: { mode: 'state', preserveIdentity: true },
  },
  ports: [
    { id: 'file', direction: 'inout', kind: 'file', required: true },
    { id: 'account', direction: 'inout', kind: 'choice', required: true },
    { id: 'mapping.date', direction: 'inout', kind: 'choice', required: true },
    { id: 'mapping.payee', direction: 'inout', kind: 'choice', required: true },
    { id: 'mapping.amount', direction: 'inout', kind: 'choice', required: true },
    { id: 'mapping.note', direction: 'inout', kind: 'choice', required: false },
    { id: 'previewRows', direction: 'in', kind: 'collection', required: true },
    { id: 'importAction', direction: 'out', kind: 'action', required: true },
  ],
  edits: [
    { sequence: 1, operation: 'paint', scope: 'empty@wide', target: 'step.file' },
    { sequence: 2, operation: 'observe', scope: 'empty@narrow', target: 'step.file' },
    { sequence: 3, operation: 'bind', scope: 'all', target: 'file.control', port: 'file' },
    { sequence: 4, operation: 'paint', scope: 'populated@wide', target: 'step.preview' },
    { sequence: 5, operation: 'propagate', scope: 'phase=populated', target: 'step.preview' },
  ],
};
