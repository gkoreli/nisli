/**
 * component.ts — Web component shell with typed props and factory composition
 *
 * `component()` is the single entry point for defining components.
 * It registers a custom element and returns a typed factory function.
 *
 * Component authors write a setup function that receives typed props
 * (each wrapped as a Signal) and optionally the host element.
 * The setup function returns a TemplateResult from html`...`.
 *
 * The class internals (connectedCallback, etc.) are completely hidden.
 */

import { signal, effect, setContextHook, isSignal, untrack, type Signal, type ReadonlySignal } from './signal.js';
import { runWithContext, hasContext, getCurrentComponent, type ComponentHost } from './context.js';
import type { TemplateResult } from './template.js';
import { runMountCallbacks } from './lifecycle.js';

// Wire up effect auto-disposal: when effect() is called during component setup,
// auto-register the dispose function with the component host.
setContextHook(() => {
  if (hasContext()) {
    const comp = getCurrentComponent();
    return (disposer: () => void) => comp.addDisposer(disposer);
  }
  return null;
});

// ── Types ───────────────────────────────────────────────────────────

/**
 * Narrows one prop's reactive value to the runtime type its `attrs`
 * declaration guarantees (ADR 0025 candidate (b)). Only the two kinds core
 * reconciles to a NON-`undefined` runtime value narrow; everything else is
 * left as the author's `T` (= `P[K]`):
 *
 * - `'boolean'` / `{ type:'boolean' }` (any default) → `boolean` — a declared
 *   boolean is absent→`false`, never `undefined`.
 * - `{ type:'number'; default }` → `number` — the default guarantees a value.
 * - `'number'` / `{ type:'number' }` WITHOUT a default → `number | undefined`.
 * - `'string'` / `{ type:'string' }` / `'forward'` / undeclared → `T` unchanged
 *   (a string attr is genuinely absent→`undefined`; forwarding does not touch
 *   the value type).
 *
 * SOUND FALLBACK on an incompatible declaration: the narrowed runtime type is
 * applied ONLY when the declared kind and `NonNullable<T>` (the prop's author
 * type) agree EXACTLY — mutual assignability, BOTH directions. A one-way check
 * (`boolean extends NonNullable<T>`) is unsound: it would still narrow a
 * `boolean | string` prop to `boolean` (silently dropping `string`), and a
 * one-way check the other way would widen a literal `true`/`1` prop. So a
 * declaration is honored only when `NonNullable<T>` IS the kind — `boolean` for
 * a boolean declaration, `number` for a numeric one — via {@link IsExactKind}.
 * Every genuine mismatch or partial overlap (`boolean | string` declared
 * `'boolean'`, `'boolean'` on a `string` prop, a numeric decl on a boolean prop,
 * a literal `true`/`1` prop) falls back to `T` unchanged — never a compile-time
 * lie about the value. The whole registry declares props as exactly `boolean` /
 * `number`, so it narrows as before; only unions/literals/mismatches are refused.
 *
 * `D` is the declaration at that key (or `undefined` when the key is absent
 * from the `attrs` map, in which case the caller passes `T` through directly).
 */
export type AttrValueType<T, D> =
  D extends 'boolean' ? (IsExactKind<T, boolean> extends true ? boolean : T)
  : D extends { type: 'boolean' } ? (IsExactKind<T, boolean> extends true ? boolean : T)
  : D extends { type: 'number'; default: number } ? (IsExactKind<T, number> extends true ? number : T)
  : D extends 'number' ? (IsExactKind<T, number> extends true ? number | undefined : T)
  : D extends { type: 'number' } ? (IsExactKind<T, number> extends true ? number | undefined : T)
  : T;

/**
 * `true` iff `NonNullable<T>` is EXACTLY `K` — mutually assignable in both
 * directions (`NonNullable<T> extends K` AND `K extends NonNullable<T>`). The
 * tuple wrappers block distribution so `boolean` (`= true | false`) is compared
 * whole: `boolean | string` is NOT exactly `boolean` (fails the first arm), and
 * `true` is NOT exactly `boolean` (fails the second), so both are refused.
 */
