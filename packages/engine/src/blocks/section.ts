import { el, computed } from '@nisli/core';
import { cardBox } from '../style.js';
import { block } from './kernel.js';
import { toList, type Children } from './types.js';
import type { Status } from './status.js';

export interface SectionProps {
  title?: string;
  children: Children;
  /** An async result; the engine renders its waiting, failure and refresh. */
  status?: Status;
}

/** A titled surface. Inside another surface it draws no second card (engine rule). */
export const Section = block<SectionProps>('nisli-section', {
  surface: true,
  status: true,
  host: (ctx) => ({ display: 'flex', flexDirection: 'column', gap: ctx.metrics.space[3], ...cardBox(ctx.nested) }),
  hostParts: (ctx) => (ctx.nested ? 'card.nested' : 'card'),
  render: (props, ctx) => [
    el('h3', { style: ctx.part('text.title', () => ({ display: props.title.value ? 'block' : 'none', margin: 0, font: 'inherit' })) }, [
      computed(() => props.title.value ?? ''),
      ctx.updating,
    ]),
    ctx.failure,
    ctx.waiting(() => toList(props.children.value)),
  ],
});
