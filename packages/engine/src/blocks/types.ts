import type { TemplateResult } from '@nisli/core';

/** Anything a block can hold: another block, or a core template. */
export type Content = TemplateResult | { __type: 'factory' };
export type Children = Content | readonly Content[];

/** What an action *is*. Nothing about how it looks. */
export interface Action {
  readonly id: string;
  readonly label: string;
  /** primary survives longest; tertiary is the first into an overflow menu. */
  readonly priority?: 'primary' | 'secondary' | 'tertiary';
  /** A destructive action. The engine renders it accordingly and never as primary. */
  readonly destructive?: boolean;
  /** May return a promise; the engine shows the action busy until it settles. */
  readonly onSelect?: () => void | Promise<unknown>;
}

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning';

export const toList = (c: Children | undefined): Content[] =>
  c === undefined ? [] : Array.isArray(c) ? [...(c as Content[])] : [c as Content];
