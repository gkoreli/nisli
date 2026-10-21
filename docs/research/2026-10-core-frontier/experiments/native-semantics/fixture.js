import { each, flush, html, setDevMode, signal } from '../../../../../packages/core/src/index.ts';

setDevMode(false);

window.runNativeProbe = () => {
  const checks = [];
  const check = (name, actual, expected) => checks.push({ name, actual, expected, pass: Object.is(actual, expected) });
  const roots = [];
  const results = [];
  const mount = (tag, render) => {
    const root = document.createElement(tag);
    document.body.append(root);
    roots.push(root);
    const items = signal([1]);
    const result = each(items, x => x, render);
    result.mount(root);
    results.push(result);
    return root;
  };

  const nativeList = document.createElement('ul');
  nativeList.innerHTML = '<li>one</li>';
  const list = mount('ul', () => html`<li>one</li>`);
  check('ul direct li count equals native control', list.querySelectorAll(':scope > li').length, nativeList.querySelectorAll(':scope > li').length);

  const nativeSelect = document.createElement('select');
  nativeSelect.innerHTML = '<option value="one">one</option>';
  const select = mount('select', () => html`<option value="one">one</option>`);
  check('select options length equals native control', select.options.length, nativeSelect.options.length);
  check('select value equals native control', select.value, nativeSelect.value);

  const nativeTable = document.createElement('table');
  nativeTable.innerHTML = '<tbody><tr><td>one</td></tr></tbody>';
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.append(tbody);
  document.body.append(table);
  roots.push(table);
  const rows = signal([1]);
  const rowResult = each(rows, x => x, () => html`<tr><td>one</td></tr>`);
  rowResult.mount(tbody);
  results.push(rowResult);
  check('table rows length equals native control', table.rows.length, nativeTable.rows.length);

  const nativeFieldset = document.createElement('fieldset');
  nativeFieldset.disabled = true;
  nativeFieldset.innerHTML = '<legend><input value="editable legend"></legend>';
  document.body.append(nativeFieldset);
  roots.push(nativeFieldset);
  const fieldset = mount('fieldset', () => html`<legend><input value="editable legend"></legend>`);
  fieldset.disabled = true;
  check('first legend input disabled state equals native control', fieldset.querySelector('input').matches(':disabled'), nativeFieldset.querySelector('input').matches(':disabled'));

  const reorder = (direction) => {
    const items = signal(Array.from({ length: 100 }, (_, i) => i));
    const root = document.createElement('div');
    document.body.append(root);
    const result = each(items, x => x, item => html`<span>${item}</span>`);
    result.mount(root);
    let moves = 0;
    const insert = root.insertBefore.bind(root);
    root.insertBefore = (...args) => { moves++; return insert(...args); };
    if (root.moveBefore) {
      const move = root.moveBefore.bind(root);
      root.moveBefore = (...args) => { moves++; return move(...args); };
    }
    const before = items.value;
    const after = direction === 'left' ? [...before.slice(1), before[0]] : [before.at(-1), ...before.slice(0, -1)];
    items.value = after;
    flush();
    check(`${direction} rotation preserves displayed order`, [...root.querySelectorAll('span')].map(x => Number(x.textContent)).join(','), after.join(','));
    check(`${direction} rotation uses the one-move optimum`, moves, 1);
    result.dispose();
    root.remove();
    return moves;
  };
  const moves = { left: reorder('left'), right: reorder('right') };
  const markup = { list: list.innerHTML, select: select.innerHTML, table: table.innerHTML, fieldset: fieldset.innerHTML };
  for (const result of results) result.dispose();
  for (const root of roots) root.remove();
  return { moveBefore: typeof Element.prototype.moveBefore === 'function', moves, markup, checks };
};
