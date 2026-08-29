import { component, el, computed } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply } from '../style.js';
import { Toolbar } from './toolbar.js';
import { toList, type Action, type Children } from './types.js';
import { viewOf, blockSkeleton, failure, type Status } from './status.js';

export interface PageProps {
  title: string;
  actions?: readonly Action[];
  children: Children;
  status?: Status;
}

/** A routed screen: a pinned toolbar and a content column the engine sizes. */
export const Page = component<PageProps>('nisli-page', (props, host) => {
  apply(host, { display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 });
  const view = computed(() => viewOf(props.status.value));
  // Read eagerly: the content computed is lazy, and an unread prop is diagnosed (N202).
  props.children.value;
  return el('div', { style: 'display:contents' }, [
    el('div', { style: css({ position: 'sticky', top: 0, zIndex: 15 }) }, [
      Toolbar({ title: computed(() => (view.value.refreshing ? `${props.title.value} · Updating…` : props.title.value)), actions: computed(() => props.actions.value ?? []) }),
    ]),
    el('div', {
      style: css({
        display: 'flex',
        flexDirection: 'column',
        gap: metrics.space[5],
        padding: metrics.space[4],
        width: '100%',
        maxWidth: metrics.layout.contentMax,
        margin: '0 auto',
        boxSizing: 'border-box',
        minWidth: 0,
      }),
    }, [
      computed(() => (view.value.failed ? failure(view.value.failed, view.value.retry) : null)),
      computed(() => (view.value.pending ? blockSkeleton() : toList(props.children.value))),
    ]),
  ]);
});
