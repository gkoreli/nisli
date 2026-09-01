import { computed, effect, onCleanup } from '@nisli/core';
import { columnsFor, cellFloor } from '../engine/space.js';
import { reportIf, stampPlan } from '../engine/report.js';
import { block } from './kernel.js';
import { toList, type Children } from './types.js';

export interface GridProps {
  children: Children;
}

/** Cells of equal weight. The engine chooses how many sit side by side; a cell is never narrower than `cellFloor` — what a card holding the narrowest table needs. */
export const Grid = block<GridProps>('nisli-grid', {
  measure: 'width',
  host: (ctx) => {
    const gap = ctx.metrics.space[4];
    const n = columnsFor(ctx.width.value, toList(ctx.props.children.value).length, cellFloor(ctx.metrics.layout, ctx.metrics.charWidth, ctx.metrics.space), gap);
    return { display: 'grid', gap, minWidth: 0, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  },
  render: (props, ctx) => {
    const count = computed(() => toList(props.children.value).length);
    const stop = effect(() => {
      const width = ctx.width.value;
      const min = cellFloor(ctx.metrics.layout, ctx.metrics.charWidth, ctx.metrics.space);
      if (width > 0 && count.value > 0) {
        reportIf({ slack: width - min }, { code: 'FIT_CELL', block: 'nisli-grid', width, detail: 'a single column is narrower than the minimum cell' }, ctx.host);
      }
      stampPlan(ctx.host, `columns:${columnsFor(width, count.value, min, ctx.metrics.space[4])}`);
    });
    onCleanup(stop);
    return computed(() => toList(props.children.value));
  },
});
