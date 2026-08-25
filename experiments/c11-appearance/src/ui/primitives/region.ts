/**
 * region.ts — the context provider.
 *
 * DECLARES: the three context axes (density, input, theme) that every resolved
 * value inside it is a function of, plus how its own children compose
 * (layout, grow, align).
 *
 * DOES NOT DECIDE: a single value. A Region names a context; the theme owns the
 * numbers behind that name. This is also the ONLY channel through which
 * appearance can be influenced anywhere in this library — there is no size prop
 * and no class-name prop, so a caller who wants a different look must change the
 * declared MEANING or the declared CONTEXT, never a measurement.
 */

import { children, component, type ComponentAttrs, html } from '@nisli/core';
import type { Density, InputMode, LayoutKind, ThemeName } from '../../appearance/contracts.js';

/**
 * Cross-axis alignment. Not a value — a named relationship between siblings,
 * resolved by the theme's structure layer.
 */
export type Align = 'start' | 'center' | 'end' | 'between';

export interface RegionProps {
  density?: Density;
  input?: InputMode;
  theme?: ThemeName;
  layout?: LayoutKind;
  grow?: boolean;
  align?: Align;
  children?: unknown;
}

const regionAttrs = {
  density: 'string',
  input: 'string',
  theme: 'string',
  layout: 'string',
  grow: 'boolean',
  align: 'string',
} satisfies ComponentAttrs<RegionProps>;

export const Region = component<RegionProps, typeof regionAttrs>(
  'app-region',
  (props) => html`<div
    data-component="app-region"
    data-density=${props.density}
    data-input=${props.input}
    data-theme=${props.theme}
    data-layout=${props.layout}
    data-align=${props.align}
    data-grow=${props.grow}
  >${children()}</div>`,
  { attrs: regionAttrs },
);
