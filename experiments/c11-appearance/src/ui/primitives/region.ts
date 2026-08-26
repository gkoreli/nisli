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
 *
 * WHAT `end` MEANS DEPENDS ON THE LAYOUT, and that is the point of naming a
 * relationship instead of a side: in a `row` the cross axis is the block axis,
 * so `end` is "sit on the last line of the thing beside you"; in a `stack` it
 * is the inline axis, so `end` is "hug the trailing edge instead of stretching
 * to my width". One declaration, two resolutions, both derived from the layout
 * the container already declared.
 */
export type Align = 'start' | 'center' | 'end' | 'between';

/**
 * What to do with overhang this container considers decoration.
 *
 * One value, because there is only one question an author can answer that the
 * engine cannot: whether the content past the edge carries meaning. Nothing
 * measurable separates a decorative strip from a table — both are simply wider
 * than their box — so the theme derives a reachable scroll region for a
 * clipping surface by DEFAULT and `trim` is how an author declines it. Saying
 * `trim` is a claim, and the checker holds the author to it: N710 stops
 * reporting clipped loss here, which is only honest if the overhang really is
 * duplicated or announced somewhere else.
 */
export type Clip = 'trim';

export interface RegionProps {
  density?: Density;
  input?: InputMode;
  theme?: ThemeName;
  layout?: LayoutKind;
  grow?: boolean;
  align?: Align;
  clip?: Clip;
  children?: unknown;
}

const regionAttrs = {
  density: 'string',
  input: 'string',
  theme: 'string',
  layout: 'string',
  grow: 'boolean',
  align: 'string',
  clip: 'string',
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
    data-clip=${props.clip}
    data-grow=${props.grow}
  >${children()}</div>`,
  { attrs: regionAttrs },
);
