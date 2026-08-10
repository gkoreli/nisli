/**
 * injector.ts — Dependency injection: inject(), provide(), class-as-token
 *
 * Two key insights from Angular's evolution:
 * 1. The class IS the token — no createToken() needed for 99% of cases
 * 2. provide() is optional — inject() auto-creates singletons on first call
 *
 * ```ts
 * class BacklogAPI {
 *   async getTasks(): Promise<Task[]> { ... }
 * }
 *
 * // In component setup:
 * const api = inject(BacklogAPI); // auto-created singleton
 *
 * // In tests:
 * provide(BacklogAPI, () => new MockAPI());
 * ```
 */

import { hasContext, getCurrentComponent } from './context.js';
import { formatDiag, isDev } from './diagnostics.js';

// ── Types ───────────────────────────────────────────────────────────

/** Any class constructor — used as both the token and the type. */
export type Constructor<T = unknown> = new (...args: any[]) => T;

/** Opaque token for non-class dependencies (config objects, primitives). */
export interface InjectionToken<T> {
  readonly __brand: 'InjectionToken';
  readonly name: string;
  /** @internal default factory */
  _factory?: () => T;
}

// ── Global singleton registry ───────────────────────────────────────

/** Stores singleton instances keyed by constructor or token. */
const singletonCache = new Map<Constructor | InjectionToken<unknown>, unknown>();

/** Stores factory overrides from provide(). */
const factoryOverrides = new Map<Constructor | InjectionToken<unknown>, () => unknown>();

/** Tracks which constructors are currently being instantiated (circular detection). */
const instantiating = new Set<Constructor | InjectionToken<unknown>>();

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get or create a singleton instance of the given class.
 *
 * On first call: creates the instance via `new Class()` (or the
 * factory from provide(), if one exists). On subsequent calls:
 * returns the same instance.
 *
 * Can be called inside or outside component setup context.
 * When inside, the inject result is available for the component's lifetime.
 */
export function inject<T>(token: Constructor<T>): T;
export function inject<T>(token: InjectionToken<T>): T;
export function inject<T>(token: Constructor<T> | InjectionToken<T>): T {
  // Check cache first
  if (singletonCache.has(token)) {
    return singletonCache.get(token) as T;
  }

  // Circular dependency detection
  if (instantiating.has(token)) {
    const name = typeof token === 'function' ? token.name : (token as InjectionToken<T>).name;
    throw new Error(
      `Circular dependency detected when instantiating '${name}'. ` +
      'Check your service constructors for circular inject() calls.'
    );
  }

  instantiating.add(token);
  try {
    let instance: T;

    // Check for factory override
    const factory = factoryOverrides.get(token as Constructor | InjectionToken<unknown>);
    if (factory) {
      instance = factory() as T;
    } else if (typeof token === 'function') {
      // Class token — auto-create via constructor
      instance = new (token as Constructor<T>)();
    } else {
      // InjectionToken with default factory
      const injToken = token as InjectionToken<T>;
      if (injToken._factory) {
        instance = injToken._factory();
      } else {
        throw new Error(
          `No provider found for token '${injToken.name}'. ` +
          'Use provide() to register a factory before calling inject().'
        );
      }
    }

    singletonCache.set(token as Constructor | InjectionToken<unknown>, instance);
    return instance;
  } finally {
    instantiating.delete(token);
  }
}

/**
 * Register a factory override for a class or token.
 * The factory will be called on the next inject() if no cached instance exists.
 *
 * Call provide() before the first inject() of that token. Once a token has
 * been instantiated the injector is FROZEN for it (dev, coded error N501):
 * everything that already injected holds the old instance while later
 * inject() calls would get the new one — a silent mixed-instance split
 * (ADR 0030.2 §3). `resetInjector()` is the escape hatch (tests use it).
 * Production keeps the historical silent replace so a live page never breaks
 * over an ordering issue that dev already surfaced.
 */
export function provide<T>(token: Constructor<T>, factory: () => T): void;
export function provide<T>(token: InjectionToken<T>, factory: () => T): void;
export function provide<T>(token: Constructor<T> | InjectionToken<T>, factory: () => T): void {
  if (isDev() && singletonCache.has(token as Constructor | InjectionToken<unknown>)) {
    const name = typeof token === 'function' ? token.name : (token as InjectionToken<T>).name;
    throw new Error(formatDiag(
      'N501',
      `provide(${name}) after '${name}' was already instantiated — existing `
      + `consumers keep the old instance while new inject() calls would get the `
      + `new one (mixed-instance split). Call resetInjector() first (tests), or `
      + `provide() before the first inject().`,
    ));
  }
  factoryOverrides.set(token as Constructor | InjectionToken<unknown>, factory);
  // Remove cached instance so next inject() uses the new factory
  singletonCache.delete(token as Constructor | InjectionToken<unknown>);
}

/**
 * Create an injection token for non-class dependencies.
 * Use this for config objects, primitives, or interfaces.
 *
 * ```ts
 * const AppConfig = createToken<{ apiUrl: string }>('AppConfig');
 * provide(AppConfig, () => ({ apiUrl: '/api' }));
 * const config = inject(AppConfig);
 * ```
 */
export function createToken<T>(name: string, defaultFactory?: () => T): InjectionToken<T> {
  return {
    __brand: 'InjectionToken' as const,
    name,
    _factory: defaultFactory,
  };
}

/**
 * Reset the injector — clears all singletons and factory overrides.
 * Used in tests to ensure isolation between test cases.
 */
export function resetInjector(): void {
  singletonCache.clear();
  factoryOverrides.clear();
  instantiating.clear();
}
