/**
 * components/list-transition-demo.ts — the live half of the each() list
 * transition recipe on /docs/view-transitions.
 *
 * Static-first like everything else on this site: SSG renders the list in its
 * default order (a readable, no-JS baseline), and client/hydrate.ts replace-
 * mounts this same component into `[data-hydrate="list-transition"]` so the
 * controls come alive. In `pnpm dev` the SPA renders it live from the start.
 *
 * The recipe itself is three decisions, all visible below:
 *
 *  1. `each()` keys rows by `id`, so a surviving row keeps its DOM element
 *     across a sort. That element identity is what `view-transition-name:
 *     match-element` (styles/view-transitions.css) keys off — no generated
 *     names, no per-item bookkeeping.
 *  2. The name is styled onto the row's PAINTED root, `[data-vt-list-item]` on
 *     the <li>. each() wraps every item in an `<each-item style="display:
 *     contents">`, and a box-less element generates no snapshot, so a name on
 *     the wrapper is silently ignored. This is the part that bites.
 *  3. The state write is what gets wrapped — `viewTransition(() => { sort.value
 *     = next }, { types: ['reorder'] })`. viewTransition() calls flush() inside
 *     the browser's update callback, so the computed re-derives and each()
 *     reconciles INSIDE the capture window rather than on the next microtask.
 *     Derived state composes with the primitive for free; nothing has to be
 *     hoisted into a plain signal to be animatable.
 *
 * Reduced motion is not consulted here on purpose. The transition still runs —
 * the swap stays atomic and `:active-view-transition-type(reorder)` stays
 * active — and the motion is neutralised in CSS.
 */
import { computed, each, html, signal, viewTransition, type TemplateResult } from '@nisli/core';

/**
 * The token recipe from @nisli/ui's `buttonVariants({ size: 'sm' })`, inlined.
 * It cannot be imported: pages/docs.ts pulls this module in eagerly, and
 * app-router.ts pulls pages/docs.ts in eagerly so vite.config.ts can share the
 * route catalog — while ui/button.js calls component() at load and needs a DOM.
 * Everything above this line stays DOM-free for that reason.
 */
const CONTROL = 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
const CONTROL_ON = `${CONTROL} bg-primary text-primary-foreground hover:bg-primary/90`;
const CONTROL_OFF = `${CONTROL} border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50`;

interface Primitive {
  id: string;
  label: string;
  group: 'Reactivity' | 'Templates' | 'Components';
}

/** Declaration order is the `grouped` sort — the order the docs teach them in. */
const PRIMITIVES: readonly Primitive[] = [
  { id: 'signal', label: 'signal()', group: 'Reactivity' },
  { id: 'computed', label: 'computed()', group: 'Reactivity' },
  { id: 'effect', label: 'effect()', group: 'Reactivity' },
  { id: 'html', label: 'html``', group: 'Templates' },
  { id: 'each', label: 'each()', group: 'Templates' },
  { id: 'when', label: 'when()', group: 'Templates' },
  { id: 'component', label: 'component()', group: 'Components' },
  { id: 'onMount', label: 'onMount()', group: 'Components' },
  { id: 'inject', label: 'inject()', group: 'Components' },
];

const SORTS = [
  { key: 'grouped', label: 'Grouped' },
  { key: 'asc', label: 'A–Z' },
  { key: 'desc', label: 'Z–A' },
] as const;

const GROUPS = ['All', 'Reactivity', 'Templates', 'Components'] as const;

type SortKey = (typeof SORTS)[number]['key'];
type GroupKey = (typeof GROUPS)[number];

export function ListTransitionDemo(): TemplateResult {
  const sort = signal<SortKey>('grouped');
  const group = signal<GroupKey>('All');

  const rows = computed(() => {
    const filtered = group.value === 'All'
      ? [...PRIMITIVES]
      : PRIMITIVES.filter((item) => item.group === group.value);
    if (sort.value === 'grouped') return filtered;
    const direction = sort.value === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => direction * a.label.localeCompare(b.label));
  });

  /**
   * One entry point for every mutation, so the transition type is impossible to
   * forget on a new control. A filter is a reorder too as far as the animation
   * is concerned: rows leave, rows arrive, survivors move.
   */
  const rearrange = (apply: () => void): void => {
    viewTransition(apply, { types: ['reorder'] });
  };

  return html`<div
    data-vt-list-demo
    class="mt-4 overflow-hidden rounded-xl border bg-card"
  >
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-muted/40 px-4 py-3">
      <div class="flex items-center gap-1.5" role="group" aria-label="Sort order">
        ${SORTS.map(
          (option) => html`<button
            type="button"
            class="${computed(() => (sort.value === option.key ? CONTROL_ON : CONTROL_OFF))}"
            aria-pressed="${computed(() => (sort.value === option.key ? 'true' : 'false'))}"
            @click=${() => rearrange(() => { sort.value = option.key; })}
          >
            ${option.label}
          </button>`,
        )}
      </div>
      <div class="flex items-center gap-1.5" role="group" aria-label="Filter by group">
        ${GROUPS.map(
          (name) => html`<button
            type="button"
            class="${computed(() => (group.value === name ? CONTROL_ON : CONTROL_OFF))}"
            aria-pressed="${computed(() => (group.value === name ? 'true' : 'false'))}"
            @click=${() => rearrange(() => { group.value = name; })}
          >
            ${name}
          </button>`,
        )}
      </div>
    </div>
    <ul class="divide-y">
      ${each(
        rows,
        (item) => item.id,
        // data-vt-list-item is the painted snapshot root; the display:contents
        // <each-item> wrapper around it cannot be snapshotted.
        (item) => html`<li
          data-vt-list-item
          class="flex items-center justify-between gap-4 bg-card px-4 py-2.5"
        >
          <span class="font-mono text-sm">${computed(() => item.value.label)}</span>
          <span class="text-xs text-muted-foreground">${computed(() => item.value.group)}</span>
        </li>`,
      )}
    </ul>
  </div>`;
}
