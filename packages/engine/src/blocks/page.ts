import { el, computed } from '@nisli/core';
import { block } from './kernel.js';
import { Toolbar } from './toolbar.js';
import { toList, type Action, type Children } from './types.js';
import type { Status } from './status.js';

export interface PageProps {
  title: string;
  actions?: readonly Action[];
  children: Children;
  status?: Status;
}

/** A routed screen: a pinned toolbar and a content column the engine sizes. */
export const Page = block<PageProps>('nisli-page', {
  status: true,
  host: () => ({ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }),
  render: (props, ctx) => {
    const { metrics } = ctx;
    const updating = ctx.updating;
    // Read eagerly: the content computed is lazy, and an unread prop is diagnosed (N202).
    props.children.value;
    return [
      el('div', { style: ctx.part([], { position: 'sticky', top: 0, zIndex: 15 }) }, [
        Toolbar({
          title: computed(() => (updating.value ? `${props.title.value} · Updating…` : props.title.value)),
          actions: computed(() => props.actions.value ?? []),
        }),
      ]),
      el('div', {
        style: ctx.part([], {
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
        ctx.failure,
        ctx.waiting(() => toList(props.children.value)),
      ]),
    ];
  },
});
