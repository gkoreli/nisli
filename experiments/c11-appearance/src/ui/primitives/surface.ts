/**
 * surface.ts — a painted panel.
 *
 * DECLARES: that this box is a surface, and how its children compose.
 *
 * DOES NOT DECIDE: its own elevation. There is no `level` or `elevation` prop
 * on purpose: elevation is a function of NESTING DEPTH, which the theme reads
 * from the descendant selector chain. An author who nests a surface inside a
 * surface gets the next step automatically and cannot get it wrong, and one who
 * wants a flat inset says `flush` — a relationship to its parent, not a shadow.
 */

import { children, component, type ComponentAttrs, html } from '@nisli/core';
import type { LayoutKind } from '../../appearance/contracts.js';
import type { Align } from './region.js';

export interface SurfaceProps {
  flush?: boolean;
  layout?: LayoutKind;
  align?: Align;
  grow?: boolean;
  children?: unknown;
}

const surfaceAttrs = {
  flush: 'boolean',
  layout: 'string',
  align: 'string',
  grow: 'boolean',
} satisfies ComponentAttrs<SurfaceProps>;

export const Surface = component<SurfaceProps, typeof surfaceAttrs>(
  'app-surface',
  (props) => html`<div
    data-component="app-surface"
    data-appearance="surface"
    data-layout=${props.layout}
    data-align=${props.align}
    data-flush=${props.flush}
    data-grow=${props.grow}
  >${children()}</div>`,
  { attrs: surfaceAttrs },
);
