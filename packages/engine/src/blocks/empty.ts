import { el, computed } from '@nisli/core';
import { buttonBox } from '../style.js';
import { block } from './kernel.js';
import type { Action } from './types.js';

export interface EmptyProps {
  title: string;
  hint?: string;
  action?: Action;
}

export const Empty = block<EmptyProps>('nisli-empty', {
  host: ({ metrics }) => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: metrics.space[2], padding: `${metrics.space[6]}px ${metrics.space[4]}px`, textAlign: 'center' }),
  render: (props, ctx) => {
    const { busy, metrics } = ctx;
    const isBusy = () => { const a = props.action.value; return !!a && busy.is(a.id); };
    return [
      el('div', { style: ctx.part('text.title') }, props.title),
      el('div', { style: ctx.part('text.muted', () => ({ display: props.hint.value ? 'block' : 'none', maxWidth: 420 })) }, computed(() => props.hint.value ?? '')),
      el('button', {
        type: 'button',
        'aria-busy': computed(() => (isBusy() ? 'true' : false)),
        disabled: computed(() => (isBusy() ? 'disabled' : false)),
        style: ctx.part(
          () => ['button', 'button.primary', ...(isBusy() ? ['button.busy' as const] : [])],
          () => ({ ...buttonBox(), display: props.action.value ? 'inline-flex' : 'none', marginTop: metrics.space[2] }),
        ),
        on: { click: () => { const a = props.action.value; if (a) busy.run(a.id, a.onSelect); } },
      }, computed(() => props.action.value?.label ?? '')),
    ];
  },
});
