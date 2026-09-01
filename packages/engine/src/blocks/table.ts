import { el, each, signal, computed, effect, onCleanup, untrack, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { truncate, buttonBox } from '../style.js';
import { measure } from '../engine/measure.js';
import { pageSize, columnBudgets, spreadSlack, textWeights } from '../engine/space.js';
import { block, type Ctx } from './kernel.js';
import { Empty, type EmptyProps } from './empty.js';
import type { Content, Kind, Priority } from './types.js';
import type { Status } from './status.js';

export type CellValue = string | number | Content;

export interface Column<T> {
  /** Identity among the columns: the sort key, the cell id. */
  readonly id: string;
  /** The human name of the column. */
  readonly label: string;
  readonly cell: (row: T) => CellValue;
  /** What the cell holds. Numbers and money align right and use tabular figures. */
  readonly kind?: Extract<Kind, 'text' | 'number' | 'money' | 'date'>;
  /** primary columns never leave (dropped ones fold under the first primary text column); tertiary leave first. */
  readonly priority?: Priority;
  readonly sortable?: boolean;
}

export interface Sort {
  readonly by: string;
  readonly order: 'asc' | 'desc';
}

export interface TableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  /** Identity of a row across renders. */
  rowKey: (row: T) => string;
  /** A row was opened. Not a selection: the row carries no `aria-selected`. */
  onOpen?: (row: T) => void;
  sort?: Sort;
  onSort?: (sort: Sort) => void;
  /** What to say when there are no rows: a string (the `Empty` block's `title`) or the whole `Empty`. */
  empty?: string | EmptyProps;
  status?: Status;
}

const RANK = { tertiary: 1, secondary: 2, primary: 20 } as const;
let nextId = 1;
const isNumeric = (c: Column<unknown>) => c.kind === 'number' || c.kind === 'money';
const isText = (c: Column<unknown>) => !isNumeric(c) && c.kind !== 'date';
/** Rows of bones drawn while the table waits for its first data. */
const SKELETON_ROWS = 5;

/** The columns of a skeleton row: the block draws its own waiting state, one bone per column. */
function skeletonRow(ctx: Ctx<TableProps<unknown>>, columns: readonly Column<unknown>[], cell: (c: Column<unknown>) => ReadonlySignal<string>): TemplateResult {
  return el('tr', {}, columns.map((c) =>
    el('td', { style: cell(c) }, [ctx.bone(ctx.metrics.control.height / 2)]),
  ));
}

