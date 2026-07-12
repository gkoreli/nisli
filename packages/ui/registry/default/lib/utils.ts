/**
 * lib/utils.ts — shared utilities for @nisli/ui components.
 *
 * Zero-dependency ports of the ideas behind clsx and
 * class-variance-authority (both MIT), plus custom-element interop
 * helpers for Nisli components (ADR 0022).
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { computed, type ReadonlySignal } from '@nisli/core';

// ── cn() — class name joiner ────────────────────────────────────────

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/**
 * Join class values into a single class string.
 * Accepts strings, arrays, and `{ class: condition }` records; skips
 * null/undefined/false. Conflicting Tailwind utilities are not
 * deduplicated — later entries win by CSS order, so pass overrides last.
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) collect(input, out);
  return out.join(' ');
}

function collect(input: ClassValue, out: string[]): void {
  if (input == null || input === false || input === '') return;
  if (typeof input === 'string' || typeof input === 'number') {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collect(item, out);
    return;
  }
  for (const [key, on] of Object.entries(input)) {
    if (on) out.push(key);
  }
}

// ── cv() — class variants (cva-style) ───────────────────────────────

type VariantShape = Record<string, Record<string, ClassValue>>;

/** `null`/`undefined` selections fall back to `defaultVariants` (cva parity). */
export type VariantSelection<V extends VariantShape> = {
  [K in keyof V]?: keyof V[K] | null | undefined;
};

export interface VariantConfig<V extends VariantShape> {
  variants: V;
  defaultVariants?: VariantSelection<V>;
  compoundVariants?: Array<VariantSelection<V> & { class: ClassValue }>;
}

/** Extract the selection type of a `cv()` result, like cva's VariantProps. */
export type VariantProps<T> = T extends (selection?: infer S) => string
  ? Omit<NonNullable<S>, 'className'>
  : never;

/**
 * Build a variant class resolver. shadcn/ui `cva(...)` variant maps port
 * onto this one-to-one:
 *
 * ```ts
 * const buttonVariants = cv('inline-flex ...', {
 *   variants: { variant: { default: '...', outline: '...' } },
 *   defaultVariants: { variant: 'default' },
 * });
 * buttonVariants({ variant: 'outline', className: 'w-full' })
 * ```
 */
export function cv<V extends VariantShape>(
  base: ClassValue,
  config?: VariantConfig<V>,
): (selection?: VariantSelection<V> & { className?: ClassValue }) => string {
  return (selection) => {
    const classes: ClassValue[] = [base];
    if (config) {
      const chosen: Record<string, unknown> = {};
      const picked = selection as Record<string, unknown> | undefined;
      const defaults = config.defaultVariants as Record<string, unknown> | undefined;
      for (const key of Object.keys(config.variants)) {
        const value = picked?.[key] ?? defaults?.[key];
        chosen[key] = value;
        if (value != null) {
          classes.push(config.variants[key]?.[value as string]);
        }
      }
      for (const compound of config.compoundVariants ?? []) {
        const { class: compoundClass, ...match } = compound;
        const matches = Object.entries(match).every(
          ([key, value]) => chosen[key] === value,
        );
        if (matches) classes.push(compoundClass);
      }
    }
    classes.push(selection?.className);
    return cn(...classes);
  };
}

// ── Custom-element interop helpers (ADR 0022 conventions) ───────────

/**
 * Make the custom-element host layout-transparent. Every @nisli/ui
 * component calls this first in setup: the host (`<ui-button>`) carries
 * no box; all styling lives on the component's inner root element.
 */
export function transparentHost(host: HTMLElement): void {
  host.style.display = 'contents';
}

/**
 * Read a component's internal pin-state — the controlled-vs-uncontrolled
 * discriminator for the attribute-as-truth open pattern (ADR 0025 item 3). A
 * declared `'boolean'` prop is never `undefined`, so pin state is the only
 * signal of whether a factory prop is driving (controlled) vs the attribute
 * (uncontrolled). Used by overlay roots so `setOpen` skips the attribute write
 * under controlled usage and the `defaultOpen` seed skips a pinned prop.
 */
