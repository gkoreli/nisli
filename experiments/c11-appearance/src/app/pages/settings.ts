/**
 * settings.ts — forms, a destructive action, and the escape hatch.
 *
 * The escape hatch is on this page on purpose: the honest version of "no
 * component styles itself" has to include the door out, and the door has to be
 * countable. It reports itself as N601 and forfeits every guarantee below it.
 */

import { html, type TemplateResult } from '@nisli/core';
import { Button, Escaped, Field, Region, Surface, Text, Toolbar } from '../../ui/index.js';

export function SettingsPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Settings' })}
      ${Surface({
        layout: 'grid',
        children: html`
          ${Field({ label: 'Display name', value: 'Ada Lovelace' })}
          ${Field({ label: 'Email', value: 'ada@analytical.engine', hint: 'Used for sign-in.' })}
          ${Field({ label: 'Organisation', value: 'Analytical Society' })}
          ${Field({
            label: 'Recovery code',
            value: '',
            placeholder: 'XXXX-XXXX',
            invalid: true,
            hint: 'Required before enabling two-factor sign-in.',
          })}
        `,
      })}
      ${Surface({
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'Danger zone' })}
          ${Text({
            as: 'body',
            children: 'Deleting the workspace removes every message and cannot be undone.',
          })}
          ${Region({
            layout: 'row',
            children: html`
              ${Button({ role: 'danger', children: 'Delete workspace' })}
              ${Button({ role: 'quiet', children: 'Cancel' })}
            `,
          })}
        `,
      })}
      ${Surface({
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'Escape hatch' })}
          ${Text({
            as: 'body',
            children:
              'Raw styling stays possible, and stays expensive. Anything under the hatch is outlined, reported once as N601, and dropped from the guarantees: its values no longer derive from the context, so density, input mode and theme stop reaching it, the fit solver will not degrade it, and the checker stops vouching for its contrast, hit targets and geometry.',
          })}
          ${Text({
            as: 'meta',
            children: 'That is the whole cost of the door, stated where the door is.',
          })}
          ${Escaped({
            note: 'hand-placed offset and rotation',
            children: Button({ children: 'Hand-placed button' }),
          })}
        `,
      })}
    `,
  });
}
