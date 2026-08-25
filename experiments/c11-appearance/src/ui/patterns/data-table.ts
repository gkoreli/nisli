/**
 * data-table.ts — tabular data.
 *
 * DECLARES: that this is a table, which columns exist, and which text level each
 * region of it is. Rows are keyed, so a reorder moves nodes instead of rebuilding
 * them.
 *
 * DOES NOT DECIDE: cell padding, row height, border colour, header weight, or a
 * `dense` variant. Density is a CONTEXT, inherited from the enclosing Region —
 * which is why the same table source can appear twice on one page, once
 * comfortable and once dense, with no second component and no `size` prop. Put
 * differently: the shipped alternative to this file is a set of cell classes per
 * density, chosen by a caller who looked at a design.
 *
 * It is real table markup — <caption>, <thead>, `scope="col"` — because a table
 * is a semantic structure before it is an appearance, and the semantics are the
 * part no theme can supply.
 *
 * There is no `data-fit` here on purpose. A table's overflow is not a row of
 * optional controls that can be ranked and dropped; it is data, and silently
 * dropping a column would be the fit engine deciding something it has no
 * standing to decide.
 */

import { component, computed, each, html, when } from '@nisli/core';

export interface TableColumn {
  readonly id: string;
  readonly header: string;
}

/**
 * A row is an id plus string cells addressed by column id. Open on purpose: a
 * caller's own domain row type is assignable without an adapter.
 */
export type TableRow = { readonly id: string } & Readonly<Record<string, string>>;

export interface DataTableProps {
  columns?: readonly TableColumn[];
  rows?: readonly TableRow[];
  caption?: string;
}

export const DataTable = component<DataTableProps>('app-data-table', (props) => {
  const columns = computed(() => [...(props.columns.value ?? [])]);
  const rows = computed(() => [...(props.rows.value ?? [])]);

  return html`<table data-component="app-data-table" data-appearance="table">
    ${when(
      computed(() => Boolean(props.caption.value)),
      () => html`<caption data-text="label">${props.caption}</caption>`,
    )}
    <thead>
      <tr>
        ${computed(() =>
          columns.value.map(
            (column) => html`<th scope="col" data-text="label">${column.header}</th>`,
          ),
        )}
      </tr>
    </thead>
    <tbody>
      ${each(
        rows,
        (row) => row.id,
        (row) => html`<tr>
          ${computed(() =>
            // Depends on `columns` only, so a cell VALUE change updates the one
            // text node through the inner computed instead of rebuilding the row.
            columns.value.map(
              (column) => html`<td data-text="body">${computed(() => row.value[column.id] ?? '')}</td>`,
            ),
          )}
        </tr>`,
      )}
    </tbody>
  </table>`;
});
