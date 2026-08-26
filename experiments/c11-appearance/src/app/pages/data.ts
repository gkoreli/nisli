/**
 * data.ts — the same table twice, in two contexts.
 *
 * This page exists to be diffed against itself: both tables are the same call
 * with the same arguments, so every difference on screen was produced by the
 * context attribute on the wrapper, not by a decision at either call site.
 *
 * THE DECLARED STATES GO THROUGH THE SAME PAIR. A contentless state renders one
 * panel and no table, because two identical panels would prove nothing and a
 * table with a header row and no body is a shape that claims data it does not
 * have. Everything else keeps the pair, so `single`, `many` and `hostile` are
 * each measured in two densities at once — which is exactly the comparison the
 * page was built for, applied to content it was never built for.
 */

import { computed, html, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { Button, DataTable, Region, Surface, Text, Toolbar } from '../../ui/index.js';
import { delivery, retry, SERVICE_COLUMNS, services } from '../state.js';
import { StatePanel } from './states.js';

function dataBody(): ReadonlySignal<TemplateResult> {
  return computed((): TemplateResult => {
    if (delivery.value === 'loading') {
      return StatePanel({
        kind: 'loading',
        headline: 'Loading services',
        what: 'The service inventory has been requested and has not arrived yet.',
      });
    }
    if (delivery.value === 'error') {
      return StatePanel({
        kind: 'error',
        headline: 'Inventory unavailable',
        what: 'The service inventory could not be loaded, so no row below would be current.',
        action: Button({ role: 'primary', children: 'Try again', onClick: retry }),
      });
    }
    if (services.value.length === 0) {
      return StatePanel({
        kind: 'empty',
        headline: 'No services',
        what: 'Nothing is registered in this workspace yet.',
      });
    }
    return html`
      ${Surface({
        flush: true,
        children: DataTable({
          columns: SERVICE_COLUMNS,
          rows: services,
          caption: 'Ambient context',
        }),
      })}
      ${Region({
        density: 'dense',
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'The same table, one context deeper' })}
          ${Text({
            as: 'meta',
            children:
              'Both tables are the same call with the same arguments. Every difference in row height, padding and type size below came from data-density on this wrapper.',
          })}
          ${Surface({
            flush: true,
            children: DataTable({
              columns: SERVICE_COLUMNS,
              rows: services,
              caption: 'Identical source, dense context',
            }),
          })}
        `,
      })}
    `;
  });
}

export function DataPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`${Toolbar({ title: 'Services' })} ${dataBody()}`,
  });
}
