import { el, computed } from '@nisli/core';
import { truncate } from '../style.js';
import { block } from './kernel.js';

export interface MeterProps {
  label: string;
  value: number;
  max: number;
  /** Text beside the label — e.g. "€420 of €500". */
  detail?: string;
}

/** A filled bar. The engine tones it by how close to the limit it is. */
export const Meter = block<MeterProps>('nisli-meter', {
  host: ({ metrics }) => ({ display: 'flex', flexDirection: 'column', gap: metrics.space[1], minWidth: 0 }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const ratio = computed(() => (props.max.value > 0 ? props.value.value / props.max.value : 0));
    // The block's taste: past the limit is negative, within 15% of it is a warning.
    const tone = computed<'negative' | 'warning' | 'neutral'>(() => (ratio.value > 1 ? 'negative' : ratio.value > 0.85 ? 'warning' : 'neutral'));
    return [
      el('div', { style: ctx.part([], { display: 'flex', justifyContent: 'space-between', gap: metrics.space[3], minWidth: 0 }) }, [
        el('span', { style: ctx.part('text', truncate) }, props.label),
        el('span', {
          style: ctx.part(() => (tone.value === 'negative' ? 'tone.negative' : 'tone.neutral'), { whiteSpace: 'nowrap', flex: 'none', fontVariantNumeric: 'tabular-nums' }),
        }, computed(() => props.detail.value ?? '')),
      ]),
      el('div', {
        role: 'meter',
        'aria-label': props.label,
        'aria-valuenow': computed(() => String(props.value.value)),
        'aria-valuemin': '0',
        'aria-valuemax': computed(() => String(props.max.value)),
        style: ctx.part('meter.track', { height: 8, overflow: 'hidden' }),
      }, [
        el('div', {
          style: ctx.part(
            () => ['meter.fill', ...(tone.value === 'neutral' ? [] : [`meter.fill.${tone.value}` as const])],
            () => ({ height: '100%', width: `${Math.min(100, ratio.value * 100)}%`, transition: 'width 200ms' }),
          ),
        }),
      ]),
    ];
  },
});
