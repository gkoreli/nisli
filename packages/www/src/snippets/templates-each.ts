import { signal, computed, html, each } from '@nisli/core';

const items = signal([
  { id: 1, name: 'Signals' },
  { id: 2, name: 'Templates' },
]);

export const list = html`<ul>
  ${each(
    items,
    (item) => item.id,
    // Bind a LEAF computed, not item.value.name directly: a bare read would
    // subscribe the list's reconciler effect to the per-item signal, so the
    // whole list re-reconciles when one item changes.
    (item) => html`<li>${computed(() => item.value.name)}</li>`,
  )}
</ul>`;
