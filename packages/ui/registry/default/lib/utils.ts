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
 */
export function projectChildren(host: HTMLElement, root: Element, captured: Node[]): void {
  if (captured.length > 0) root.append(...captured);
  queueMicrotask(() => {
    for (const node of Array.from(host.childNodes)) {
      if (node !== root && !root.contains(node)) root.append(node);
    }
  });
}