export function isPinned(host: HTMLElement, key: string): boolean {
  return (host as unknown as { _isPinned?(k: string): boolean })._isPinned?.(key) ?? false;
}

/**
 * Resolve a prop with a host-attribute fallback, for plain-HTML usage
 * (`<ui-button variant="outline">`). The attribute is read once at
 * setup; an explicitly set prop always wins. Use kebab-case attribute
 * names for camelCase props (`className` ↔ `class-name`).
 */
export function attr<T extends string>(
  prop: ReadonlySignal<T | undefined>,
  host: HTMLElement,
  name: string,
): ReadonlySignal<T | undefined> {
  const fallback = (host.getAttribute(name) ?? undefined) as T | undefined;
  return computed(() => prop.value ?? fallback);
}

/**
 * Like `attr()`, but *moves* the host attribute onto the inner control:
 * the fallback is read once at setup and then removed from the host. Use it
 * for attributes that must live on the real form element rather than the
 * layout-transparent host — `id` and `name` — so that native form
 * participation works: `form.elements.namedItem('email')` resolves to the
 * inner `<input>`, and `<ui-label for="email">` + `label.control` bind to it.
 * Without the move, the id/name would be duplicated on both the host and the
 * inner control, and `document.getElementById` could resolve to the wrong one.
 * An explicitly set prop still wins.
 */
export function forwardedAttr<T extends string>(
  prop: ReadonlySignal<T | undefined>,
  host: HTMLElement,
  name: string,
): ReadonlySignal<T | undefined> {
  const fallback = (host.getAttribute(name) ?? undefined) as T | undefined;
  if (fallback !== undefined) host.removeAttribute(name);
  return computed(() => prop.value ?? fallback);
}

/**
 * Boolean variant of `attr()`. An explicitly set prop always wins; otherwise
 * the host attribute is the fallback, resolved at setup:
 *
 * - attribute **absent** → `defaultValue` (default `false`);
 * - attribute equal to the literal string `"false"` → `false`;
 * - attribute present with any other value (including empty) → `true`.
 *
 * The `"false"` coercion is what lets a default-`true` flag like a separator's
 * `decorative` be opted out of from plain HTML (`decorative="false"`), while a
 * default-`false` flag like `disabled` still opts in with a bare attribute
 * (`<ui-button disabled>`).
 */
export function boolAttr(
  prop: ReadonlySignal<boolean | undefined>,
  host: HTMLElement,
  name: string,
  defaultValue = false,
): ReadonlySignal<boolean> {
  const raw = host.getAttribute(name);
  const fallback = raw === null ? defaultValue : raw !== 'false';
  return computed(() => prop.value ?? fallback);
}

/**
 * Capture pre-existing light-DOM children for projection. Call in setup
 * before returning the template, then hand the nodes to
 * `projectChildren()` in `onMount`. This is how `<ui-button>Save</ui-button>`
 * gets its label inside the rendered `<button>`.
 */
export function captureChildren(host: HTMLElement): Node[] {
  const nodes = Array.from(host.childNodes);
  for (const node of nodes) host.removeChild(node);
  return nodes;
}

/**
 * Project light-DOM children into a single-root component's inner root
 * element: appends the nodes captured by `captureChildren()`, then sweeps
 * (in a microtask) any children a streaming parser appended to the host
 * after upgrade — needed when the element is defined before the document
 * finishes parsing.
 *
 * The `node.contains(root)` guard matters for nested components
 * (`<ui-alert><ui-alert-title>…`): a parent's sweep can move a child host
 * — and the just-mounted `root` inside it — before the child's own sweep
 * runs. Skipping any node that already contains `root` avoids the invalid
 * "append an ancestor into its own descendant" DOMException.
 */
export function projectChildren(host: HTMLElement, root: Element, captured: Node[]): void {
  if (captured.length > 0) root.append(...captured);
  queueMicrotask(() => {
    for (const node of Array.from(host.childNodes)) {
      if (node !== root && !root.contains(node) && !node.contains(root)) {
        root.append(node);
      }
    }
  });
}
