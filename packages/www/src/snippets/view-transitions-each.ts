import { computed, each, html, signal, viewTransition } from '@nisli/core';

const items = signal([
  { id: 1, label: 'signal()' },
  { id: 2, label: 'each()' },
  { id: 3, label: 'component()' },
]);
const ascending = signal(true);

const rows = computed(() =>
  [...items.value].sort(
    (a, b) => (ascending.value ? 1 : -1) * a.label.localeCompare(b.label),
  ),
);

export const list = html`<ul>
  ${each(
    rows,
    // Keyed by id: a surviving row keeps its DOM element across a sort, and
    // that element identity is what `view-transition-name: match-element` uses.
    (row) => row.id,
    // The name is styled onto the PAINTED root. each() wraps every item in an
    // <each-item style="display: contents">, and a box-less element generates
    // no snapshot — a view-transition-name on the wrapper does nothing.
    (row) => html`<li data-vt-list-item>${computed(() => row.value.label)}</li>`,
  )}
</ul>`;

export function toggleOrder(): void {
  // The state write is wrapped, not the render. viewTransition() calls flush()
  // inside the browser's update callback, so the computed re-derives and each()
  // reconciles inside the capture window instead of on the next microtask.
  viewTransition(() => { ascending.value = !ascending.value; }, { types: ['reorder'] });
}