const TableImpl = block<TableProps<unknown>>('nisli-table', {
  status: true,
  host: () => ({ display: 'block', minWidth: 0, overflow: 'hidden' }),
  render: (props, ctx) => {
    const { host, metrics } = ctx;
    const id = `nisli-table-${nextId++}`;
    let nextRow = 1;
    const columns = computed(() => [...props.columns.value]);
    const allRows = computed(() => [...props.rows.value]);
    const limit = signal(metrics.layout.tablePage);
    const rows = computed(() => allRows.value.slice(0, limit.value));
    const paging = computed(() => pageSize(rows.value.length, allRows.value.length, metrics.layout.tablePage));
    // A new list starts at the first page again. The page size is read untracked: an axis change is not new data (ADR 0046 §4).
    const stopReset = effect(() => { allRows.value; limit.value = untrack(() => metrics.layout.tablePage); });
    onCleanup(stopReset);

    // The block draws its own waiting state in place: five rows of bones under the real header.
    const pending = ctx.pending;

    /** The column dropped columns fold into: the first primary text column, else the first primary. */
    const stackTarget = computed(() => {
      const primaries = columns.value.filter((c) => c.priority === 'primary');
      return (primaries.find(isText) ?? primaries[0])?.id;
    });

    // Column naturals are budgets — a pure function of (available, columns, metrics), never of the rows
    // (ADR 0044): sorting, filtering, paging or a sync can never reshape the decided structure. No
    // measuring phase: the items are data, so a rows change re-renders rows only and re-solves nothing.
    const grid = ctx.fitRow({
      gap: 0,
      measures: false,
      available: () => {
        const w = measure(host);
        // Unmeasured (0) is roomy (space.ts vocabulary): every column at its natural budget, nothing folds.
        return w > 0 ? w : columnBudgets(columns.value, 0, metrics.layout, metrics.charWidth, 2 * metrics.space[3]).reduce((s, b) => s + b.width, 0);
      },
      items: (available) => {
        const target = stackTarget.value;
        const budgets = columnBudgets(columns.value, available, metrics.layout, metrics.charWidth, 2 * metrics.space[3]);
        return columns.value.map((c, i) => ({
          id: c.id,
          width: budgets[i]!.width,
          // A text column may truncate down to a few words (minTextColumn); figures and dates never do.
          minWidth: budgets[i]!.minWidth,
          priority: RANK[c.priority ?? 'secondary'],
          // Leaving the row means folding under the primary cell, never vanishing.
          stackInto: c.priority !== 'primary' && target && target !== c.id ? target : undefined,
          overflowable: c.priority !== 'primary',
        }));
      },
      deps: () => { columns.value; },
      report: {
        code: 'FIT_COLUMNS',
        detail: (plan) => {
          const gone = new Set(plan.decisions.filter((d) => d.action === 'stack' || d.action === 'overflow').map((d) => d.id));
          return `columns ${columns.value.filter((c) => !gone.has(c.id)).map((c) => c.label).join(', ')} cannot fit even truncated`;
        },
      },
    });
    /**
     * The decided width of every surviving column: the plan's widths plus the
     * slack, spread over the surviving text columns by the share's own weights
     * — so the columns sum to the available width and the browser's fixed
     * layout has nothing of its own to distribute.
     */
    const finalWidths = computed<ReadonlyMap<string, number> | null>(() => {
      const plan = grid.plan.value;
      return plan ? spreadSlack(plan, textWeights(columns.value)) : null;
    });
    /** Columns folded under `id`, in document order. */
    const stackedInto = (id: string): Column<unknown>[] => {
      const ids = grid.plan.value?.stacked.get(id) ?? [];
      return ids.map((sid) => columns.value.find((c) => c.id === sid)!).filter(Boolean);
    };

    const cellStyle = (c: Column<unknown>, head: boolean) => ctx.part(head ? 'table.header' : 'table.cell', () => ({
      display: grid.gone(c.id) ? 'none' : 'table-cell',
      textAlign: isNumeric(c) ? 'right' : 'left',
      fontVariantNumeric: isNumeric(c) || c.kind === 'date' ? 'tabular-nums' : 'normal',
      ...truncate,
      boxSizing: 'border-box',
      width: !grid.gone(c.id) ? finalWidths.value?.get(c.id) ?? 'auto' : 'auto',
      padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
      userSelect: head ? 'none' : 'auto',
      font: 'inherit',
      // The header cell is the target's box (ADR 0046 §3): the sort button inside keeps its own, so at the default nothing moves.
      ...(head ? { height: metrics.control.hit } : {}),
    }));
    /** The row's name comes from its first primary cell (else its first cell): the column whose `<td>` carries the row id. */
    const nameColumn = computed(() => (columns.value.find((c) => c.priority === 'primary') ?? columns.value[0])?.id);

    const sortMark = (c: Column<unknown>) => {
      const s = props.sort.value;
      return s && s.by === c.id ? (s.order === 'asc' ? ' ↑' : ' ↓') : '';
    };
    const toggleSort = (c: Column<unknown>) => {
      if (!c.sortable) return;
      const s = props.sort.value;
      props.onSort.value?.({ by: c.id, order: s?.by === c.id && s.order === 'asc' ? 'desc' : 'asc' });
    };

    const body = each(rows, (r) => props.rowKey.value(r), (row) => {
      // Per row, from a counter: `each()` keeps a row's element across a keyed reorder, so an index would drift.
      const rowId = `${id}-r${nextRow++}`;
      const hovered = signal(false);
      const focused = signal(false);
      const open = () => props.onOpen.value?.(row.value);
      return el('tr', {
        tabindex: computed(() => (props.onOpen.value ? '0' : false)),
        // An openable row is named by its primary cell: a keyboard lands on it and hears what it is.
        'aria-labelledby': computed(() => (props.onOpen.value && nameColumn.value ? `${rowId}-${nameColumn.value}` : false)),
        // `height` on a row is a minimum in table layout (`min-height` does not apply): the target floor (ADR 0046 §3).
        style: ctx.part(() => (hovered.value || focused.value ? ['table.row.hover'] : []), () => ({ cursor: props.onOpen.value ? 'pointer' : 'default', height: metrics.control.hit })),
        on: {
          click: open,
          // Enter and Space open, as a button would; both defaults are prevented: Space's is a page scroll, and a
          // cancelled Enter keydown has no keypress — which would otherwise land in the input the selection just
          // focused (a dialog's first field) and implicitly submit its form on the same keystroke.
          // Only on the row itself: a control rendered inside a cell keeps its own keys.
          keydown: ((e: KeyboardEvent) => {
            if (!props.onOpen.value || e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
          }) as EventListener,
          // Pointer events, so the tint works on every input (ADR 0046 §Non-goals: no hover axis).
          pointerenter: () => { hovered.value = true; },
          pointerleave: () => { hovered.value = false; },
          focusin: () => { focused.value = true; },
          focusout: () => { focused.value = false; },
        },
      }, columns.value.map((c) =>
        el('td', { id: `${rowId}-${c.id}`, style: cellStyle(c, false) }, [
          computed(() => c.cell(row.value) as unknown),
          computed(() => {
            // Fold the dropped columns' values under this cell; an empty value is not worth a slot.
            const folded = stackedInto(c.id)
              .map((sc) => ({ sc, value: sc.cell(row.value) as unknown }))
              .filter(({ value }) => value !== '' && value !== null && value !== undefined);
            if (folded.length === 0) return null;
            // Folded values are text from other columns: never tabular figures, whatever cell they sit under.
            return el('div', { style: ctx.part('text.muted', () => ({ ...truncate, fontVariantNumeric: 'normal' })) },
              folded.flatMap(({ sc, value }, i) => [
                ...(i === 0 ? [] : [' · ']),
                ...(isNumeric(sc) ? [`${sc.label} `] : []),
                value,
              ]) as never,
            );
          }),
        ]),
      ));
    });

    const skeletonRows = computed<TemplateResult | null>(() =>
      pending.value
        ? el('tbody', { role: 'status', 'aria-label': 'Loading' }, Array.from({ length: SKELETON_ROWS }, () => skeletonRow(ctx, columns.value, (c) => cellStyle(c, false))))
        : null,
    );
    // Nothing here: the Empty block, unchanged, in the row where the table's body would be.
    const emptyRow = computed<unknown>(() => {
      if (pending.value || rows.value.length !== 0) return null;
      const e = props.empty.value ?? 'Nothing here yet.';
      return Empty(typeof e === 'string' ? { title: e } : e);
    });

    return [
      ctx.failure,
      // Pinned always: the decided widths are the truth; data truncates, folds or wraps within them.
      el('table', {
        style: ctx.part([], () => ({ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' })),
      }, [
        el('thead', {}, [
          el('tr', {}, columns.value.map((c) =>
            el('th', {
              scope: 'col',
              style: cellStyle(c, true),
              'aria-sort': computed(() => { const s = props.sort.value; return s?.by === c.id ? (s.order === 'asc' ? 'ascending' : 'descending') : false; }),
              // The whole cell sorts: the cell is the target's box (its height is `hit`), and the button's own activation bubbles here once.
              ...(c.sortable ? { on: { click: () => toggleSort(c) } } : {}),
            }, c.sortable
              // A sortable header is a real button: Tab reaches it, Enter and Space sort natively; the sort mark is decoration.
              ? [el('button', {
                type: 'button',
                // No button look: a reset over the cell's own `table.header` look, so the header reads as it did (inline-block: measured as the cell's text).
                style: ctx.part([], () => ({
                  ...truncate, display: 'inline-block', width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: 0, margin: 0,
                  font: 'inherit', color: 'inherit', textAlign: 'inherit', background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
                })),
              }, [c.label, el('span', { 'aria-hidden': 'true' }, computed(() => sortMark(c)))])]
              : c.label),
          )),
        ]),
        el('tbody', { style: ctx.part([], () => ({ display: pending.value ? 'none' : 'table-row-group' })) }, [body]),
        skeletonRows as ReadonlySignal<unknown>,
      ]),
      emptyRow as ReadonlySignal<unknown>,
      el('div', { style: ctx.part([], () => ({ display: paging.value.remaining > 0 ? 'flex' : 'none', justifyContent: 'center', padding: metrics.space[3] })) }, [
        el('button', {
          type: 'button',
          style: ctx.part(['button', 'button.plain'], () => buttonBox()),
          on: { click: () => { limit.value += metrics.layout.tablePage; } },
        }, computed(() => `Show ${paging.value.next} more of ${paging.value.remaining}`)),
      ]),
    ];
  },
});

/** Typed entry point: the generic is erased at the element boundary. */
export function Table<T>(props: {
  columns: readonly Column<T>[];
  rows: readonly T[] | ReadonlySignal<readonly T[]>;
  rowKey: (row: T) => string;
  onOpen?: (row: T) => void;
  sort?: Sort | ReadonlySignal<Sort | undefined>;
  onSort?: (sort: Sort) => void;
  empty?: string | EmptyProps;
  status?: Status;
}): Content {
  return TableImpl(props as unknown as Parameters<typeof TableImpl>[0]);
}