type IsExactKind<T, K> =
  [NonNullable<T>] extends [K] ? ([K] extends [NonNullable<T>] ? true : false) : false;

/**
 * Maps a props interface to reactive signals, narrowed by the `attrs`
 * declaration `A` (ADR 0025 candidate (b)).
 *
 * Each prop `P[K]` becomes `Signal<AttrValueType<P[K], A[K]>>` when `K` is
 * declared in `A`, otherwise `Signal<P[K]>`. So a declared `'boolean'` types as
 * `Signal<boolean>` (not `Signal<boolean | undefined>`), retiring the
 * registry's `as boolean` stopgap. `A` defaults to `{}` (no declared keys →
 * every prop unchanged), so `ReactiveProps<P>` keeps its pre-candidate-(b)
 * meaning and existing single-argument uses are unaffected.
 *
 * Optionality is stripped (`-?`): the props Proxy always returns a signal,
 * even for props never set — an optional prop `variant?: T` is
 * `Signal<T | undefined>`, not `Signal<T> | undefined`.
 */
export type ReactiveProps<P, A extends ComponentAttrs<P> = {}> = {
  readonly [K in keyof P]-?: Signal<K extends keyof A ? AttrValueType<P[K], A[K]> : P[K]>;
};

/**
 * The setup function signature. Receives reactive props (narrowed by the
 * `attrs` declaration `A`) and the host element. Returns a TemplateResult to be
 * mounted into the component.
 */
export type SetupFunction<P, A extends ComponentAttrs<P> = {}> = (
  props: ReactiveProps<P, A>,
  host: HTMLElement,
) => TemplateResult;

/**
 * Accepts either a Signal<T> (reactive) or a plain T (static, auto-wrapped).
 * This eliminates the need to wrap static values in `signal()` at call sites.
 * See ADR 0009 Gap 4.
 */
export type PropInput<T> = T | Signal<T> | ReadonlySignal<T>;

/**
 * Host-level attributes that every factory accepts, independent of component props.
 * `class` is applied to the host element via classList — it does not collide with
 * the component's own class attribute or class:name directives.
 * See ADR 0009 Gap 3.
 */
export interface HostAttrs {
  class?: PropInput<string>;
}

/**
 * A factory function for type-safe component composition.
 * Props accept both Signal<T> (reactive) and plain T (static, auto-wrapped).
 * An optional second argument provides host-level attributes (class).
 */
export type ComponentFactory<P> = (
  props: { [K in keyof P]: PropInput<P[K]> },
  hostAttrs?: HostAttrs,
) => TemplateResult;

/**
 * Opt-in attribute reactivity declaration (ADR 0025 item 3).
 *
 * Declares how a host attribute maps onto a prop signal, subsuming userland
 * `attr()`/`boolAttr()`/`forwardedAttr()`. Unlike those (which read the
 * attribute once at setup), a declared attribute is `observedAttributes`-wired,
 * so `setAttribute()` AFTER mount writes the prop signal LIVE.
 *
 * - `'string'` — the attribute's string value (absent → `undefined`).
 * - `'boolean'` — OUR boolean semantics: bare/any value → `true`, literal
 *   `"false"` → `false`, absent → `false`.
 * - `'number'` — `Number(raw)`; absent → the default (else `undefined`); a
 *   non-numeric value behaves as absent → the default (else `undefined`), so a
 *   garbage attribute never propagates `NaN` into layout math.
 * - `{ type: 'boolean', default: true }` — as above but absent → the default
 *   (so a default-`true` flag can be opted out with `attr="false"`).
 * - `{ type: 'string', default: '…' }` — string with an absent-value default.
 * - `{ type: 'number', default: 0 }` — number with an absent-value default.
 * - `'forward'` — string semantics PLUS relocation: the attribute is removed
 *   from the (layout-transparent) host so `id`/`name` live only on the inner
 *   control (native form participation), matching `forwardedAttr()`.
 *
 * The observed attribute name is the kebab-case of the prop key (`className` ↔
 * `class-name`, `showOutsideDays` ↔ `show-outside-days`, `id` ↔ `id`). The
 * object forms accept an `attr` override for props whose native attribute is
 * NOT the kebab derivation — e.g. `readOnly: { type: 'boolean', attr: 'readonly' }`
 * (the native boolean attribute is `readonly`, not `read-only`). (v1.1)
 */
