/*
 * A Navigation API test double — test support only, excluded from the build
 * (see tsconfig.build.json) and never published.
 *
 * happy-dom has no `window.navigation`, so unit tests need something to drive
 * `NavigationApiEngine` against. This models the parts of the API the engine
 * uses: the `navigate` event with its eligibility flags, `intercept()` with the
 * scroll/focus options recorded for assertions, the `navigatesuccess` /
 * `navigateerror` outcome events, per-navigation abort on supersession, an
 * entry stack with per-entry state, and traversal.
 *
 * It is a model, not the platform. Everything it proves is "the engine matches
 * this model of the Navigation API" — real-browser confidence is the Playwright
 * harness's job, not this file's.
 */

import type {
  NavigateEventLike,
  NavigationApiLike,
  NavigationApiType,
  NavigationHistoryEntryLike,
  NavigationInterceptOptions,
  NavigationNavigateOptions,
  NavigationResultLike,
} from './navigation-engine.js';

interface DoubleEntry {
  url: string;
  state: unknown;
}

/** What `intercept()` was called with, for assertions about scroll ownership. */
export interface InterceptRecord {
  readonly url: string;
  readonly navigationType: NavigationApiType;
  readonly scroll?: 'after-transition' | 'manual';
  readonly focusReset?: 'after-transition' | 'manual';
}

/** Knobs for simulating a navigation the page (not the router) started. */
export interface PageNavigationOptions {
  readonly sourceElement?: Element | null;
  readonly downloadRequest?: string | null;
  readonly formData?: unknown;
  readonly canIntercept?: boolean;
}

interface DispatchInput {
  readonly url: URL;
  readonly navigationType: NavigationApiType;
  readonly canIntercept: boolean;
  readonly info?: unknown;
  readonly state?: unknown;
  readonly downloadRequest?: string | null;
  readonly formData?: unknown;
  readonly sourceElement?: Element | null;
  /** Index to move to, for traversals. */
  readonly traverseTo?: number;
}

function rejected(message: string): NavigationResultLike {
  const error = new Error(message);
  const promise = Promise.reject(error);
  // Both handles are handed out already-handled so an ignored result never
  // surfaces as an unhandled rejection in the test run.
  promise.catch(() => undefined);
  return { committed: promise, finished: promise };
}

export class NavigationDouble implements NavigationApiLike {
  /** Every navigation this double intercepted, in order. */
  readonly intercepts: InterceptRecord[] = [];
  /** Every navigation the engine declined, left to the "browser". */
  readonly native: string[] = [];
  /** Outcome events fired, in order. */
  readonly outcomes: ('success' | 'error')[] = [];
  /** Set false to model an implementation without `NavigateEvent.sourceElement`. */
  reportsSourceElement = true;

  private entries: DoubleEntry[];
  private index = 0;
  private readonly navigateListeners = new Set<(event: NavigateEventLike) => void>();
  private readonly successListeners = new Set<() => void>();
  private readonly errorListeners = new Set<() => void>();
  private ongoing: { controller: AbortController; fail: (error: unknown) => void } | null = null;

  constructor(url: string = window.location.href) {
    this.entries = [{ url: new URL(url, window.location.href).href, state: null }];
  }

  get currentEntry(): NavigationHistoryEntryLike | null {
    const entry = this.entries[this.index];
    return entry === undefined ? null : { getState: () => entry.state };
  }

  /** Entry count, for "did that redirect replace or push?" assertions. */
  get length(): number {
    return this.entries.length;
  }

  get currentIndex(): number {
    return this.index;
  }

  navigate(url: string, options: NavigationNavigateOptions = {}): NavigationResultLike {
    const target = new URL(url, this.currentUrl());
    return this.dispatch({
      url: target,
      navigationType: options.history === 'replace' ? 'replace' : 'push',
      canIntercept: target.origin === new URL(this.currentUrl()).origin,
      info: options.info,
      state: options.state ?? null,
    });
  }

  back(): NavigationResultLike {
    if (this.index === 0) return rejected('Cannot go back');
    const entry = this.entries[this.index - 1]!;
    return this.dispatch({
      url: new URL(entry.url),
      navigationType: 'traverse',
      canIntercept: true,
      traverseTo: this.index - 1,
    });
  }

  forward(): NavigationResultLike {
    if (this.index >= this.entries.length - 1) return rejected('Cannot go forward');
    const entry = this.entries[this.index + 1]!;
    return this.dispatch({
      url: new URL(entry.url),
      navigationType: 'traverse',
      canIntercept: true,
      traverseTo: this.index + 1,
    });
  }

  /**
   * A navigation the page started — a link click, a form submission, or
   * `location.href =`. Carries no router `info`, so it faces the engine's
   * eligibility checks.
   */
  page(href: string, options: PageNavigationOptions = {}): NavigationResultLike {
    const target = new URL(href, this.currentUrl());
    const sameOrigin = target.origin === new URL(this.currentUrl()).origin;
    return this.dispatch({
      url: target,
      navigationType: 'push',
      canIntercept: options.canIntercept ?? sameOrigin,
      state: null,
      downloadRequest: options.downloadRequest ?? null,
      formData: options.formData ?? null,
      sourceElement: options.sourceElement ?? null,
    });
  }

  addEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  addEventListener(type: 'navigatesuccess' | 'navigateerror', listener: () => void): void;
  addEventListener(type: string, listener: (event: never) => void): void {
    if (type === 'navigate') this.navigateListeners.add(listener as (event: NavigateEventLike) => void);
    else if (type === 'navigatesuccess') this.successListeners.add(listener as () => void);
    else if (type === 'navigateerror') this.errorListeners.add(listener as () => void);
  }

  removeEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  removeEventListener(type: 'navigatesuccess' | 'navigateerror', listener: () => void): void;
  removeEventListener(type: string, listener: (event: never) => void): void {
    if (type === 'navigate') this.navigateListeners.delete(listener as (event: NavigateEventLike) => void);
    else if (type === 'navigatesuccess') this.successListeners.delete(listener as () => void);
    else if (type === 'navigateerror') this.errorListeners.delete(listener as () => void);
  }

  private currentUrl(): string {
    return this.entries[this.index]?.url ?? window.location.href;
  }

  private dispatch(input: DispatchInput): NavigationResultLike {
    // A new navigation supersedes the one in flight: its signal aborts and its
    // handles reject, exactly as the router's redirect hop relies on.
    this.abortOngoing();
    const controller = new AbortController();
    const current = new URL(this.currentUrl());
    const handlers: NavigationInterceptOptions[] = [];
    const event: NavigateEventLike = {
      navigationType: input.navigationType,
      destination: { url: input.url.href },
      canIntercept: input.canIntercept,
      hashChange: input.url.origin === current.origin
        && input.url.pathname === current.pathname
        && input.url.search === current.search
        && input.url.hash !== current.hash,
      downloadRequest: input.downloadRequest ?? null,
      formData: input.formData ?? null,
      info: input.info,
      signal: controller.signal,
      ...(this.reportsSourceElement ? { sourceElement: input.sourceElement ?? null } : {}),
      intercept: (options: NavigationInterceptOptions) => { handlers.push(options); },
    };

    let settleCommitted!: () => void;
    let settleFinished!: () => void;
    let failFinished!: (error: unknown) => void;
    const committed = new Promise<void>((resolve) => { settleCommitted = resolve; });
    const finished = new Promise<void>((resolve, reject) => { settleFinished = resolve; failFinished = reject; });
    // The engine is expected to handle these; a declined result nobody awaits
    // must not trip the runner's unhandled-rejection detection either.
    finished.catch(() => undefined);

    for (const listener of [...this.navigateListeners]) listener(event);

    if (handlers.length === 0) {
      // Declined. A same-document navigation still commits (the browser does
      // it natively); a cross-document one would replace this document
      // entirely, which the double records rather than simulates.
      this.native.push(input.url.href);
      if (event.hashChange || input.navigationType === 'traverse') this.commit(input);
      settleCommitted();
      this.fireSuccess();
      settleFinished();
      return { committed, finished };
    }

    this.commit(input);
    for (const options of handlers) {
      this.intercepts.push({
        url: input.url.href,
        navigationType: input.navigationType,
        scroll: options.scroll,
        focusReset: options.focusReset,
      });
    }
    settleCommitted();
    this.ongoing = { controller, fail: failFinished };
    void Promise.all(handlers.map((options) => options.handler()))
      .then(
        () => {
          if (controller.signal.aborted) return;   // superseded; already reported
          this.ongoing = null;
          this.fireSuccess();
          settleFinished();
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          this.ongoing = null;
          this.fireError();
          failFinished(error);
        },
      );
    return { committed, finished };
  }

  private commit(input: DispatchInput): void {
    const href = input.url.href;
    if (input.traverseTo !== undefined) {
      this.index = input.traverseTo;
      history.replaceState(null, '', href);
      return;
    }
    if (input.navigationType === 'replace') {
      this.entries[this.index] = { url: href, state: input.state ?? null };
      history.replaceState(null, '', href);
      return;
    }
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ url: href, state: input.state ?? null });
    this.index = this.entries.length - 1;
    history.pushState(null, '', href);
  }

  private abortOngoing(): void {
    const ongoing = this.ongoing;
    if (!ongoing) return;
    this.ongoing = null;
    ongoing.controller.abort();
    this.fireError();
    ongoing.fail(new Error('Navigation aborted'));
  }

  private fireSuccess(): void {
    this.outcomes.push('success');
    for (const listener of [...this.successListeners]) listener();
  }

  private fireError(): void {
    this.outcomes.push('error');
    for (const listener of [...this.errorListeners]) listener();
  }
}

/** Install the double as `globalThis.navigation`, as a browser would expose it. */
export function installNavigationDouble(url?: string): NavigationDouble {
  const double = new NavigationDouble(url);
  Object.defineProperty(globalThis, 'navigation', { value: double, configurable: true, writable: true });
  return double;
}

/** Remove the double so feature detection reports "no Navigation API" again. */
export function uninstallNavigationDouble(): void {
  delete (globalThis as { navigation?: unknown }).navigation;
}
