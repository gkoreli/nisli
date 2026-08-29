import { component, el, computed, effect, onCleanup } from '@nisli/core';
import { metrics } from '../metrics.js';
import { apply } from '../style.js';
import { useWidth } from '../engine/measure.js';
import { columnsFor } from '../engine/columns.js';
import { report } from '../engine/report.js';
import { toList, type Children } from './types.js';

export interface GridProps {
  children: Children;
}

/** Cells of equal weight. The engine chooses how many sit side by side. */
export const Grid = component<GridProps>('nisli-grid', (props, host) => {
  const width = useWidth(host);
  const gap = metrics.space[4];
  apply(host, { display: 'grid', gap, minWidth: 0 });
  const stop = effect(() => {
    const count = toList(props.children.value).length;
    const n = columnsFor(width.value, count, metrics.layout.minColumn, gap);
    apply(host, { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });
    if (width.value > 0 && count > 0 && width.value < metrics.layout.minColumn) {
      report({ code: 'FIT_CELL', block: 'nisli-grid', width: width.value, deficit: metrics.layout.minColumn - width.value, detail: 'a single column is narrower than the minimum cell' });
    }
  });
  onCleanup(stop);
  return el('div', { style: 'display:contents' }, computed(() => toList(props.children.value)));
});
