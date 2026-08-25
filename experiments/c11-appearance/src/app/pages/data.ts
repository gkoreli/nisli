/**
 * data.ts — the same table twice, in two contexts.
 *
 * This page exists to be diffed against itself: both tables are the same call
 * with the same arguments, so every difference on screen was produced by the
 * context attribute on the wrapper, not by a decision at either call site.
 */

import { html, type TemplateResult } from '@nisli/core';
import { DataTable, Region, Surface, Text, Toolbar } from '../../ui/index.js';
import { SERVICE_COLUMNS, services } from '../state.js';

export function DataPage(): TemplateResult {
  return Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Services' })}
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
    `,
  });
}
