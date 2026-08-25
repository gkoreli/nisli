/**
 * marketing.ts — the claim, made in the medium it is a claim about.
 *
 * The four cells below are one call with one set of arguments, repeated with a
 * different context wrapper. Nothing in this file selects a size, so the grid
 * is a control: if the four buttons come out different, the theme did it.
 *
 * Each Save sits in a row rather than directly in the cell's stack: a stack
 * stretches its children, and four buttons stretched to the same width would
 * hide the very difference the grid exists to show.
 */

import { html, type TemplateResult } from '@nisli/core';
import type { Density, InputMode } from '../../appearance/contracts.js';
import { Button, Hero, Region, Surface, Text } from '../../ui/index.js';
import { setContext } from '../state.js';

interface ContextCell {
  title: string;
  note: string;
  density: Density;
  input?: InputMode;
}

/**
 * Every axis is stated explicitly rather than inherited, so the four cells stay
 * a side-by-side comparison whatever the harness ambient context is set to.
 */
const CELLS: readonly ContextCell[] = [
  {
    title: 'Comfortable',
    note: 'The default context. One role declared, nothing else.',
    density: 'comfortable',
  },
  {
    title: 'Compact',
    note: 'Nothing changed but the context attribute on the wrapper.',
    density: 'compact',
  },
  {
    title: 'Dense',
    note: 'Floors in the resolution table keep the dense end legible.',
    density: 'dense',
  },
  {
    title: 'Touch',
    note: 'A larger hit-target floor arrives with the input mode, uninvited.',
    density: 'comfortable',
    input: 'touch',
  },
];

export function MarketingPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`
      ${Surface({
        children: Hero({
          headline: 'Declare what it is. Not how big it is.',
          sub: 'Every value on this page was derived from context. No component in this app contains a pixel value, a colour, or a breakpoint.',
          primaryAction: {
            id: 'start',
            label: 'Get started',
            emphasis: 'primary',
            onSelect: () => setContext({ page: 'inbox' }),
          },
          // A real destination rather than an inert CTA: the docs for this
          // prototype are its README, which the dev server already serves.
          secondaryActions: [
            {
              id: 'docs',
              label: 'Read the docs',
              emphasis: 'link',
              onSelect: () => window.open('./README.md', '_blank'),
            },
          ],
        }),
      })}
      ${Region({
        layout: 'grid',
        children: html`${CELLS.map((cell) =>
          Region({
            density: cell.density,
            input: cell.input,
            children: Surface({
              layout: 'stack',
              children: html`
                ${Text({ as: 'title', children: cell.title })}
                ${Text({ as: 'body', children: cell.note })}
                ${Region({ layout: 'row', children: Button({ role: 'primary', children: 'Save' }) })}
              `,
            }),
          }),
        )}`,
      })}
    `,
  });
}