export type AttrDecl =
  | 'string'
  | 'boolean'
  | 'number'
  | 'forward'
  | { type: 'boolean'; default?: boolean; attr?: string }
  | { type: 'string'; default?: string; attr?: string }
  | { type: 'number'; default?: number; attr?: string };

/**
 * The `attrs` declaration map for a props interface `P`: prop keys → attribute
 * behavior. This is the type an `attrs` object satisfies; capture its literal
 * type with `typeof` and pass it as `component`'s second type argument to
 * unlock declared-type narrowing (ADR 0025 candidate (b)):
 *
 * ```ts
 * const attrs = { checked: 'boolean' } satisfies ComponentAttrs<SwitchProps>;
 * const Switch = component<SwitchProps, typeof attrs>('ui-switch', setup, { attrs });
 * //   inside setup: props.checked.value is `boolean`, not `boolean | undefined`
 * ```
 */
export type ComponentAttrs<P> = Partial<Record<Extract<keyof P, string>, AttrDecl>>;

/** Options for component() registration */
export interface ComponentOptions<P = unknown> {
  /** Custom error fallback renderer */
  onError?: (error: Error, host: HTMLElement) => TemplateResult | string;
  /**
   * Opt-in attribute reactivity (ADR 0025 item 3). Maps prop keys
   * to attribute declarations. Omitted entirely → zero cost (empty
   * `observedAttributes`, no `attributeChangedCallback` work).
   */
  attrs?: ComponentAttrs<P>;
}

// ── Attribute-reactivity helpers (ADR 0025 item 3) ───────

interface AttrEntry {
  /** camelCase prop key. */
  key: string;
  /** kebab-case observed attribute name. */
  attrName: string;
  decl: AttrDecl;
}

const camelToKebab = (s: string): string =>
  s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const declType = (decl: AttrDecl): 'string' | 'boolean' | 'number' | 'forward' =>
  typeof decl === 'string' ? decl : decl.type;

/** The observed attribute name: an explicit `attr` override, else kebab(key). */
const declAttrName = (key: string, decl: AttrDecl): string =>
  typeof decl === 'object' && decl.attr ? decl.attr : camelToKebab(key);

/** Resolve a raw attribute string (or null when absent) to the prop value. */
function resolveAttrValue(decl: AttrDecl, raw: string | null): unknown {
  const t = declType(decl);
  if (t === 'boolean') {
    const def =
      typeof decl === 'object' && 'default' in decl && decl.default !== undefined
        ? decl.default
        : false;
    if (raw === null) return def; // absent → declared default (else false)
    return raw !== 'false'; // bare/any → true, literal "false" → false
  }
  if (t === 'number') {
    const def = typeof decl === 'object' && 'default' in decl ? decl.default : undefined;
    if (raw === null) return def; // absent → declared default (else undefined)
    const n = Number(raw);
    // Garbage behaves as ABSENT → the declared default (else undefined). A
    // default exists to guarantee non-undefined; letting garbage fall to
    // literal undefined would reintroduce exactly what the default prevents.
    return Number.isNaN(n) ? def : n;
  }
  // 'string' | 'forward'
  if (raw === null) {
    return typeof decl === 'object' && 'default' in decl ? decl.default : undefined;
  }
  return raw;
}

// ── Internal component host ─────────────────────────────────────────

class ComponentHostImpl implements ComponentHost {
  element: HTMLElement;
  private disposers: (() => void)[] = [];
  private setupComplete = false;

  constructor(element: HTMLElement) {
    this.element = element;
  }

  addDisposer(fn: () => void): void {
    this.disposers.push(fn);
  }

  dispose(): void {
    for (const fn of this.disposers) {
      try { fn(); } catch (_) { /* swallow disposal errors */ }
    }
    this.disposers.length = 0;
  }
}

// ── Prop signal management via Proxy ────────────────────────────────

