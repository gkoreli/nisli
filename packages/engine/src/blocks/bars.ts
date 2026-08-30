import { el, each, computed, effect, onCleanup } from '@nisli/core';
import { truncate } from '../style.js';
import { labelColumn } from '../engine/space.js';
import { stampPlan } from '../engine/report.js';
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

/** Horizontal bars. The engine gives the labels a budgeted column — a function of the width, never of the label text (ADR 0044); a longer label truncates inside it. */
export const Bars = block<BarsProps>('nisli-bars', {
  measure: 'width',
  host: ({ metrics }) => ({ display: 'flex', flexDirection: 'column', gap: metrics.space[2], minWidth: 0 }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const items = computed(() => [...props.items.value]);
    const max = computed(() => Math.max(0, ...items.value.map((i) => i.value)));
    // The label budget: `labelChars` glyphs and a breath — intent and metrics, not the longest category name.
    const budget = metrics.layout.labelChars * metrics.charWidth + metrics.space[2];
    const column = computed(() => labelColumn(ctx.width.value, budget, metrics.layout));
    const stopStamp = effect(() => stampPlan(ctx.host, `label:${Math.round(column.value)}`));
    onCleanup(stopStamp);
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
