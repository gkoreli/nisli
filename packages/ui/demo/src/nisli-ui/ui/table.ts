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
  component,
  computed,
  html,
  onMount,
  ref,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import {
  attr,
  captureChildren,
  cn,
  projectChildren,
  transparentHost,
} from '../lib/utils.js';

export type TablePartProps = {
  /** Merged last into the inner element's class list via cn(). */
  className?: string;
  children?: string | TemplateResult;
};

/**
 * Build a single-root table part: sets up the transparent host, className
 * merge, and light-DOM children projection, then defers to `render` for the
 * literal table element (tag names cannot be interpolated into `html`).
 */
function tablePart(
  tag: string,
  base: string,
  render: (ctx: {
    classes: ReadonlySignal<string>;
    root: Ref<HTMLElement>;
    children: unknown;
  }) => TemplateResult,
) {
  return component<TablePartProps>(tag, (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() => cn(base, className.value));

    const root = ref<HTMLElement>();
    onMount(() => {
      if (root.current) projectChildren(host, root.current, projected);
    });

    return render({ classes, root, children: props.children });
  });
}

export const Table = component<TablePartProps>('ui-table', (props, host) => {
  transparentHost(host);
  const projected = captureChildren(host);

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn('w-full caption-bottom text-sm', className.value));

  const root = ref<HTMLTableElement>();
  onMount(() => {
    if (root.current) projectChildren(host, root.current, projected);
  });

  return html`<div data-slot="table-container" class="relative w-full overflow-x-auto">
    <table ref="${root}" data-slot="table" class="${classes}">${props.children}</table>
  </div>`;
});

export const TableHeader = tablePart(
  'ui-table-header',
  '[&_tr]:border-b',
  ({ classes, root, children }) =>
    html`<thead ref="${root}" data-slot="table-header" class="${classes}">${children}</thead>`,
);

export const TableBody = tablePart(
  'ui-table-body',
  '[&_tr:last-child]:border-0',
  ({ classes, root, children }) =>
    html`<tbody ref="${root}" data-slot="table-body" class="${classes}">${children}</tbody>`,
);

export const TableFooter = tablePart(
  'ui-table-footer',
  'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
  ({ classes, root, children }) =>
    html`<tfoot ref="${root}" data-slot="table-footer" class="${classes}">${children}</tfoot>`,
);

export const TableRow = tablePart(
  'ui-table-row',
  'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
  ({ classes, root, children }) =>
    html`<tr ref="${root}" data-slot="table-row" class="${classes}">${children}</tr>`,
);

export const TableHead = tablePart(
  'ui-table-head',
  'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
  ({ classes, root, children }) =>
    html`<th ref="${root}" data-slot="table-head" class="${classes}">${children}</th>`,
);

export const TableCell = tablePart(
  'ui-table-cell',
  'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
  ({ classes, root, children }) =>
    html`<td ref="${root}" data-slot="table-cell" class="${classes}">${children}</td>`,
);

export const TableCaption = tablePart(
  'ui-table-caption',
  'mt-4 text-sm text-muted-foreground',
  ({ classes, root, children }) =>
    html`<caption ref="${root}" data-slot="table-caption" class="${classes}">${children}</caption>`,
);
