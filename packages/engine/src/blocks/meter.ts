import { component, el, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, truncate } from '../style.js';
import { look } from '../skin.js';

export interface MeterProps {
  label: string;
  value: number;
  max: number;
  /** Text beside the label — e.g. "€420 of €500". */
  detail?: string;
}

/** A filled bar. The engine tones it by how close to the limit it is. */
export const Meter = component<MeterProps>('nisli-meter', (props, host) => {
  apply(host, { display: 'flex', flexDirection: 'column', gap: metrics.space[1], minWidth: 0 });
  const ratio = computed(() => (props.max.value > 0 ? props.value.value / props.max.value : 0));
  const tone = computed<'negative' | 'warning' | 'neutral'>(() => (ratio.value > 1 ? 'negative' : ratio.value > 0.85 ? 'warning' : 'neutral'));
  return el('div', { style: 'display:contents' }, [
    el('div', { style: css({ display: 'flex', justifyContent: 'space-between', gap: metrics.space[3], minWidth: 0 }) }, [
      el('span', { style: computed(() => css({ ...truncate, ...look('text') })) }, props.label),
      el('span', { style: computed(() => css({ whiteSpace: 'nowrap', flex: 'none', fontVariantNumeric: 'tabular-nums', ...look(tone.value === 'negative' ? 'tone.negative' : 'tone.neutral') })) }, computed(() => props.detail.value ?? '')),
    ]),
    el('div', {
      role: 'meter',
      'aria-label': props.label,
      'aria-valuenow': computed(() => String(props.value.value)),
      'aria-valuemin': '0',
      'aria-valuemax': computed(() => String(props.max.value)),
      style: computed(() => css({ height: 8, overflow: 'hidden', ...look('meter.track') })),
    }, [
      el('div', { style: computed(() => css({ height: '100%', width: `${Math.min(100, ratio.value * 100)}%`, transition: 'width 200ms', ...look('meter.fill', ...(tone.value === 'neutral' ? [] : [`meter.fill.${tone.value}` as const])) })) }),
    ]),
  ]);
});
