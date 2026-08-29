import { component, el, each, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, truncate } from '../style.js';
import { look } from '../skin.js';
import { useWidth } from '../engine/measure.js';

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
export const Bars = component<BarsProps>('nisli-bars', (props, host) => {
  const width = useWidth(host);
  apply(host, { display: 'flex', flexDirection: 'column', gap: metrics.space[2], minWidth: 0 });
  const items = computed(() => [...props.items.value]);
  const max = computed(() => Math.max(0, ...items.value.map((i) => i.value)));
  const longest = computed(() => Math.max(0, ...items.value.map((i) => i.label.length)) * metrics.charWidth + metrics.space[2]);
  // The label column takes what it wants up to a third of the block.
  const labelWidth = computed(() => (width.value === 0 ? longest.value : Math.min(longest.value, Math.max(64, width.value / 3))));
  return el('div', { style: 'display:contents' }, [
    each(items, (i) => i.label, (item) =>
      el('div', { style: css({ display: 'flex', alignItems: 'center', gap: metrics.space[3], minWidth: 0 }) }, [
        el('span', { style: computed(() => css({ width: labelWidth.value, flex: 'none', ...truncate, ...look('text.muted') })) }, computed(() => item.value.label)),
        el('div', { style: computed(() => css({ flex: '1 1 0', minWidth: 0, height: 14, overflow: 'hidden', ...look('meter.track') })) }, [
          el('div', { style: computed(() => css({ height: '100%', width: `${max.value > 0 ? (item.value.value / max.value) * 100 : 0}%`, ...look('meter.fill') })) }),
        ]),
        el('span', { style: computed(() => css({ flex: 'none', minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...look('text.muted') })) }, computed(() => item.value.text)),
      ]),
    ),
  ]);
});