/**
 * Creates a Proxy-based props object that lazily creates signals
 * for each property on first access. When a parent sets a property
 * on the element, the Proxy intercepts it and updates (or creates)
 * the backing signal.
 */
function createPropsProxy<P>(): {
  props: ReactiveProps<P>;
  setProperty: (key: string, value: unknown) => void;
} {
  const signals = new Map<string, Signal<unknown>>();

  const getOrCreate = (key: string, initialValue?: unknown): Signal<unknown> => {
    let s = signals.get(key);
    if (!s) {
      s = signal(initialValue);
      signals.set(key, s);
    }
    return s;
  };

  const props = new Proxy({} as ReactiveProps<P>, {
    get(_target, key: string) {
      return getOrCreate(key);
    },
  });

  const setProperty = (key: string, value: unknown) => {
    const s = getOrCreate(key, value);
    s.value = value;
  };

  return { props, setProperty };
}

// ── component() — the main entry point ──────────────────────────────

/**
 * Define a web component with typed props and a setup function.
 *
 * Returns a typed factory function for compile-time-safe composition.
 *
 * ```ts
 * interface TaskItemProps {
 *   task: Task;
 *   selected: boolean;
 * }
 *
 * const TaskItem = component<TaskItemProps>('task-item', (props, host) => {
 *   const title = computed(() => props.task.value.title);
 *   return html`<div>${title}</div>`;
 * });
 *
 * // Factory usage:
 * TaskItem({ task: taskSignal, selected: isSelected })
 * ```
 */
export function component<
  P extends object = Record<string, never>,
  A extends ComponentAttrs<P> = {},
