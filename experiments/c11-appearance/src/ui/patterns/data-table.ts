/**
 * data-table.ts — tabular data.
 *
 * DECLARES: that this is a table, which columns exist, which text level each
 * region of it is, and — the part that is an affordance rather than a value —
 * that the table lives in a SCROLL REGION. Rows are keyed, so a reorder moves
 * nodes instead of rebuilding them.
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
 * WHY THE SCROLL REGION IS DECLARED HERE, AND NOT INHERITED FROM THE SURFACE.
 * A flush surface clips (`overflow: hidden`) so a table's square corners stay
 * inside the frame's rounded ones. A full-width table with nowrap cells inside a
 * clipping box is a bounded box whose content cannot reflow — so a narrow
 * viewport silently DELETED the rightmost columns: no scrollbar, no affordance,
 * no finding, nothing for the reader to notice. That is the same defect class as
 * F8 (an impossible constraint resolved by destroying content) with the failure
 * made invisible instead of merely ugly, which is worse.
 *
 * The fix is a scroll container, and it belongs to this pattern rather than to
 * the surface modifier for a reason: scrolling is a PROMISE to the reader, so it
 * has to be declared by the component that means to make it. Had the theme given
 * every flush surface `overflow-x: auto`, then every flush surface would have
 * quietly acquired scroll semantics it never asked for, and the next author to
 * put something wide inside one would inherit a behaviour nobody chose. The
 * distinction is exactly the one the crush rule now encodes: `auto`/`scroll` are
 * exempt from N660 because the content is still reachable, while `hidden`/`clip`
 * are NOT, because clipping is silent loss.
 *
 * `tabindex="0"` is unconditional. A scrollable region a keyboard user cannot
 * reach is the same silent loss one step removed — the columns exist, they are
 * simply unreachable without a pointer. `role="region"` and its name are
 * conditional on there being a caption, because an unnamed landmark is worse
 * than no landmark.
 *
 * There is no `data-fit` here on purpose, and the scroll region is never nested
 * inside one. A table's overflow is not a row of optional controls that can be
 * ranked and dropped; it is data, and silently dropping a column would be the
 * fit engine deciding something it has no standing to decide. Keeping the two
 * apart also keeps the solver honest: a scroll container inside a fit container
 * would look like a box that absorbs any amount of content, so the solver would
 * stop degrading while the reader lost things off the edge.
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
  /** Names the table, and through it the scroll region. */
  caption?: string;
}

/** Per-instance id source, so a page of tables has one name each, not one shared. */
let tableSeq = 0;

export const DataTable = component<DataTableProps>('app-data-table', (props) => {
  const columns = computed(() => [...(props.columns.value ?? [])]);
  const rows = computed(() => [...(props.rows.value ?? [])]);
  const hasCaption = computed(() => Boolean(props.caption.value));
  const captionId = `app-data-table-caption-${++tableSeq}`;

  return html`<div
    data-component="app-data-table"
    data-scroll-region
    tabindex="0"
    role=${computed(() => (hasCaption.value ? 'region' : undefined))}
    aria-labelledby=${computed(() => (hasCaption.value ? captionId : undefined))}
  >
    <table data-appearance="table">
      ${when(
        hasCaption,
        () => html`<caption id=${captionId} data-text="label">${props.caption}</caption>`,
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
    </table>
  </div>`;
});
