import { el, each, computed } from '@nisli/core';
import { truncate } from '../style.js';
import { labelColumn, labelWidth } from '../engine/space.js';
import { block } from './kernel.js';

export interface BarItem {
  readonly label: string;
  readonly value: number;
  /** Text for the value — the app knows its own units. */
  readonly text: string;
}

export interface BarsProps {
  items: readonly BarItem[];
}

/** Horizontal bars. The engine sizes the label column to what fits. */
export const Bars = block<BarsProps>('nisli-bars', {
  measure: 'width',
  host: ({ metrics }) => ({ display: 'flex', flexDirection: 'column', gap: metrics.space[2], minWidth: 0 }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const items = computed(() => [...props.items.value]);
    const max = computed(() => Math.max(0, ...items.value.map((i) => i.value)));
    const longest = computed(() => Math.max(metrics.space[2], ...items.value.map((i) => labelWidth(i.label, metrics.space[2], metrics.charWidth))));
    const column = computed(() => labelColumn(ctx.width.value, longest.value, metrics.layout));
    return [
      each(items, (i) => i.label, (item) =>
        el('div', { style: ctx.part([], { display: 'flex', alignItems: 'center', gap: metrics.space[3], minWidth: 0 }) }, [
          el('span', { style: ctx.part('text.muted', () => ({ width: column.value, flex: 'none', ...truncate })) }, computed(() => item.value.label)),
          el('div', { style: ctx.part('meter.track', { flex: '1 1 0', minWidth: 0, height: 14, overflow: 'hidden' }) }, [
            el('div', { style: ctx.part('meter.fill', () => ({ height: '100%', width: `${max.value > 0 ? (item.value.value / max.value) * 100 : 0}%` })) }),
          ]),
          el('span', { style: ctx.part('text.muted', { flex: 'none', minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }) }, computed(() => item.value.text)),
        ]),
      ),
    ];
  },
});
