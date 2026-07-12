/**
 * ui/table.ts — Table, TableHeader, TableBody, TableFooter, TableRow,
 * TableHead, TableCell, TableCaption.
 *
 * Ported from new-york-v4/ui/table.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements. Each part renders a REAL table element
 * (`<table>`/`<thead>`/`<tbody>`/`<tfoot>`/`<tr>`/`<th>`/`<td>`/`<caption>`)
 * in the light DOM, so browsers get true table semantics and the a11y tree
 * for free — no ARIA "div table" shim.
 *
 * Compose via typed factories:
 *
 * ```ts
 * Table({ children: html`
 *   ${TableHeader({ children: TableRow({ children: TableHead({ children: 'Name' }) }) })}
 *   ${TableBody({ children: TableRow({ children: TableCell({ children: 'Ada' }) }) })}
 * ` })
 * ```
 *
 * Note: because the host elements are `display: contents`, factory composition
 * (createElement/appendChild) builds a valid real-table DOM. Authoring a table
 * as a plain-HTML string with `<ui-table-*>` tags is subject to the HTML
 * parser's table foster-parenting; use factories (or real `<table>` markup) for
 * plain-HTML tables.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  computed,
  html,
  type ReadonlySignal,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

export type TablePartProps = {
  /** Merged last into the inner element's class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

/**
 * Build a single-root table part: sets up the transparent host, className
 * merge, and light-DOM children rendering, then defers to `render` for the
 * literal table element (tag names cannot be interpolated into `html`).
 */
function tablePart(
  tag: string,
  base: string,
  render: (classes: ReadonlySignal<string>) => TemplateResult,
) {
  return component<TablePartProps>(
    tag,
    (props, host) => {
      transparentHost(host);
      const classes = computed(() => cn(base, props.className.value));
      return render(classes);
    },
    { attrs: { className: 'string' } },
  );
}

export const Table = component<TablePartProps>('ui-table', (props, host) => {
  transparentHost(host);
  const classes = computed(() => cn('w-full caption-bottom text-sm', props.className.value));

  return html`<div data-slot="table-container" class="relative w-full overflow-x-auto">
    <table data-slot="table" class="${classes}">${children()}</table>
  </div>`;
}, { attrs: { className: 'string' } });

export const TableHeader = tablePart(
  'ui-table-header',
  '[&_tr]:border-b',
  (classes) => html`<thead data-slot="table-header" class="${classes}">${children()}</thead>`,
);

export const TableBody = tablePart(
  'ui-table-body',
  '[&_tr:last-child]:border-0',
  (classes) => html`<tbody data-slot="table-body" class="${classes}">${children()}</tbody>`,
);

export const TableFooter = tablePart(
  'ui-table-footer',
  'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
  (classes) => html`<tfoot data-slot="table-footer" class="${classes}">${children()}</tfoot>`,
);

export const TableRow = tablePart(
  'ui-table-row',
  'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
  (classes) => html`<tr data-slot="table-row" class="${classes}">${children()}</tr>`,
);

/**
 * TableHead / TableCell carry live `colspan`/`rowspan` passthrough (upstream
 * spreads them onto the native th/td). Declared as `number` attrs with an
 * `attr` override — the native HTML attribute is `colspan`/`rowspan`, not the
 * `col-span`/`row-span` kebab derivation. Absent → undefined → attribute omitted.
 */
export type TableCellProps = TablePartProps & {
  colSpan?: number;
  rowSpan?: number;
};

const spanAttrs = {
  className: 'string',
  colSpan: { type: 'number', attr: 'colspan' },
  rowSpan: { type: 'number', attr: 'rowspan' },
} as const;

export const TableHead = component<TableCellProps>(
  'ui-table-head',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        props.className.value,
      ),
    );
    return html`<th
      data-slot="table-head"
      colspan="${props.colSpan}"
      rowspan="${props.rowSpan}"
      class="${classes}"
    >${children()}</th>`;
  },
  { attrs: spanAttrs },
);

export const TableCell = component<TableCellProps>(
  'ui-table-cell',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        props.className.value,
      ),
    );
    return html`<td
      data-slot="table-cell"
      colspan="${props.colSpan}"
      rowspan="${props.rowSpan}"
      class="${classes}"
    >${children()}</td>`;
  },
  { attrs: spanAttrs },
);

export const TableCaption = tablePart(
  'ui-table-caption',
  'mt-4 text-sm text-muted-foreground',
  (classes) => html`<caption data-slot="table-caption" class="${classes}">${children()}</caption>`,
);
