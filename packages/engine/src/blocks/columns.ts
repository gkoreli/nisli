import { component, el, each, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, truncate } from '../style.js';
import { look } from '../skin.js';
import { useWidth } from '../engine/measure.js';
import type { Tone } from './types.js';

export interface Series {
  readonly name: string;
  readonly tone?: Tone;
  readonly values: readonly number[];
}

export interface ColumnsProps {
  /** One label per x position (e.g. months). */
  labels: readonly string[];
  series: readonly Series[];
  /** Text for a value — the app knows its units. */
  text: (value: number) => string;
}

/**
 * Grouped vertical bars over an ordered axis. The engine sizes bars to the
 * width and thins the axis labels until they fit; the app supplies numbers.
 */
export const Columns = component<ColumnsProps>('nisli-columns', (props, host) => {
  const width = useWidth(host);
  const HEIGHT = 160;
  apply(host, { display: 'block', minWidth: 0 });
  const labels = computed(() => [...props.labels.value]);
  const series = computed(() => [...props.series.value]);
  const max = computed(() => Math.max(1, ...series.value.flatMap((s) => s.values)));
  const slot = computed(() => (width.value > 0 ? width.value / Math.max(1, labels.value.length) : 48));
  // Show every nth label so none overlap: a label needs its own text width.
  const labelEvery = computed(() => {
    const need = Math.max(0, ...labels.value.map((l) => l.length)) * metrics.charWidth + metrics.space[2];
    return Math.max(1, Math.ceil(need / slot.value));
  });
  const groups = computed(() => labels.value.map((label, i) => ({ label, i, values: series.value.map((s) => ({ v: s.values[i] ?? 0, tone: s.tone, name: s.name })) })));

  return el('div', { style: 'display:contents' }, [
    el('div', { style: css({ display: 'flex', gap: metrics.space[3], marginBottom: metrics.space[2], flexWrap: 'wrap' }) },
      series.value.map((s) => el('span', { style: computed(() => css({ display: 'inline-flex', alignItems: 'center', gap: metrics.space[1], ...look('text.muted') })) }, [
        el('i', { style: computed(() => css({ display: 'inline-block', width: 10, height: 10, ...look('chart.bar', ...(s.tone && s.tone !== 'neutral' ? [`chart.bar.${s.tone}` as const] : [])) })) }),
        s.name,
      ])),
    ),
    el('div', { role: 'img', 'aria-label': computed(() => `${series.value.map((s) => s.name).join(' and ')} by ${labels.value.length} periods`), style: css({ display: 'flex', alignItems: 'flex-end', height: HEIGHT, gap: 2 }) }, [
      each(groups, (g) => g.label, (g) =>
        el('div', { title: computed(() => g.value.values.map((x) => `${x.name}: ${props.text.value(x.v)}`).join('\n')), style: css({ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }) },
          computed(() => g.value.values.map((x) => el('div', {
            style: css({ flex: '1 1 0', minWidth: 0, height: `${(x.v / max.value) * 100}%`, ...look('chart.bar', ...(x.tone && x.tone !== 'neutral' ? [`chart.bar.${x.tone}` as const] : [])) }),
          }))),
        ),
      ),
    ]),
    el('div', { style: css({ display: 'flex', gap: 2, marginTop: metrics.space[1] }) }, [
      each(groups, (g) => g.label, (g) =>
        el('span', { style: computed(() => css({ flex: '1 1 0', minWidth: 0, textAlign: 'center', ...truncate, visibility: g.value.i % labelEvery.value === 0 ? 'visible' : 'hidden', ...look('chart.axis') })) }, computed(() => g.value.label)),
      ),
    ]),
  ]);
});
