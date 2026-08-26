/**
 * marketing.ts — the claim, made in the medium it is a claim about.
 *
 * The four cells below are one call with one set of arguments, repeated with a
 * different context wrapper. Nothing in this file selects a size, so the grid
 * is a control: if the four buttons come out different, the theme did it.
 *
 * Each Save hugs the trailing edge of its cell rather than stretching across
 * it. A stack stretches its children, and four buttons stretched to the same
 * width would hide the very difference the grid exists to show — so the cell's
 * action declares WHERE IT BELONGS (`align: 'end'`, which on a stack is the
 * inline end) instead of being wrapped in a row to dodge the stretch. The row
 * wrapper that used to be here got the same paint for the wrong reason: it said
 * "put this on a line of its own" and relied on a row not stretching as a side
 * effect, so the declaration on the page and the intent in the designer's head
 * were two different sentences.
 *
 * IT ALSO STATES THE VOCABULARY, and reads it from `contracts.ts` rather than
 * retyping it. A landing page for this idea has to list what an author may
 * declare; doing that from the same closed set the checker validates against is
 * the difference between a claim and a screenshot of a claim. The list is a
 * genuine wrapping strip: the number of terms is fixed by the seam and the
 * number of lines is a consequence of the width, which is the whole thesis
 * applied to the paragraph that describes it.
 *
 * MARKETING DECLARES ONLY `ready` AND `hostile` in `state.ts`. There is no
 * corpus here to be empty, singular or plural, and a static page has nothing to
 * load or fail to load. What it does have is the app's only `display`-level
 * text, which is the widest type the table derives — so an unbreakable compound
 * belongs in this headline more than anywhere else in the app, and the copy is
 * read from the state rather than written at the call site.
 */

import { computed, html, type TemplateResult } from '@nisli/core';
import {
  AXIS_ATTRS,
  type Density,
  type InputMode,
  VOCABULARY,
} from '../../appearance/contracts.js';
import { Button, Hero, Region, Surface, Text } from '../../ui/index.js';
import { hero, setContext } from '../state.js';

/**
 * One row of the vocabulary section: the attribute an author writes, and every
 * value that attribute accepts.
 *
 * Derived from `AXIS_ATTRS` and `VOCABULARY` together, so the page cannot show
 * an attribute the seam does not map or a value the axis does not allow. If a
 * term is added to the vocabulary this section grows a chip without anybody
 * editing this file, and if one is removed the chip disappears — which is the
 * only way a page that documents a closed set can stay true to it.
 */
const DECLARATIONS: readonly { readonly attr: string; readonly values: readonly string[] }[] =
  Object.entries(AXIS_ATTRS).map(([attr, axis]) => ({ attr, values: VOCABULARY[axis] }));

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
          headline: computed(() => hero.value.headline),
          sub: computed(() => hero.value.sub),
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
                ${Region({
                  layout: 'stack',
                  align: 'end',
                  children: Button({ role: 'primary', children: 'Save' }),
                })}
              `,
            }),
          }),
        )}`,
      })}
      ${Surface({
        layout: 'stack',
        children: html`
          ${Text({ as: 'title', children: 'The whole vocabulary' })}
          ${Text({
            as: 'body',
            children:
              'Everything an author may declare, and every value each declaration accepts. This list is read from the same closed set the checker validates its own selectors against, so the page cannot advertise a word the framework does not have.',
          })}
          ${DECLARATIONS.map((declaration) =>
            Region({
              layout: 'row',
              align: 'start',
              children: html`
                ${Text({ as: 'label', children: declaration.attr })}
                ${Region({
                  layout: 'wrap',
                  grow: true,
                  children: html`${declaration.values.map((value) =>
                    Text({ as: 'meta', children: value }),
                  )}`,
                })}
              `,
            }),
          )}
          ${Text({
            as: 'meta',
            children:
              'The terms above wrap onto as many lines as the width allows, and each attribute keeps its name on the first of them. Neither the line count nor the alignment is written anywhere: one is a consequence of the space, the other of the layout the container declared.',
          })}
        `,
      })}
    `,
  });
}
