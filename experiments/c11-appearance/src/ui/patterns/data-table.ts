/**
 * data-table.ts — tabular data.
 *
 * DECLARES: that this is a table, which columns exist, and which text level each
 * region of it is. Rows are keyed, so a reorder moves nodes instead of
 * rebuilding them.
 *
 * DOES NOT DECIDE: cell padding, row height, border colour, header weight, a
 * `dense` variant — or, since the derivation landed, whether its own overflow
 * scrolls. Density is a CONTEXT, inherited from the enclosing Region — which is
 * why the same table source can appear twice on one page, once comfortable and
 * once dense, with no second component and no `size` prop. Put differently: the
 * shipped alternative to this file is a set of cell classes per density, chosen
 * by a caller who looked at a design.
 *
 * It is real table markup — <caption>, <thead>, `scope="col"` — because a table
 * is a semantic structure before it is an appearance, and the semantics are the
 * part no theme can supply.
 *
 * WHY THE SCROLL REGION IS NO LONGER DECLARED HERE.
 * A flush surface clips so a table's square corners stay inside the frame's
 * rounded ones. A full-width table with nowrap cells inside a clipping box is a
 * bounded box whose content cannot reflow — so a narrow viewport silently
 * DELETED the rightmost columns: no scrollbar, no affordance, no finding,
 * nothing for the reader to notice. That is the same defect class as F8 (an
 * impossible constraint resolved by destroying content) with the failure made
 * invisible instead of merely ugly, which is worse.
 *
 * This file used to carry `data-scroll-region` as the fix, with the argument
 * that "scrolling is a PROMISE to the reader, so it has to be declared by the
 * component that means to make it". That argument was WRONG, and it is worth
 * keeping the refutation rather than the claim.
 *
 * It got the mechanism right and the direction backwards. Declaring the
 * promise per call site left the DESTRUCTIVE behaviour as the default: a flush
 * surface clipped unless somebody remembered, and forgetting deleted data in
 * silence. This table survived only because this file happened to remember.
 * Measured on this exact component with the declaration removed, at 360 pixels: an
 * 835-pixel table clipped to 358 pixels, 33 meaningful nodes destroyed, 20 of them
 * entirely, worst overhang 475.58 pixels, and every check reported clean. The old
 * comment's worry — that deriving it would give every flush surface "scroll
 * semantics it never asked for" — was the wrong thing to be afraid of. A
 * scrollbar nobody asked for is a cosmetic surprise; a deleted column is a
 * deleted column.
 *
 * So the promise is now DERIVED, in `theme/structure.css`: the single in-flow
 * child of a clipping surface becomes the scrollport, unless the surface
 * declares `data-clip="trim"` (the overhang is decoration) or the child is
 * already truncated (the loss is declared and has an ellipsis as its receipt).
 * Net vocabulary change: one attribute deleted here, one added there.
 *
 * WHAT THIS FILE STILL OWES THE DERIVATION: the wrapper element below. The
 * scrollport must be the box that inherits the CLIPPER'S constrained width —
 * promoting the surface releases the rounded-corner clip, and promoting the
 * `<table>` is a measured no-op, because a scroll container whose own inline
 * size comes from its content scrolls nothing. So one wrapper is authored
 * here, and the theme decides what it does. The alternative, where the engine
 * generates the wrapper and this file ships bare markup, measured identically
 * and is deferred: it needs the mutator to insert an element, which it cannot
 * do yet.
 *
 * `tabindex="0"` is unconditional and is part of the fix, not a follow-up. A
 * scrollable region a keyboard user cannot reach is the same silent loss one
 * step removed — the columns exist, they are simply unreachable without a
 * pointer. It stays authored rather than derived because it is a property of
 * this element regardless of whether the theme promoted it this render.
 * `role="region"` and its name are conditional on there being a caption,
 * because an unnamed landmark is worse than no landmark.
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
