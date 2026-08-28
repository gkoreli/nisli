/**
 * Row — the first building block the engine owns.
 *
 * Authored as a typed factory: `Row({ align: 'between', children: [...] })`.
 * Children declare how they may give way through `declareItem()` in their own
 * setup — a typed call, resolved through nisli's element context to the
 * nearest Row. No attribute is authored anywhere; the attributes and inline
 * sizes this file writes are the engine's OUTPUT, the compiled form the
 * browser executes.
 *
 * One solve is: read every flex item's max-content once (a single layout),
 * `allocate()` in TypeScript, write the plan (a single batch). The browser
 * never decides who shrinks; flex is told each item's exact basis.
 */

import { children, component, type ComponentAttrs, createContext, html, onCleanup, onMount } from '@nisli/core';
import type { AlignKind, Priority, Strategy } from '../contracts.js';
import { allocate, type RowAction, type RowItem, type RowPlan } from './allocate.js';

export type { RowAction, RowDecision, RowInput, RowItem, RowPlan } from './allocate.js';

/* ── What a child declares ───────────────────────────────────────────────── */

export interface ItemDeclaration {
  readonly priority?: Priority;
  readonly collapse?: Strategy;
  readonly grow?: boolean;
  /** For `truncate`: the fewest characters worth showing before an ellipsis. */
  readonly minChars?: number;
}

interface Registered {
  readonly element: HTMLElement;
  readonly declaration: ItemDeclaration;
}

export interface RowScope {
  register(entry: Registered): () => void;
  registerTrigger(element: HTMLElement): () => void;
  /** Re-solve now. Anything that changes an item's content without resizing the row calls this. */
  solve(): void;
}

export const RowContext = createContext<RowScope>('intent.Row');

const DEFAULT_PRIORITY: Priority = 3;
const DEFAULT_MIN_CHARS = 4;

/**
 * Declare the calling component as an item of the nearest enclosing Row.
 * `element` is the component's rendered box — the flex item — not its
 * transparent host. Outside any Row this is a no-op, so a primitive can
 * declare unconditionally.
 */
export function declareItem(host: HTMLElement, element: () => HTMLElement | null | undefined, declaration: ItemDeclaration): void {
  // Resolved at setup, from the PARENT: the context walk is inclusive of its
  // start, and a Row declaring itself must not find its own scope.
  const scope = enclosingRow(host);
  onMount(() => {
    const el = element();
    if (!scope || !el) return;
    return scope.register({ element: el, declaration });
  });
}

function enclosingRow(host: HTMLElement): RowScope | undefined {
  const from = host.parentElement;
  return from ? RowContext.inject.optional(from) : undefined;
}

/** Declare the calling component's element as the row's overflow trigger. */
export function declareTrigger(host: HTMLElement, element: () => HTMLElement | null | undefined): void {
  const scope = enclosingRow(host);
  onMount(() => {
    const el = element();
    if (!scope || !el) return;
    return scope.registerTrigger(el);
  });
}

/* ── Reading the plan back ───────────────────────────────────────────────── */

const plans = new WeakMap<HTMLElement, RowPlan>();

/** The last plan the engine applied to this row's element, for `explain()` and tests. */
export function planOf(row: HTMLElement): RowPlan | undefined {
  return plans.get(row);
}

/* ── The DOM adapter ─────────────────────────────────────────────────────── */

/** The boxes flex actually lays out: descend through `display: contents` hosts and wrappers. */
function flexItems(container: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (el: Element): void => {
    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue;
      if (getComputedStyle(child).display === 'contents') visit(child);
      else out.push(child);
    }
  };
  visit(container);
  return out;
}

function reset(el: HTMLElement): void {
  el.style.flex = '0 0 auto';
  el.style.inlineSize = 'max-content';
  el.style.minInlineSize = '';
  el.style.boxSizing = 'border-box';
  el.removeAttribute('data-truncate');
  el.removeAttribute('data-reflow');
  el.removeAttribute('data-hidden');
  el.removeAttribute('data-collapsed');
}

function contentInline(container: HTMLElement): number {
  const style = getComputedStyle(container);
  return container.clientWidth - parseFloat(style.paddingInlineStart) - parseFloat(style.paddingInlineEnd);
}

function apply(el: HTMLElement, size: number, action: RowAction): void {
  switch (action) {
    case 'reflow':
      // The receipt: this text wraps because the engine decided it should.
      el.setAttribute('data-reflow', '');
      el.style.inlineSize = `${size}px`;
      el.style.minInlineSize = '0';
      return;
    case 'hide':
      el.setAttribute('data-hidden', '');
      return;
    case 'menu':
      el.setAttribute('data-collapsed', '');
      return;
    case 'truncate':
      el.setAttribute('data-truncate', '');
      el.style.inlineSize = `${size}px`;
      el.style.minInlineSize = '0';
      return;
    case 'grow':
      el.style.inlineSize = `${size}px`;
      return;
    case 'keep':
      return;
  }
}

