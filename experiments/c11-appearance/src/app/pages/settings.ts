/**
 * settings.ts — forms, a destructive action, and the escape hatch.
 *
 * The escape hatch is on this page on purpose: the honest version of "no
 * component styles itself" has to include the door out, and the door has to be
 * countable. It reports itself as N601 and forfeits every guarantee below it.
 *
 * THE FORM IS DATA NOW, so the hostile state puts an unbreakable compound, a
 * right-to-left string and a mixed-script hint through the same `Field` the
 * happy path uses, rather than through a second call site written to look
 * broken. The danger zone and the escape hatch stay in every state: a
 * destructive action does not stop existing because a form is loading, and the
 * hatch is the page's own confession, not content.
 *
 * This page declares no `empty`, `single` or `many` in `state.ts`. A settings
 * form has a fixed set of controls — there is no corpus to be empty or plural —
 * and sweeping states a page cannot be in would pad the cell count with cells
 * that prove nothing.
 */

import { computed, each, html, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { Button, Escaped, Field, Region, Surface, Text, Toolbar } from '../../ui/index.js';
import { delivery, fields, retry } from '../state.js';
import { StatePanel } from './states.js';

function settingsForm(): ReadonlySignal<TemplateResult> {
  return computed((): TemplateResult => {
    if (delivery.value === 'loading') {
      return StatePanel({
        kind: 'loading',
        headline: 'Loading settings',
        what: 'This account has been requested and has not arrived yet.',
      });
    }
    if (delivery.value === 'error') {
      return StatePanel({
        kind: 'error',
        headline: 'Settings unavailable',
        what: 'This account could not be loaded, so editing it now would overwrite values nobody has read.',
        action: Button({ role: 'primary', children: 'Try again', onClick: retry }),
      });
    }
    return Surface({
      layout: 'grid',
      children: html`${each(
        fields,
        (field) => field.label,
        (field) => html`${Field({
          label: computed(() => field.value.label),
          value: computed(() => field.value.value),
          placeholder: computed(() => field.value.placeholder),
          hint: computed(() => field.value.hint),
          invalid: computed(() => field.value.invalid ?? false),
        })}`,
      )}`,
    });
  });
}

export function SettingsPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Settings' })} ${settingsForm()}
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
