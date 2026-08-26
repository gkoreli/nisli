/**
 * states.ts — the one rendering every declared state that has no content uses:
 * content on its way, content that will not arrive, and no content at all.
 *
 * This is a page-level COMPOSITION, not a new component. It introduces no
 * attribute, no value and no strategy: a surface, some semantic text, and
 * whatever action the calling page decides is the way out. Every page that
 * declares `loading`, `error` or `empty` in `state.ts` renders through here, so
 * the state sweep measures one code path per state rather than four accidental
 * ones.
 *
 * TWO THINGS THE VOCABULARY CANNOT SAY, recorded here rather than invented as
 * attributes, because inventing them is the failure mode this experiment is
 * supposed to catch:
 *
 *  1. THERE IS NO WAY TO DECLARE "THIS IS A PLACEHOLDER FOR CONTENT THAT HAS
 *     NOT ARRIVED." No skeleton, no busy state, no indeterminate progress.
 *     `data-appearance` enumerates what a thing IS — action, avatar, field,
 *     nav-item, table, surface — and a placeholder is not on that list. So the
 *     loading state below is a SENTENCE, which is an honest answer but is a
 *     design decision this file made, not a value the table derived. Everything
 *     else on screen in this app resolves from a declaration; this does not.
 *
 *  2. TEXT CANNOT DECLARE EMPHASIS. `data-role` is the emphasis axis, and
 *     `theme/roles.css` resolves it only under `[data-appearance='action']` —
 *     `[data-appearance='action'][data-role='danger']` and its three siblings.
 *     `data-text` has five levels and no tone, so an error MESSAGE cannot say
 *     that it is an error. The only element in the error panel that can carry a
 *     tone is its button, and the way out of a failed load is a retry, which is
 *     neither primary-as-in-suggested nor destructive — so declaring `danger`
 *     there to buy a red would be styling by proxy. The failed panel therefore
 *     renders identically to the empty one, which is a real appearance defect
 *     that no rule in the checker can currently see: structurally identical,
 *     semantically opposite.
 *
 * The live-region role is authored rather than derived, for the same reason
 * `data-table.ts` authors `tabindex="0"`: it is semantics, not appearance. A
 * placeholder that never announces itself and an error that never interrupts
 * are the same silent-loss class as a clipped column, one layer up. `empty`
 * gets no live region at all — nothing has happened, and interrupting a screen
 * reader to say a list is a list would be worse than silence.
 */

import { html, type TemplateResult } from '@nisli/core';
import { Surface, Text } from '../../ui/index.js';

/** The three contentless states, and the only axis on which they differ. */
export const LIVE_REGION = {
  loading: 'status',
  error: 'alert',
  empty: undefined,
} as const satisfies Record<string, string | undefined>;

export type StatePanelKind = keyof typeof LIVE_REGION;

export interface StatePanelProps {
  readonly kind: StatePanelKind;
  /** The headline. An atomic label, so it is never truncated to nothing. */
  readonly headline: string;
  /** One sentence saying what happened, in prose, which may ellipsise. */
  readonly what: string;
  /** The way out, supplied by the page because only the page knows one. */
  readonly action?: unknown;
}

export function StatePanel(props: StatePanelProps): TemplateResult {
  return Surface({
    layout: 'stack',
    children: html`<div role=${LIVE_REGION[props.kind]} data-layout="stack">
      ${Text({ as: 'title', children: props.headline })}
      ${Text({ as: 'body', children: props.what })}
      ${props.action ?? ''}
    </div>`,
  });
}
