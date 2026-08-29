import { component, el, each, signal, computed, effect, onCleanup, ref, type ReadonlySignal, type TemplateResult } from '@nisli/core';
import { metrics } from '../metrics.js';
import { css, apply, truncate, buttonStyle } from '../style.js';
import { look } from '../skin.js';
import { measure } from '../engine/measure.js';
import { useFit } from '../engine/use-fit.js';
import { report } from '../engine/report.js';
import type { Content } from './types.js';
import { viewOf, bone, failure, type Status } from './status.js';

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
/** Rows shown before the reader is asked; a long list is a decision, not a scroll. */
const PAGE = 60;
const isNumeric = (c: Column<unknown>) => c.kind === 'number' || c.kind === 'money';

const TableImpl = component<TableProps<unknown>>('nisli-table', (props, host) => {
  const tableEl = ref();
  const columns = computed(() => [...props.columns.value]);
  const allRows = computed(() => [...props.rows.value]);
  const limit = signal(PAGE);
  const rows = computed(() => allRows.value.slice(0, limit.value));
  const remaining = computed(() => allRows.value.length - rows.value.length);
  // A new list starts at the first page again.
  const stopReset = effect(() => { allRows.value; limit.value = PAGE; });
  onCleanup(stopReset);

  apply(host, { display: 'block', minWidth: 0, overflow: 'hidden' });

  /** The column dropped columns fold into: the first primary text column, else the first primary. */
  const stackTarget = computed(() => {
    const cols = columns.value;
    const primaries = cols.filter((c) => c.priority === 'primary');
    return (primaries.find((c) => !isNumeric(c) && c.kind !== 'date') ?? primaries[0])?.id;
  });

  const grid = useFit(host, {
    gap: 0,
    available: () => measure(host),
    items: () => {
      const table = tableEl.current as HTMLElement | null;
      const ths = table ? [...table.querySelectorAll<HTMLElement>('thead th')] : [];
      const target = stackTarget.value;
      return columns.value.map((c, i) => {
        const width = ths[i] ? measure(ths[i]!) : 0;
        const text = !isNumeric(c) && c.kind !== 'date';
        return {
          id: c.id,
          width,
          // A text column may truncate down to a few words; figures and dates never do.
          minWidth: text ? Math.min(width, metrics.layout.minTextColumn) : undefined,
          priority: RANK[c.priority ?? 'secondary'],
          // Leaving the row means folding under the primary cell, never vanishing.
          stackInto: c.priority !== 'primary' && target && target !== c.id ? target : undefined,
          overflowable: c.priority !== 'primary',
        };
      });
    },
    deps: () => { columns.value; rows.value; },
    onPlan: (plan, available) => {
      if (plan.slack < 0) {
        const kept = columns.value.filter((c) => plan.decisions.find((d) => d.id === c.id)?.action !== 'stack' && plan.decisions.find((d) => d.id === c.id)?.action !== 'overflow').map((c) => c.header).join(', ');
        report({ code: 'FIT_COLUMNS', block: 'nisli-table', width: available, deficit: -plan.slack, detail: `columns ${kept} cannot fit even truncated` });
      }
    },
  });
  const measuring = grid.measuring;
  /** Columns folded under `id`, in document order. */
  const stackedInto = (id: string): Column<unknown>[] => {
    if (measuring.value) return [];
    const ids = grid.plan.value?.stacked.get(id) ?? [];
    return ids.map((sid) => columns.value.find((c) => c.id === sid)!).filter(Boolean);
  };

  const cellStyle = (c: Column<unknown>, header: boolean) => css({
    display: grid.gone(c.id) ? 'none' : 'table-cell',
    textAlign: isNumeric(c) ? 'right' : 'left',
    fontVariantNumeric: isNumeric(c) || c.kind === 'date' ? 'tabular-nums' : 'normal',
    ...truncate,
    boxSizing: 'border-box',
    maxWidth: measuring.value ? (c.priority === 'primary' ? 'none' : 320) : 'none',
    width: !measuring.value && grid.decision(c.id) && !grid.gone(c.id) ? grid.decision(c.id)!.width : 'auto',
    padding: `${metrics.space[2]}px ${metrics.space[3]}px`,
    cursor: header && c.sortable ? 'pointer' : 'default',
    userSelect: header ? 'none' : 'auto',
    font: 'inherit',
    ...look(header ? 'table.header' : 'table.cell'),
  });

  const sortMark = (c: Column<unknown>) => {
    const s = props.sort.value;
    return s && s.by === c.id ? (s.dir === 'asc' ? ' ↑' : ' ↓') : '';
  };
  const toggleSort = (c: Column<unknown>) => {
    if (!c.sortable) return;
    const s = props.sort.value;
    props.onSort.value?.({ by: c.id, dir: s?.by === c.id && s.dir === 'asc' ? 'desc' : 'asc' });
  };

  const body = each(rows, (r) => props.key.value(r), (row) =>
    el('tr', {
      tabindex: computed(() => (props.onSelect.value ? '0' : false)),
      style: computed(() => css({ cursor: props.onSelect.value ? 'pointer' : 'default' })),
      on: {
        click: () => props.onSelect.value?.(row.value),
        keydown: ((e: KeyboardEvent) => { if (e.key === 'Enter') props.onSelect.value?.(row.value); }) as EventListener,
        mouseenter: (e) => { apply(e.currentTarget as HTMLElement, look('table.row.hover')); },
        mouseleave: (e) => { apply(e.currentTarget as HTMLElement, Object.fromEntries(Object.keys(look('table.row.hover')).map((k) => [k, '']))); },
      },
    }, columns.value.map((c) =>
      el('td', { style: computed(() => cellStyle(c, false)) }, [
        computed(() => c.cell(row.value) as unknown),
        computed(() => {
          // Fold the dropped columns' values under this cell; an empty value is not worth a slot.
          const folded = stackedInto(c.id)
            .map((sc) => ({ sc, value: sc.cell(row.value) as unknown }))
            .filter(({ value }) => value !== '' && value !== null && value !== undefined);
          if (folded.length === 0) return null;
          return el('div', { style: css({ ...truncate, ...look('text.muted') }) },
            folded.flatMap(({ sc, value }, i) => [
              ...(i === 0 ? [] : [' · ']),
              ...(isNumeric(sc) ? [`${sc.header} `] : []),
              value,
            ]) as never,
          );
        }),
      ]),
    )),
  );

  const view = computed(() => viewOf(props.status.value));
  const skeletonRows = computed<TemplateResult | null>(() =>
    view.value.pending
      ? el('tbody', { role: 'status', 'aria-label': 'Loading' }, Array.from({ length: 5 }, () =>
          el('tr', {}, columns.value.map((c) => el('td', { style: computed(() => cellStyle(c, false)) }, [bone(metrics.control.height / 2)])))))
      : null,
  );
  const emptyRow = computed<TemplateResult | null>(() =>
    !view.value.pending && rows.value.length === 0
      ? el('div', { style: css({ padding: metrics.space[5], textAlign: 'center', ...look('text.muted') }) }, props.empty.value ?? 'Nothing here yet.')
      : null,
  );

  return el('div', { style: 'display:contents' }, [
    computed(() => (view.value.failed ? failure(view.value.failed, view.value.retry) : null)),
    el('table', {
      ref: tableEl,
      style: computed(() => css({ borderCollapse: 'collapse', width: measuring.value ? 'max-content' : '100%', tableLayout: measuring.value ? 'auto' : 'fixed' })),
    }, [
      el('thead', {}, [
        el('tr', {}, columns.value.map((c) =>
          el('th', {
            scope: 'col',
            style: computed(() => cellStyle(c, true)),
            'aria-sort': computed(() => { const s = props.sort.value; return s?.by === c.id ? (s.dir === 'asc' ? 'ascending' : 'descending') : false; }),
            on: { click: () => toggleSort(c) },
          }, computed(() => c.header + sortMark(c))),
        )),
      ]),
      el('tbody', { style: computed(() => css({ display: view.value.pending ? 'none' : 'table-row-group' })) }, [body]),
      skeletonRows as ReadonlySignal<unknown>,
    ]),
    emptyRow as ReadonlySignal<unknown>,
    el('div', { style: computed(() => css({ display: remaining.value > 0 ? 'flex' : 'none', justifyContent: 'center', padding: metrics.space[3] })) }, [
      el('button', {
        type: 'button',
        style: computed(() => css(buttonStyle('plain'))),
        on: { click: () => { limit.value += PAGE; } },
      }, computed(() => `Show ${Math.min(PAGE, remaining.value)} more of ${remaining.value}`)),
    ]),
  ]);
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
