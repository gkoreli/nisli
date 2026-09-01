import { el, each, computed, effect, onCleanup } from '@nisli/core';
import { truncate } from '../style.js';
import { labelEvery } from '../engine/space.js';
import { stampPlan } from '../engine/report.js';
import { block } from './kernel.js';
import type { Tone } from './types.js';

export interface Series {
  readonly label: string;
  readonly tone?: Tone;
  readonly values: readonly number[];
}

export interface ColumnsProps {
  /** One label per x position (e.g. months). */
  labels: readonly string[];
  series: readonly Series[];
  /** A value's text — the app knows its units. */
  format: (value: number) => string;
}

const HEIGHT = 160;
/** The slot one position is given before the block is measured. */
const UNMEASURED_SLOT = 48;

const barParts = (tone: Tone | undefined) => ['chart.bar' as const, ...(tone && tone !== 'neutral' ? [`chart.bar.${tone}` as const] : [])];

/**
 * Grouped vertical bars over an ordered axis. The engine sizes bars to the
 * width and thins the axis labels until they fit; the app supplies numbers.
 */
export const Columns = block<ColumnsProps>('nisli-columns', {
  measure: 'width',
  host: () => ({ display: 'block', minWidth: 0 }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const labels = computed(() => [...props.labels.value]);
    const series = computed(() => [...props.series.value]);
    const max = computed(() => Math.max(1, ...series.value.flatMap((s) => s.values)));
    const slot = computed(() => (ctx.width.value > 0 ? ctx.width.value / Math.max(1, labels.value.length) : UNMEASURED_SLOT));
    // The axis label budget: `axisChars` glyphs and a breath. One label is one slot — the count is chart
    // structure and may decide; the label *text* may not (ADR 0044): "September" and "May" skip the same.
    // Read inside the computed: the breath follows the density axis (ADR 0046 §4).
    const every = computed(() => labelEvery(slot.value, metrics.layout.axisChars * metrics.charWidth + metrics.space[2]));
    const stopStamp = effect(() => stampPlan(ctx.host, `every:${every.value}`));
    onCleanup(stopStamp);
    const groups = computed(() => labels.value.map((label, i) => ({ label, i, values: series.value.map((s) => ({ v: s.values[i] ?? 0, tone: s.tone, label: s.label })) })));

    return [
      el('div', { style: ctx.part([], () => ({ display: 'flex', gap: metrics.space[3], marginBottom: metrics.space[2], flexWrap: 'wrap' })) },
        series.value.map((s) => el('span', { style: ctx.part('text.muted', () => ({ display: 'inline-flex', alignItems: 'center', gap: metrics.space[1] })) }, [
          el('i', { style: ctx.part(barParts(s.tone), () => ({ display: 'inline-block', width: 10, height: 10 })) }),
          s.label,
        ])),
      ),
      el('div', {
        role: 'img',
        'aria-label': computed(() => `${series.value.map((s) => s.label).join(' and ')} by ${labels.value.length} periods`),
        style: ctx.part([], () => ({ display: 'flex', alignItems: 'flex-end', height: HEIGHT, gap: 2 })),
      }, [
        each(groups, (g) => g.label, (g) =>
          el('div', {
            title: computed(() => g.value.values.map((x) => `${x.label}: ${props.format.value(x.v)}`).join('\n')),
            style: ctx.part([], () => ({ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' })),
          },
            computed(() => g.value.values.map((x) => el('div', {
              style: ctx.part(barParts(x.tone), () => ({ flex: '1 1 0', minWidth: 0, height: `${(x.v / max.value) * 100}%` })),
            }))),
          ),
        ),
      ]),
      el('div', { style: ctx.part([], () => ({ display: 'flex', gap: 2, marginTop: metrics.space[1] })) }, [
        each(groups, (g) => g.label, (g) =>
          el('span', {
            style: ctx.part('chart.axis', () => ({ flex: '1 1 0', minWidth: 0, textAlign: 'center', ...truncate, visibility: g.value.i % every.value === 0 ? 'visible' : 'hidden' })),
          }, computed(() => g.value.label)),
        ),
      ]),
    ];
  },
});
