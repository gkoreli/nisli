import { activate, loadVisualProgram, observe } from './runtime.mjs';

const program = loadVisualProgram(await fetch('./import-transactions.nvis').then((response) => response.arrayBuffer()));
const canvas = document.querySelector('#screen');
const context2d = canvas.getContext('2d');
const phase = document.querySelector('#phase');
const width = document.querySelector('#width');
const widthValue = document.querySelector('#width-value');
const identities = document.querySelector('#identities');
const status = document.querySelector('#status');

const data = {
  fileName: 'chase-checking.csv',
  accountName: 'Checking account',
  rowsFound: 23,
  readyCount: 23,
  problemCount: 0,
  previewRows: [
    { date: 'May 24', payee: 'Grocery Store', amount: '-$85.42', status: 'Ready' },
    { date: 'May 23', payee: 'Payroll Deposit', amount: '$2,300.00', status: 'Ready' },
    { date: 'May 22', payee: 'Electric Company', amount: '-$120.12', status: 'Ready' },
  ],
};

let view;
const rgba = (integer) => `rgba(${integer >>> 24},${integer >>> 16 & 255},${integer >>> 8 & 255},${(integer & 255) / 255})`;
const rounded = (box, radius) => {
  const [x, y, w, h] = box;
  context2d.beginPath();
  context2d.roundRect(x, y, w, h, radius ?? 0);
};
const material = (name) => program.materials[name] ?? program.materials.surface;

const drawSurface = (mark) => {
  const paint = material(mark.material);
  rounded(mark.box, paint.radius);
  context2d.fillStyle = rgba(paint.fill);
  context2d.fill();
  if (paint.stroke) {
    context2d.strokeStyle = rgba(paint.stroke);
    context2d.lineWidth = 1;
    context2d.stroke();
  }
};

const drawText = (mark) => {
  const style = program.typography[mark.font ?? 'body'];
  const paint = material(mark.material ?? 'surface');
  context2d.fillStyle = rgba(paint.text ?? program.materials.world.text);
  context2d.font = `${style.weight} ${style.size}px system-ui`;
  context2d.textBaseline = 'top';
  const words = mark.value.split(/\s+/);
  let line = '', lineY = mark.box[1];
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context2d.measureText(next).width > mark.box[2] && line) {
      context2d.fillText(line, mark.box[0], lineY);
      line = word;
      lineY += style.size * 1.35;
    } else line = next;
  }
  if (line) context2d.fillText(line, mark.box[0], lineY);
};

const drawControl = (mark) => {
  drawSurface(mark);
  const paint = material(mark.material);
  context2d.fillStyle = rgba(paint.text);
  context2d.font = `600 13px system-ui`;
  context2d.textAlign = 'center';
  context2d.textBaseline = 'middle';
  context2d.fillText(mark.value, mark.box[0] + mark.box[2] / 2, mark.box[1] + mark.box[3] / 2, mark.box[2] - 20);
  context2d.textAlign = 'start';
};

const drawRows = (mark) => {
  const [x, y, w, h] = mark.box;
  const rowHeight = Math.min(38, h / (mark.rows.length + 1));
  context2d.font = '600 11px system-ui';
  context2d.fillStyle = rgba(program.materials.world.text);
  let columnX = x;
  for (const [field, share] of mark.columns) {
    context2d.fillText(field[0].toUpperCase() + field.slice(1), columnX + 7, y + 10);
    columnX += w * share;
  }
  context2d.font = '400 11px system-ui';
  mark.rows.forEach((row, rowIndex) => {
    const top = y + rowHeight * (rowIndex + 1);
    context2d.strokeStyle = rgba(program.materials.table.stroke);
    context2d.beginPath(); context2d.moveTo(x, top); context2d.lineTo(x + w, top); context2d.stroke();
    let cellX = x;
    for (const [field, share] of mark.columns) {
      context2d.fillText(String(row[field] ?? ''), cellX + 7, top + 10, w * share - 12);
      cellX += w * share;
    }
  });
};

const draw = () => {
  const requestedWidth = Number(width.value);
  view = observe(program, { width: requestedWidth, phase: phase.value, data });
  widthValue.textContent = String(requestedWidth);
  canvas.width = view.frame[0];
  canvas.height = view.frame[1];
  context2d.clearRect(0, 0, canvas.width, canvas.height);
  for (const mark of view.marks) {
    if (mark.op === 1 || mark.op === 4) drawSurface(mark);
    if (mark.op === 2) drawText(mark);
    if (mark.op === 3) drawControl(mark);
    if (mark.op === 5) drawRows(mark);
    if (identities.checked && mark.id !== 'world') {
      context2d.strokeStyle = 'rgba(116,74,218,.55)';
      context2d.strokeRect(...mark.box);
      context2d.fillStyle = 'rgba(116,74,218,.9)';
      context2d.font = '10px monospace';
      context2d.fillText(mark.id, mark.box[0] + 3, mark.box[1] + 3);
    }
  }
  status.textContent = `${view.observation.id} · ${view.context.topology} topology · ${view.marks.length} live marks`;
};

for (const input of [phase, width, identities]) input.addEventListener('input', draw);
canvas.addEventListener('click', (event) => {
  const box = canvas.getBoundingClientRect();
  const port = activate(view, (event.clientX - box.left) * canvas.width / box.width, (event.clientY - box.top) * canvas.height / box.height);
  if (port === 'file') { phase.value = 'populated'; status.textContent = 'file port activated'; draw(); }
  else if (port === 'importAction') status.textContent = 'importAction port activated — domain code receives the event';
  else if (port) status.textContent = `${port} port activated`;
});

draw();
