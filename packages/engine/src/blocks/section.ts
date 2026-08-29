import { component, el, computed, effect, onCleanup } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, cardStyle } from '../style.js';
import { look } from '../skin.js';
import { SurfaceContext, surfaceDepth } from './surface.js';
import { toList, type Children } from './types.js';
import { viewOf, blockSkeleton, failure, updating, type Status } from './status.js';

export interface SectionProps {
  title?: string;
  children: Children;
  /** An async result; the engine renders its waiting, failure and refresh. */
  status?: Status;
}

export const Section = component<SectionProps>('nisli-section', (props, host) => {
  const depth = surfaceDepth(host);
  SurfaceContext.provide(host, depth + 1);
  const stop = effect(() => apply(host, { display: 'flex', flexDirection: 'column', gap: metrics.space[3], ...cardStyle(depth > 0) }));
  onCleanup(stop);
  const view = computed(() => viewOf(props.status.value));
  return el('div', { style: 'display:contents' }, [
    el('h3', {
      style: computed(() => css({
        display: props.title.value ? 'block' : 'none',
        margin: 0,
        font: 'inherit',
        ...look('text.title'),
      })),
    }, [computed(() => props.title.value ?? ''), computed(() => (view.value.refreshing ? updating() : null))]),
    computed(() => (view.value.failed ? failure(view.value.failed, view.value.retry) : null)),
    computed(() => (view.value.pending ? blockSkeleton() : toList(props.children.value))),
  ]);
});
