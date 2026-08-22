/**
 * packages/framework/ — Public API barrel export
 *
 * This is the single import point for all framework primitives.
 *
 * ```ts
 * import {
 *   signal, computed, effect, flush,
 *   component, html, when,
 *   inject, provide,
 *   Emitter,
 *   query, QueryClient,
 * } from './framework';
 * ```
 */

// ── Reactivity ──────────────────────────────────────────────────────
export {
  signal,
  computed,
  effect,
  flush,
  tick,
  isSignal,
  flushEffects,
  untrack,
  SIGNAL_BRAND,
  type Signal,
  type ReadonlySignal,
  type Disposer,
} from './signal.js';

// ── Setup context ───────────────────────────────────────────────────
export {
  runWithContext,
  getCurrentComponent,
  hasContext,
  type ComponentHost,
} from './context.js';

// ── Typed event emitters ────────────────────────────────────────────
export { Emitter } from './emitter.js';

// ── Dependency injection (app-global) ───────────────────────────────
export {
  inject,
  provide,
  createToken,
  resetInjector,
  type Constructor,
  type InjectionToken,
} from './injector.js';

// ── Subtree-scoped context (DOM provide/inject) ─────────────────────
export {
  createContext,
  type Context,
  type Inject,
} from './element-context.js';

// ── Component model ─────────────────────────────────────────────────
export {
  component,
  type ReactiveProps,
  type AttrValueType,
  type SetupFunction,
  type ComponentFactory,
  type ComponentOptions,
  type AttrDecl,
  type ComponentAttrs,
  type PropInput,
  type HostAttrs,
} from './component.js';

// ── Template engine ─────────────────────────────────────────────────
export {
  html,
  el,
  when,
  each,
  raw,
  type RawHtml,
  type TemplateResult,
  type TypedEventHandler,
  type ElProps,
  type ElChild,
} from './template.js';

// ── Element refs ────────────────────────────────────────────────────
export {
  ref,
  isRef,
  type Ref,
} from './ref.js';

// ── Lifecycle hooks ─────────────────────────────────────────────────
export {
  onMount,
  onCleanup,
  useHostEvent,
} from './lifecycle.js';

// ── Content projection (ADR 0025 item 1) ────────────────
export {
  children,
} from './projection.js';

// ── Declarative data loading (keyed logical-request store) ──────────
export {
  query,
  QueryClient,
  type QueryResult,
  type QueryOptions,
  type QueryKey,
  type QueryKeyElement,
  type QueryStatus,
  type QueryFetcher,
} from './query.js';

// ── Local async derivations ─────────────────────────────────────────
export {
  resource,
  type ResourceResult,
} from './resource.js';

// ── Async quiescence (test/verify + SSG pre-snapshot barrier) ───────
export { settle } from './settle.js';
