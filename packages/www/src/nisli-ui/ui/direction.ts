/**
 * ui/direction.ts — Direction provider.
 *
 * Ported from shadcn/ui `new-york-v4/ui/direction.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as a Nisli host-state provider. The
 * provider keeps Radix's `direction ?? dir` precedence and publishes the
 * resolved direction on its host for descendant components.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  computed,
  createContext,
  html,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { transparentHost } from '../lib/utils.js';

export type Direction = 'ltr' | 'rtl';

export interface DirectionState {
  direction: ReadonlySignal<Direction>;
}

/** Subtree-scoped channel from the direction provider to descendants. */
const DirectionContext = createContext<DirectionState>('Direction', { providerTag: 'ui-direction-provider' });

export type DirectionProviderProps = {
  dir?: Direction;
  direction?: Direction;
  children?: string | TemplateResult;
};

export const DirectionProvider = component<DirectionProviderProps>(
  'ui-direction-provider',
  (props, host) => {
    transparentHost(host);

    // ADR 0025 item 3: attribute fallbacks (`dir`/`direction`) are declared via
    // the `attrs` option below and delivered as plain, LIVE prop signals.
    const dir = props.dir;
    const directionProp = props.direction;
    const direction = computed<Direction>(() =>
      directionProp.value === 'rtl' || directionProp.value === 'ltr'
        ? directionProp.value
        : dir.value === 'rtl'
          ? 'rtl'
          : 'ltr',
    );

    DirectionContext.provide(host, { direction });

    // ADR 0025 item 1: children() owns projection — light-DOM children AND the
    // factory `children` prop route through the one slot.
    return html`<div
      data-slot="direction-provider"
      dir="${direction}"
      style="display:contents"
    >${children()}</div>`;
  },
  {
    // ADR 0025 item 3: opt-in attribute reactivity. Kebab-case attr names.
    attrs: {
      dir: 'string',
      direction: 'string',
    },
  },
);

/** Resolve the nearest provider, matching Radix's default `ltr` direction. */
export function useDirection(host: HTMLElement): ReadonlySignal<Direction> {
  return DirectionContext.inject.optional(host)?.direction ?? computed<Direction>(() => 'ltr');
}
