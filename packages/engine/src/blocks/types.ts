import type { TemplateResult } from '@nisli/core';

/** Anything a block can hold: another block, or a core template. */
export type Content = TemplateResult | { __type: 'factory' };
export type Children = Content | readonly Content[];

/**
 * What a value *is* — never how it is captured or shown. A Field takes any of
 * these; a Column takes the four a cell can hold.
 */
export type Kind = 'text' | 'number' | 'money' | 'date' | 'boolean' | 'file';

/**
 * Survival order, and only that: a primary never leaves a row, a tertiary
 * leaves first. Default `'secondary'` everywhere. That the primary is the
 * filled button, and that dropped columns fold under the first primary text
 * column, are the engine's rules — not second meanings of the word.
 */
export type Priority = 'primary' | 'secondary' | 'tertiary';

/** What an action *is*. Nothing about how it looks. */
export interface Action {
  readonly id: string;
  readonly label: string;
  readonly priority?: Priority;
  /** Cannot be undone. The engine renders it as danger and asks nothing further. */
  readonly destructive?: boolean;
  /** May return a promise; the engine shows the action busy until it settles. */
  readonly onSelect?: () => void | Promise<unknown>;
}

/** Whether a number is good news. */
export type Tone = 'neutral' | 'positive' | 'negative' | 'warning';

/** A change relative to something; the tone says whether it is good news. */
export interface Delta {
  readonly text: string;
  readonly tone?: Tone;
}

export const toList = (c: Children | undefined): Content[] =>
  c === undefined ? [] : Array.isArray(c) ? [...(c as Content[])] : [c as Content];
