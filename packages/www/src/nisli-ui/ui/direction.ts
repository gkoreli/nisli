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
  component,
  computed,
  html,
  onMount,
  ref,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export type Direction = 'ltr' | 'rtl';

export interface DirectionState {
  direction: ReadonlySignal<Direction>;
}

type DirectionHost = HTMLElement & { __uiDirection?: DirectionState };

export type DirectionProviderProps = {
  dir?: Direction;
  direction?: Direction;
  children?: string | TemplateResult;
};

export const DirectionProvider = component<DirectionProviderProps>(
  'ui-direction-provider',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const dir = attr(props.dir, host, 'dir');
    const directionProp = attr(props.direction, host, 'direction');
    const direction = computed<Direction>(() =>
      directionProp.value === 'rtl' || directionProp.value === 'ltr'
        ? directionProp.value
        : dir.value === 'rtl'
          ? 'rtl'
          : 'ltr',
    );

    (host as DirectionHost).__uiDirection = { direction };

    const root = ref<HTMLDivElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return html`<div
      ref="${root}"
      data-slot="direction-provider"
      dir="${direction}"
      style="display:contents"
    >${props.children}</div>`;
  },
);

/** Resolve the nearest provider, matching Radix's default `ltr` direction. */
export function useDirection(host: HTMLElement): ReadonlySignal<Direction> {
  const provider = host.closest('ui-direction-provider') as DirectionHost | null;
  return provider?.__uiDirection?.direction ?? computed<Direction>(() => 'ltr');
}
