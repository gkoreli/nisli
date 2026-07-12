/**
 * element-context.ts — subtree-scoped context (provide / inject).
 *
 * The DOM-native equivalent of React/Radix context: a provider publishes a
 * typed value on its host element, and descendant components `inject()` it by
 * walking up the element tree. It replaces the userland `host.__uiX = state` +
 * `host.closest('ui-x')` convention (stringly-typed, invisible to TypeScript,
 * re-implemented per family) with an identity-keyed, end-to-end-typed primitive.
 *
 * ```ts
 * interface TabsState { value: ReadonlySignal<string>; setValue(v: string): void }
 * const TabsContext = createContext<TabsState>('Tabs');
 *
 * // provider setup:
 * TabsContext.provide(host, state);
 *
 * // descendant setup:
 * const tabs = TabsContext.inject();          // throws (error boundary) if absent
 * const maybe = TabsContext.inject.optional(); // TabsState | undefined
 * ```
 *
 * Design (see ADR 0025 §2):
 *
 * - **Typed, no string keys.** Each `createContext` mints a private `Symbol`
 *   used as the storage key; consumers reference the context object, never a
 *   string. Two contexts never collide even with the same `name` (name is for
 *   diagnostics only).
 *
 * - **Capture at setup, not at lookup.** `inject()` resolves during component
 *   setup, while the injecting host is still a DOM descendant of its provider.
 *   It returns the value *once*; because provider values carry signals,
 *   reactivity flows through them with no further tree-walks. This is what makes
 *   it **portal-safe**: after a subtree is reparented to `<body>` (dialog, menu,
 *   …) the injected value is already held, so the component keeps resolving its
 *   ORIGINAL provider — a later walk from the portaled host would find nothing.
 *   `inject()` therefore requires an active setup context when no host is passed.
 *
 * - **Zero cost for non-users.** Providing sets one symbol property on the host;
 *   injecting is a `parentElement` walk. Components that use neither pay nothing,
 *   and there is no global registry to maintain.
 */

import { getCurrentComponent, hasContext } from './context.js';

// ── Types ───────────────────────────────────────────────────────────

export interface Inject<T> {
  /**
   * Resolve the nearest provider's value by walking up from `host` (default:
   * the current component's host, requiring a setup context). Throws if no
   * provider is found — in a component this surfaces via the error boundary.
   */
  (host?: HTMLElement): T;
  /** Like `inject()` but returns `undefined` instead of throwing when absent. */
  optional(host?: HTMLElement): T | undefined;
}

export interface Context<T> {
  /** Diagnostic label (error messages); not an identity key. */
  readonly name: string;
  /** Publish `value` on `host` so descendants can `inject()` it. */
  provide(host: HTMLElement, value: T): void;
  /** Resolve this context from a descendant (see {@link Inject}). */
  readonly inject: Inject<T>;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a subtree-scoped context. `name` is used only in diagnostics; the
 * context's identity (a private symbol) is what keys storage and lookup.
 */
export function createContext<T>(name: string): Context<T> {
  // Private per-context storage key. Not derived from `name`, so same-named
  // contexts stay distinct, and it never appears in userland.
  const KEY = Symbol(`nisli.context:${name}`);

  const store = (el: Element): Record<symbol, unknown> =>
    el as unknown as Record<symbol, unknown>;

  const provide = (host: HTMLElement, value: T): void => {
    store(host)[KEY] = value;
  };

  // Walk up the element tree (inclusive of `start`) to the nearest provider.
  // `parentElement` transparently crosses `display: contents` hosts.
  const find = (start: HTMLElement): T | undefined => {
    let el: Element | null = start;
    while (el) {
      if (KEY in el) return store(el)[KEY] as T;
      el = el.parentElement;
    }
    return undefined;
  };

  const startHost = (host: HTMLElement | undefined, caller: string): HTMLElement | null => {
    if (host) return host;
    if (!hasContext()) {
      throw new Error(
        `${caller} for context "${name}" was called without a host and outside component ` +
          `setup. Call it during setup (so the provider is resolved before any portal move), ` +
          `or pass an explicit host.`,
      );
    }
    return getCurrentComponent().element;
  };

  const inject = ((host?: HTMLElement): T => {
    const start = startHost(host, 'inject()')!;
    const found = find(start);
    if (found === undefined) {
      throw new Error(
        `Context "${name}" not found: <${start.tagName.toLowerCase()}> must be rendered ` +
          `inside a provider that calls ${name}Context.provide(host, …).`,
      );
    }
    return found;
  }) as Inject<T>;

  inject.optional = (host?: HTMLElement): T | undefined => {
    // Outside setup with no host: there is nothing to resolve from — undefined.
    if (!host && !hasContext()) return undefined;
    return find(startHost(host, 'inject.optional()')!);
  };

  return { name, provide, inject };
}