>(
  tagName: string,
  setup: SetupFunction<P, A>,
  // When `A` is explicitly given a non-empty attrs literal (the narrowing
  // opt-in), the options argument — carrying `attrs: A` — is REQUIRED: a
  // `component<P, typeof attrs>(tag, setup)` that types the props as narrowed but
  // never actually wires the attrs at runtime would be a compile-time lie. When
  // `A` is `{}` (the legacy default, no second type arg), options stays optional
  // exactly as before. `attrs` in that legacy branch is still validated as
  // `ComponentAttrs<P>` via `ComponentOptions<P>`.
  ...[options]: [keyof A] extends [never]
    ? [options?: ComponentOptions<P>]
    : [options: ComponentOptions<P> & { attrs: A }]
): ComponentFactory<P> {
  // Attribute-reactivity wiring (ADR 0025 item 3). Computed once
  // per component definition; empty when no `attrs` declared (→ zero cost).
  const attrEntries = new Map<string, AttrEntry>(); // by attrName
  const attrEntriesByKey = new Map<string, AttrEntry>(); // by prop key
  if (options?.attrs) {
    for (const key of Object.keys(options.attrs)) {
      const decl = (options.attrs as Record<string, AttrDecl>)[key]!;
      const attrName = declAttrName(key, decl);
      const entry: AttrEntry = { key, attrName, decl };
      attrEntries.set(attrName, entry);
      attrEntriesByKey.set(key, entry);
    }
  }
  const observedList = Array.from(attrEntries.keys());

  // The custom element class
  class FrameworkComponent extends HTMLElement {
    private _host: ComponentHostImpl | null = null;
    private _propsProxy: ReturnType<typeof createPropsProxy<P>> | null = null;
    private _mounted = false;
    private _templateResult: TemplateResult | null = null;
    private _errorTemplateResult: TemplateResult | null = null;
    private _teardownScheduled = false;
    // Props explicitly set via _setProp (factory / direct assignment) are
    // "pinned": an explicit prop wins, so attribute writes no longer overwrite
    // it. (Precedence ruling: prop-pins.)
    private _pinned = new Set<string>();
    // Guards our own removeAttribute() during 'forward' relocation from
    // re-entering attributeChangedCallback.
    private _relocating = false;

    /** The browser reads this once at define time. Empty → no callbacks. */
    static get observedAttributes(): string[] {
      return observedList;
    }

    constructor() {
      super();
      this._propsProxy = createPropsProxy<P>();
    }

    /** Write one declared attribute onto its prop signal, honoring pinning. */
    private _applyAttr(entry: AttrEntry, raw: string | null): void {
      if (declType(entry.decl) === 'forward') {
        // Relocate off the layout-transparent host (no duplicate id/name), but
        // only adopt the attribute's value when no explicit prop pinned it. A
        // null `raw` here (absent OR already-relocated) is a NO-OP: the seed
        // and attributeChangedCallback must not clobber an adopted value. The
        // explicit unpin path (in _setProp) handles clearing.
        if (raw !== null) {
          if (!this._pinned.has(entry.key)) {
            this._propsProxy!.setProperty(entry.key, raw);
          }
          this._relocating = true;
          this.removeAttribute(entry.attrName);
          this._relocating = false;
        }
        return;
      }
      if (this._pinned.has(entry.key)) return; // explicit prop wins
      this._propsProxy!.setProperty(entry.key, resolveAttrValue(entry.decl, raw));
    }

    /** Seed initial prop values from current attributes (incl. defaults). */
    private _seedAttrs(): void {
      for (const entry of attrEntries.values()) {
        this._applyAttr(entry, this.getAttribute(entry.attrName));
      }
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
      if (this._relocating) return;
      const entry = attrEntries.get(name);
      if (entry) this._applyAttr(entry, next);
    }

    connectedCallback() {
      if (this._mounted) return; // guard against re-connection
      this._mounted = true;

      // Isolate activeObserver: child component setup signal reads must NOT
      // leak into a parent effect's dependency set. Without this, a parent
      // effect running replaceChildren/appendChild triggers child
      // connectedCallback synchronously, and child signal reads would be
      // tracked as parent dependencies — causing infinite re-render loops.
      // See ADR 0008 Gap 1 / ADR 0009.
      untrack(() => {
        const host = new ComponentHostImpl(this);
        this._host = host;

        // Canonical pre-setup order: SEED → CAPTURE → CONTEXT (then setup).
        //
        // SEED (ADR 0025 item 3): write prop signals from current
        // attributes (incl. declared defaults and 'forward' relocation) so setup
        // sees correct initial values. No-op when no attrs are declared.
        if (attrEntries.size) this._seedAttrs();

        // CAPTURE (ADR 0025 item 1): snapshot the host's light-DOM
        // children so children() can project them. Snapshot only — children()
        // removes/projects on demand — so non-projecting components are
        // untouched. Zero-cost when the host has no light DOM.
        if (this.childNodes.length) {
          (this as unknown as { __capturedChildren?: Node[] }).__capturedChildren =
            Array.from(this.childNodes);
        }

        try {
          // CONTEXT is established by runWithContext(host, …) below; setup then
          // runs with seed + capture already in place.
          runWithContext(host, () => {
            // The Proxy is runtime-untyped; the declared narrowing (A) is a
            // compile-time view the setup function requested (ADR 0025 (b)).
            this._templateResult = setup(
              this._propsProxy!.props as ReactiveProps<P, A>,
              this,
            );
          });

          // Mount the template result
          if (this._templateResult) {
            mountTemplate(this, this._templateResult, host);
          }

          // Run onMount() callbacks — DOM is now committed
          runMountCallbacks(host);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.error(`Component <${tagName}> setup error:`, error);

          // Setup may already have registered effects/lifecycle cleanup, or
          // mountTemplate() may have partially installed bindings before
          // throwing. Tear that partial scope down BEFORE mounting the error
          // fallback so no hidden work survives behind it (issue 0010).
          if (this._templateResult?.dispose) {
            this._templateResult.dispose();
          }
          this._templateResult = null;
          host.dispose();
          this._host = null;
          this.replaceChildren();

          if (options?.onError) {
            try {
              const fallback = options.onError(error, this);
              if (typeof fallback === 'string') {
                this.innerHTML = fallback;
              } else {
                this._errorTemplateResult = fallback;
                mountTemplate(this, fallback);
              }
            } catch (_) {
              if (this._errorTemplateResult?.dispose) {
                this._errorTemplateResult.dispose();
              }
              this._errorTemplateResult = null;
              this.innerHTML = `<div style="color:red;padding:4px">Error in &lt;${tagName}&gt;</div>`;
            }
          } else {
            this.innerHTML = `<div style="color:red;padding:4px">Error in &lt;${tagName}&gt;</div>`;
          }
        }
      });
    }

    disconnectedCallback() {
      // A same-tick remove+reinsert is a MOVE, not a removal: per WHATWG,
      // append-based moves fire disconnected+connected (only moveBefore()
      // preserves state). Moves happen routinely inside the framework —
      // each() keyed reorders, light-DOM projection of nested components —
      // and re-running setup on them duplicates rendered output and loses
      // state. Defer teardown one microtask and skip it if the element is
      // connected again; connectedCallback's _mounted guard then makes the
      // whole move a no-op. True removals still dispose, one microtask
      // later. See ADR 0023.
      if (this._teardownScheduled) return;
      this._teardownScheduled = true;
      queueMicrotask(() => {
        this._teardownScheduled = false;
        if (this.isConnected) return;
        this._teardownNow();
      });
    }

    /**
     * Synchronously dispose the current component scope and restore any
     * projected light-DOM children as direct host children. Normal disconnect
     * calls this after the move-detection microtask; HMR calls it directly so
     * reconnect cannot be defeated by the `_mounted` guard (issues 0001/0002).
     */
    private _teardownNow(): void {
      this._mounted = false;
      if (this._templateResult?.dispose) {
        this._templateResult.dispose();
      }
      this._templateResult = null;
      if (this._errorTemplateResult?.dispose) {
        this._errorTemplateResult.dispose();
      }
      this._errorTemplateResult = null;
      if (this._host) {
        this._host.dispose();
        this._host = null;
      }

      // children() records the plain light-DOM nodes it owns during cleanup.
      // Replacing the rendered tree with those nodes preserves author content
      // for a later true reconnect/HMR setup; components without projection
      // simply become empty before the fresh setup appends its new subtree.
      const captured = (this as unknown as { __capturedChildren?: Node[] })
        .__capturedChildren ?? [];
      this.replaceChildren(...captured);
    }

    /** @internal — transport-agnostic HMR in-place remount hook. */
    _remount(): void {
      this._teardownScheduled = false;
      this._teardownNow();
      this.connectedCallback();
    }

    /**
     * Set a prop value. Called by the factory and by direct property assignment.
     * The Proxy intercepts and creates/updates backing signals.
     *
     * Precedence = DEFINED-write-pins (ADR 0025 item 3): a defined
     * value pins the key so a declared attribute no longer overwrites it. An
     * explicit `undefined` (e.g. a factory spreading an unset optional prop —
     * `{...opts}` fires _setProp(key, undefined) per the Object.entries walk)
     * must NOT pin; it falls back to the declared attribute/default, matching
     * attr()'s coalesce. For a declared attribute, that fallback re-resolves
     * from the current attribute, keeping declared-default booleans
     * non-undefined.
     */
    _setProp(key: string, value: unknown): void {
      if (value === undefined) {
        this._pinned.delete(key);
        const entry = attrEntriesByKey.get(key);
        if (entry) {
          const raw = this.getAttribute(entry.attrName);
          // A 'forward' attribute is removed from the host on adoption, so an
          // unpin can't re-read it — resolve the absent value directly to CLEAR
          // a previously pinned id/name (rev audit fix). _applyAttr's forward
          // branch deliberately no-ops on absent (so the seed/attr callback
          // never clobber an adopted value); the explicit unpin does not.
          if (raw === null && declType(entry.decl) === 'forward') {
            this._propsProxy?.setProperty(key, resolveAttrValue(entry.decl, null));
          } else {
            this._applyAttr(entry, raw);
          }
          return;
        }
      } else {
        this._pinned.add(key);
      }
      this._propsProxy?.setProperty(key, value);
    }

    /**
     * Read a prop's backing signal (framework-internal). Used by children()
     * to fold the factory `children` prop into the projection slot (ADR 0025
     * item 1) without a new public read API.
     */
    _propSignal(key: string): Signal<unknown> {
      return (this._propsProxy!.props as Record<string, Signal<unknown>>)[key]!;
    }

    /**
     * Whether a prop is currently pinned by a defined factory/property write
     * (framework-internal, like _propSignal). The attribute-as-truth open-state
     * pattern needs this as its controlled-mode discriminator: a declared
     * 'boolean' prop is never undefined (absent → false), so pin state is the
     * ONLY way a component can tell "parent drives this" from "the attribute
     * drives this" — e.g. setOpen() must not write the open attribute while a
     * controlled parent has it pinned, or the DOM attribute diverges from the
     * pinned state until the next prop write.
     */
    _isPinned(key: string): boolean {
      return this._pinned.has(key);
    }
  }

  // Register the custom element (if not already registered)
  if (!customElements.get(tagName)) {
    customElements.define(tagName, FrameworkComponent);
  }

  // Return the typed factory function
  const factory: ComponentFactory<P> = (props, hostAttrs?) => {
    return {
      __type: 'factory' as const,
      tagName,
      props: props as Record<string, PropInput<unknown>>,
      hostAttrs,
    } as unknown as TemplateResult;
  };

  return factory;
}

