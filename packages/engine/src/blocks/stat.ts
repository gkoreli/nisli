import { component, el, computed, effect, onCleanup } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, cardStyle, truncate } from '../style.js';
import { look } from '../skin.js';
import { surfaceDepth } from './surface.js';
import type { Tone } from './types.js';
import { viewOf, skeleton, bone, failure, type Status } from './status.js';

export interface StatProps {
  label: string;
  value: string;
  /** A change relative to something; the tone says whether it is good news. */
  delta?: { text: string; tone: Tone };
  hint?: string;
  status?: Status;
}

export const Stat = component<StatProps>('nisli-stat', (props, host) => {
  const nested = surfaceDepth(host) > 0;
  const stop = effect(() => apply(host, { display: 'flex', flexDirection: 'column', gap: metrics.space[1], ...cardStyle(nested) }));
  onCleanup(stop);
  const view = computed(() => viewOf(props.status.value));
  return el('div', { style: 'display:contents' }, [
    el('div', { style: computed(() => css(look('text.label'))) }, props.label),
    computed(() => (view.value.failed ? failure(view.value.failed, view.value.retry) : null)),
    computed(() => (view.value.pending
      ? skeleton([bone(metrics.control.height, '60%')])
      : el('div', { style: computed(() => css({ ...truncate, ...look('text.display') })) }, props.value))),
    el('div', {
      style: computed(() => css({ display: props.delta.value ? 'block' : 'none', ...look('text.muted', `tone.${props.delta.value?.tone ?? 'neutral'}`) })),
    }, computed(() => props.delta.value?.text ?? '')),
    el('div', {
      style: computed(() => css({ display: props.hint.value ? 'block' : 'none', ...look('text.faint') })),
    }, computed(() => props.hint.value ?? '')),
  ]);
});
