import { el, computed } from '@nisli/core';
import { truncate, cardBox, cardPart } from '../style.js';
import { block } from './kernel.js';
import type { Delta } from './types.js';
import type { Status } from './status.js';

export interface StatProps {
  label: string;
  value: string;
  /** A change relative to something. */
  delta?: Delta;
  hint?: string;
  status?: Status;
}

export const Stat = block<StatProps>('nisli-stat', {
  status: { skeleton: (ctx) => ctx.skeleton([ctx.bone(ctx.metrics.control.height, '60%')]) },
  host: (ctx) => ({ display: 'flex', flexDirection: 'column', gap: ctx.metrics.space[1], ...cardBox(ctx.nested) }),
  hostParts: (ctx) => cardPart(ctx.nested),
  render: (props, ctx) => {
    return [
      el('div', { style: ctx.part('text.label') }, props.label),
      ctx.failure,
      ctx.waiting(() => el('div', { style: ctx.part('text.display', () => truncate) }, props.value)),
      el('div', {
        style: ctx.part(() => ['text.muted', `tone.${props.delta.value?.tone ?? 'neutral'}` as const], () => ({ display: props.delta.value ? 'block' : 'none' })),
      }, computed(() => props.delta.value?.text ?? '')),
      el('div', {
        style: ctx.part('text.faint', () => ({ display: props.hint.value ? 'block' : 'none' })),
      }, computed(() => props.hint.value ?? '')),
    ];
  },
});