/**
 * Ensure a value is a signal. If it already is, return as-is.
 * If it's a plain value, wrap it in signal().
 * Used by factory mount to support PropInput<T> = T | Signal<T>.
 */
function ensureSignal<T>(value: PropInput<T>): ReadonlySignal<T> {
  if (isSignal(value)) return value as ReadonlySignal<T>;
  return signal(value as T);
}

/**
 * Mount a TemplateResult into a host element.
 * This is the bridge between component.ts and template.ts.
 * Template.ts will provide the actual implementation via the
 * TemplateResult.mount() method.
 *
 * @param hostImpl — optional ComponentHostImpl for registering disposers
 */
function mountTemplate(host: HTMLElement, result: TemplateResult, hostImpl?: ComponentHostImpl): void {
  if (result && typeof result === 'object' && 'mount' in result && typeof result.mount === 'function') {
    result.mount(host);
  } else if (result && typeof result === 'object' && '__type' in result) {
    // Factory result — create the child element
    const factoryResult = result as unknown as {
      __type: 'factory';
      tagName: string;
      props: Record<string, PropInput<unknown>>;
      hostAttrs?: HostAttrs;
    };
    const el = document.createElement(factoryResult.tagName);

    // Forward props as signals (auto-wrap plain values)
    for (const [key, raw] of Object.entries(factoryResult.props)) {
      const sig = ensureSignal(raw);
      (el as any)._setProp(key, sig.value);
      // Subscribe to signal changes to update the child's props
      const unsub = sig.subscribe((newVal: unknown) => {
        (el as any)._setProp(key, newVal);
      });
      // Register unsub for cleanup on disconnect
      if (hostImpl) {
        hostImpl.addDisposer(unsub);
      }
    }

    // Apply host-level attributes (class)
    if (factoryResult.hostAttrs?.class != null) {
      const classSig = ensureSignal(factoryResult.hostAttrs.class);
      // Apply initial value
      applyHostClass(el, '', classSig.value);
      // Subscribe to reactive changes
      let prevClass = classSig.value;
      const unsub = classSig.subscribe((newClass: string) => {
        applyHostClass(el, prevClass, newClass);
        prevClass = newClass;
      });
      if (hostImpl) {
        hostImpl.addDisposer(unsub);
      }
    }

    host.appendChild(el);
  }
}

/**
 * Apply a class string to an element via classList, replacing the previous
 * class string's classes. Uses add/remove to avoid interfering with classes
 * set by the component's own template (class:name directives, etc.).
 */
function applyHostClass(el: Element, prev: string, next: string): void {
  const prevClasses = prev ? prev.split(/\s+/).filter(Boolean) : [];
  const nextClasses = next ? next.split(/\s+/).filter(Boolean) : [];
  for (const cls of prevClasses) {
    if (!nextClasses.includes(cls)) el.classList.remove(cls);
  }
  for (const cls of nextClasses) {
    if (!prevClasses.includes(cls)) el.classList.add(cls);
  }
}
