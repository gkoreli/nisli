import { el, each, signal, computed, effect, onCleanup, ref, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { truncate, buttonBox } from '../style.js';
import { measure } from '../engine/measure.js';
import { pageSize } from '../engine/space.js';
import { block, type Ctx } from './kernel.js';
import type { Content } from './types.js';
import type { Status } from './status.js';

export type CellValue = string | number | Content;

export interface Column<T> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => CellValue;
  /** What the cell holds. Numbers and money align right and use tabular figures. */
  readonly kind?: 'text' | 'number' | 'money' | 'date';
  /** primary columns never leave; tertiary leave first when the table is narrow. */
  readonly priority?: 'primary' | 'secondary' | 'tertiary';
  readonly sortable?: boolean;
}

export interface Sort {
  readonly by: string;
  readonly dir: 'asc' | 'desc';
}

export interface TableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  key: (row: T) => string;
  onSelect?: (row: T) => void;
  sort?: Sort;
  onSort?: (sort: Sort) => void;
  /** Shown when there are no rows. */
  empty?: string;
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
    const tableEl = ref();
    const columns = computed(() => [...props.columns.value]);
    const allRows = computed(() => [...props.rows.value]);
    const limit = signal(metrics.layout.tablePage);
    const rows = computed(() => allRows.value.slice(0, limit.value));
    const paging = computed(() => pageSize(rows.value.length, allRows.value.length, metrics.layout.tablePage));
    // A new list starts at the first page again.
    const stopReset = effect(() => { allRows.value; limit.value = metrics.layout.tablePage; });
    onCleanup(stopReset);

    // The block draws its own waiting state in place: five rows of bones under the real header.
    const pending = ctx.pending;

    /** The column dropped columns fold into: the first primary text column, else the first primary. */
    const stackTarget = computed(() => {
      const primaries = columns.value.filter((c) => c.priority === 'primary');
      return (primaries.find(isText) ?? primaries[0])?.id;
    });

    const grid = ctx.fitRow({
      gap: 0,
      available: () => measure(host),
      items: () => {
        const table = tableEl.current as HTMLElement | null;
        const ths = table ? [...table.querySelectorAll<HTMLElement>('thead th')] : [];
        const target = stackTarget.value;
        return columns.value.map((c, i) => {
          const width = ths[i] ? measure(ths[i]!) : 0;
          return {
            id: c.id,
            width,
            // A text column may truncate down to a few words; figures and dates never do.
            minWidth: isText(c) ? Math.min(width, metrics.layout.minTextColumn) : undefined,
            priority: RANK[c.priority ?? 'secondary'],
            // Leaving the row means folding under the primary cell, never vanishing.
            stackInto: c.priority !== 'primary' && target && target !== c.id ? target : undefined,
            overflowable: c.priority !== 'primary',
          };
        });
      },
      deps: () => { columns.value; rows.value; },
      report: {
        code: 'FIT_COLUMNS',
        detail: (plan) => {
          const gone = new Set(plan.decisions.filter((d) => d.action === 'stack' || d.action === 'overflow').map((d) => d.id));
          return `columns ${columns.value.filter((c) => !gone.has(c.id)).map((c) => c.header).join(', ')} cannot fit even truncated`;
        },
      },
    });
    const measuring = grid.measuring;
    /** Columns folded under `id`, in document order. */
    const stackedInto = (id: string): Column<unknown>[] => {
      if (measuring.value) return [];
      const ids = grid.plan.value?.stacked.get(id) ?? [];
      return ids.map((sid) => columns.value.find((c) => c.id === sid)!).filter(Boolean);
    };

    const cellStyle = (c: Column<unknown>, header: boolean) => ctx.part(header ? 'table.header' : 'table.cell', () => ({
      display: grid.gone(c.id) ? 'none' : 'table-cell',
      textAlign: isNumeric(c) ? 'right' : 'left',
      fontVariantNumeric: isNumeric(c) || c.kind === 'date' ? 'tabular-nums' : 'normal',
      ...truncate,
      boxSizing: 'border-box',
      maxWidth: measuring.value ? (c.priority === 'primary' ? 'none' : 320) : 'none',
      width: !measuring.value && grid.decision(c.id) && !grid.gone(c.id) ? grid.decision(c.id)!.width : 'auto',
      padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
      userSelect: header ? 'none' : 'auto',
      font: 'inherit',
    }));
    /** The row's name comes from its first primary cell (else its first cell): the column whose `<td>` carries the row id. */
    const nameColumn = computed(() => (columns.value.find((c) => c.priority === 'primary') ?? columns.value[0])?.id);

    const sortMark = (c: Column<unknown>) => {
      const s = props.sort.value;
      return s && s.by === c.id ? (s.dir === 'asc' ? ' ↑' : ' ↓') : '';
    };
    const toggleSort = (c: Column<unknown>) => {
      if (!c.sortable) return;
      const s = props.sort.value;
      props.onSort.value?.({ by: c.id, dir: s?.by === c.id && s.dir === 'asc' ? 'desc' : 'asc' });
    };

    const body = each(rows, (r) => props.key.value(r), (row) => {
      // Per row, from a counter: `each()` keeps a row's element across a keyed reorder, so an index would drift.
      const rowId = `${id}-r${nextRow++}`;
      const hovered = signal(false);
      const focused = signal(false);
      const select = () => props.onSelect.value?.(row.value);
      return el('tr', {
        tabindex: computed(() => (props.onSelect.value ? '0' : false)),
        // A selectable row is named by its primary cell: a keyboard lands on it and hears what it is.
        'aria-labelledby': computed(() => (props.onSelect.value && nameColumn.value ? `${rowId}-${nameColumn.value}` : false)),
        style: ctx.part(() => (hovered.value || focused.value ? ['table.row.hover'] : []), () => ({ cursor: props.onSelect.value ? 'pointer' : 'default' })),
        on: {
          click: select,
          // Enter and Space select, as a button would; both defaults are prevented: Space's is a page scroll, and a
          // cancelled Enter keydown has no keypress — which would otherwise land in the input the selection just
          // focused (a dialog's first field) and implicitly submit its form on the same keystroke.
          // Only on the row itself: a control rendered inside a cell keeps its own keys.
          keydown: ((e: KeyboardEvent) => {
            if (!props.onSelect.value || e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
          }) as EventListener,
          mouseenter: () => { hovered.value = true; },
          mouseleave: () => { hovered.value = false; },
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
            return el('div', { style: ctx.part('text.muted', { ...truncate, fontVariantNumeric: 'normal' }) },
              folded.flatMap(({ sc, value }, i) => [
                ...(i === 0 ? [] : [' · ']),
                ...(isNumeric(sc) ? [`${sc.header} `] : []),
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
    const emptyRow = computed<TemplateResult | null>(() =>
      !pending.value && rows.value.length === 0
        ? el('div', { style: ctx.part('text.muted', { padding: metrics.space[5], textAlign: 'center' }) }, props.empty.value ?? 'Nothing here yet.')
        : null,
    );

    return [
      ctx.failure,
      el('table', {
        ref: tableEl,
        style: ctx.part([], () => ({ borderCollapse: 'collapse', width: measuring.value ? 'max-content' : '100%', tableLayout: measuring.value ? 'auto' : 'fixed' })),
      }, [
        el('thead', {}, [
          el('tr', {}, columns.value.map((c) =>
            el('th', {
              scope: 'col',
              style: cellStyle(c, true),
              'aria-sort': computed(() => { const s = props.sort.value; return s?.by === c.id ? (s.dir === 'asc' ? 'ascending' : 'descending') : false; }),
            }, c.sortable
              // A sortable header is a real button: Tab reaches it, Enter and Space sort natively; the sort mark is decoration.
              ? [el('button', {
                type: 'button',
                // No button look: a reset over the cell's own `table.header` look, so the header reads as it did (inline-block: measured as the cell's text).
                style: ctx.part([], {
                  ...truncate, display: 'inline-block', width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: 0, margin: 0,
                  font: 'inherit', color: 'inherit', textAlign: 'inherit', background: 'none', border: 'none', borderRadius: 0, cursor: 'pointer',
                }),
                on: { click: () => toggleSort(c) },
              }, [c.header, el('span', { 'aria-hidden': 'true' }, computed(() => sortMark(c)))])]
              : c.header),
          )),
        ]),
        el('tbody', { style: ctx.part([], () => ({ display: pending.value ? 'none' : 'table-row-group' })) }, [body]),
        skeletonRows as ReadonlySignal<unknown>,
      ]),
      emptyRow as ReadonlySignal<unknown>,
      el('div', { style: ctx.part([], () => ({ display: paging.value.remaining > 0 ? 'flex' : 'none', justifyContent: 'center', padding: metrics.space[3] })) }, [
        el('button', {
          type: 'button',
          style: ctx.part(['button', 'button.plain'], buttonBox()),
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
  key: (row: T) => string;
  onSelect?: (row: T) => void;
  sort?: Sort | ReadonlySignal<Sort | undefined>;
  onSort?: (sort: Sort) => void;
  empty?: string;
  status?: Status;
}): Content {
  return TableImpl(props as unknown as Parameters<typeof TableImpl>[0]);
}
