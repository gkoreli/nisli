import { el, computed } from '@nisli/core';
import { block } from './kernel.js';
import { actionRow } from './actions.js';
import type { Action } from './types.js';

export interface EmptyProps {
  /** The statement: "No banks connected". */
  title: string;
  /** Secondary text of the state: what to do about it. */
  hint?: string;
  /** What a person may do from here. The engine places them; the same rule as every other row. */
  actions?: readonly Action[];
}

export const Empty = block<EmptyProps>('nisli-empty', {
  host: ({ metrics }) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: metrics.space[2], padding: `${metrics.space[6]}px ${metrics.space[4]}px`, textAlign: 'center' }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const actions = computed(() => [...(props.actions.value ?? [])]);
    return [
      el('div', { style: ctx.part('text.title') }, props.title),
      el('div', { style: ctx.part('text.muted', () => ({ display: props.hint.value ? 'block' : 'none', maxWidth: 420 })) }, computed(() => props.hint.value ?? '')),
      actionRow(ctx, actions, { justify: 'center', structure: () => ({ marginTop: metrics.space[2] }) }),
    ];
  },
});
