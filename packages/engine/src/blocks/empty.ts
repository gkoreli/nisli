import { component, el, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import type { Action } from './types.js';
import { createBusy } from './status.js';

export interface EmptyProps {
  title: string;
  hint?: string;
  action?: Action;
}

export const Empty = component<EmptyProps>('nisli-empty', (props, host) => {
  const { is: isBusy, run } = createBusy();
  apply(host, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: metrics.space[2], padding: `${metrics.space[6]}px ${metrics.space[4]}px`, textAlign: 'center' });
  return el('div', { style: 'display:contents' }, [
    el('div', { style: computed(() => css(look('text.title'))) }, props.title),
    el('div', { style: computed(() => css({ display: props.hint.value ? 'block' : 'none', maxWidth: 420, ...look('text.muted') })) }, computed(() => props.hint.value ?? '')),
    el('button', {
      type: 'button',
      'aria-busy': computed(() => (props.action.value && isBusy(props.action.value.id) ? 'true' : false)),
      disabled: computed(() => (props.action.value && isBusy(props.action.value.id) ? 'disabled' : false)),
      style: computed(() => css({ ...buttonStyle('primary'), display: props.action.value ? 'inline-flex' : 'none', marginTop: metrics.space[2], ...(props.action.value && isBusy(props.action.value.id) ? look('button.busy') : {}) })),
      on: { click: () => { const a = props.action.value; if (a) run(a.id, a.onSelect); } },
    }, computed(() => props.action.value?.label ?? '')),
  ]);
});