function solveRow(container: HTMLElement, registered: Set<Registered>, trigger: HTMLElement | null): RowPlan {
  const items = flexItems(container).filter((el) => el !== trigger);
  const byElement = new Map<HTMLElement, ItemDeclaration>();
  for (const r of registered) byElement.set(r.element, r.declaration);

  // WRITE 1: reset to the measuring state. One batch, then one layout.
  for (const el of items) reset(el);
  // The trigger's flex item is the registered element; what the theme reveals
  // is the `[data-overflow]` control, which may be that element or inside it.
  const control = trigger ? (trigger.matches('[data-overflow]') ? trigger : (trigger.querySelector<HTMLElement>('[data-overflow]') ?? trigger)) : null;
  if (trigger && control) {
    trigger.style.flex = '0 0 auto';
    trigger.style.inlineSize = 'max-content';
    control.toggleAttribute('data-shown', true);
  }

  // READ: everything, once.
  const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
  const available = contentInline(container);
  const triggerWidth = trigger ? trigger.getBoundingClientRect().width : 0;
  const maxes = items.map((el) => el.getBoundingClientRect().width);

  // READ 2, only for flexible items: their floor is min-content, which the
  // browser answers in one more layout. Rigid and truncating items need no
  // second read — their floors are their max or a fraction of it.
  const flexible = items.filter((el) => byElement.get(el)?.grow === true && byElement.get(el)?.collapse !== 'truncate');
  for (const el of flexible) el.style.inlineSize = 'min-content';
  const floors = new Map<HTMLElement, number>();
  for (const el of flexible) floors.set(el, el.getBoundingClientRect().width);

  const rowItems: RowItem[] = items.map((el, index) => {
    const d = byElement.get(el) ?? {};
    const max = maxes[index]!;
    const chars = (el.textContent ?? '').trim().length;
    const minChars = d.minChars ?? DEFAULT_MIN_CHARS;
    let min = max;
    if (d.collapse === 'truncate' && chars > 0) min = Math.min(max, (max / chars) * (minChars + 1));
    else if (floors.has(el)) min = Math.min(max, floors.get(el)!);
    return { id: String(index), priority: d.priority ?? DEFAULT_PRIORITY, strategy: d.collapse, grow: d.grow === true, max, min };
  });

  const plan = allocate({ available, gap, trigger: triggerWidth, items: rowItems });

  // WRITE 2: the plan. One batch.
  for (const el of flexible) el.style.inlineSize = 'max-content';
  plan.decisions.forEach((decision, index) => apply(items[index]!, decision.size, decision.action));
  if (control) control.toggleAttribute('data-shown', plan.menu);
  container.setAttribute('data-fit', plan.state);
  container.setAttribute('data-collapsed-count', String(plan.decisions.filter((d) => d.action === 'menu' || d.action === 'hide').length));
  plans.set(container, plan);
  return plan;
}

/* ── The component ───────────────────────────────────────────────────────── */

export interface RowProps {
  align?: AlignKind;
  /** Landmark or list semantics for the rendered box. */
  role?: 'list' | 'listitem' | 'group' | 'navigation' | 'toolbar';
  label?: string;
  /** This row as an item of an enclosing row. */
  priority?: Priority;
  collapse?: Strategy;
  grow?: boolean;
  children?: unknown;
}

const rowAttrs = {
  align: 'string',
  role: 'string',
  label: 'string',
  priority: 'number',
  collapse: 'string',
  grow: 'boolean',
} satisfies ComponentAttrs<RowProps>;

export const Row = component<RowProps, typeof rowAttrs>(
  'intent-row',
  (props, host) => {
    host.style.display = 'contents';
    const registered = new Set<Registered>();
    let trigger: HTMLElement | null = null;
    let container: HTMLElement | null = null;
    let last: string | null = null;

    const solve = (): void => {
      if (!container || !container.isConnected) return;
      const plan = solveRow(container, registered, trigger);
      last = JSON.stringify(plan);
    };

    const observer = new ResizeObserver(() => {
      if (!container) return;
      // A solve changes children, never the row's inline size; the observer
      // fires for the block-size change that follows. Re-solving yields the
      // same plan and stops, so the loop is bounded by the plan converging.
      const before = last;
      solve();
      if (last === before) return;
    });

    const scope: RowScope = {
      register(entry) {
        registered.add(entry);
        queueMicrotask(solve);
        return () => {
          registered.delete(entry);
          queueMicrotask(solve);
        };
      },
      registerTrigger(element) {
        trigger = element;
        queueMicrotask(solve);
        return () => {
          trigger = null;
        };
      },
      solve,
    };
    RowContext.provide(host, scope);

    // The row declares itself to any enclosing row, with the same vocabulary.
    declareItem(host, () => container ?? undefined, {
      priority: props.priority.value,
      collapse: props.collapse.value,
      grow: props.grow.value,
    });

    onMount(() => {
      container = host.firstElementChild as HTMLElement | null;
      if (!container) return;
      // Not a query container. `[data-fit]` in the theme opts into inline-size
      // containment for container queries, and size containment makes an
      // element's intrinsic inline size ZERO — so a row inside a Wrap (a
      // shrink-to-fit parent) laid out at 0px. The engine sizes this row's
      // items itself; it needs no container query and must not pay for one.
      container.style.containerType = 'normal';
      solve();
      observer.observe(container);
    });
    onCleanup(() => observer.disconnect());

    return html`<div
      data-component="intent-row"
      data-layout="row"
      data-align=${props.align}
      data-grow=${props.grow}
      role=${props.role}
      aria-label=${props.label}
    >${children()}</div>`;
  },
  { attrs: rowAttrs },
);
