import type {
  EngineNavigateOptions,
  EngineNavigationKind,
  EngineSink,
  NavigationDirection,
  NavigationEngine,
  ViewTransitionIntent,
} from './engine.js';
import type { RouteMatch } from './matcher.js';

/*
 * The slice of the Navigation API this engine uses, typed structurally.
 *
 * TypeScript's `lib.dom` has no Navigation API yet, and pulling
 * `@types/dom-navigation` in would rewrite the workspace lockfile for types
 * that only three files need. These interfaces describe exactly the members
 * the engine touches; the global is read through one checked accessor, so an
 * absent or partial implementation is a detection miss rather than a crash.
 */

export type NavigationApiType = 'push' | 'replace' | 'reload' | 'traverse';

export interface NavigationDestinationLike {
  readonly url: string;
  /**
   * History-stack index of the destination, or `-1` when the navigation
   * creates or replaces an entry rather than traversing to one. `undefined` on
   * an implementation that does not report it, which reads as `'unknown'`.
   */
  readonly index?: number;
}

export interface NavigationInterceptOptions {
  /** Runs the same-document transition; the browser ties its promise to the navigation. */
  readonly handler: () => Promise<void>;
  /** `manual` keeps the router's documented outlet-focus contract (RTR-3). */
  readonly focusReset?: 'after-transition' | 'manual';
  /** `after-transition` hands scroll restoration and fragment jumps to the browser. */
  readonly scroll?: 'after-transition' | 'manual';
}

export interface NavigateEventLike {
  readonly navigationType: NavigationApiType;
  readonly destination: NavigationDestinationLike;
  readonly canIntercept: boolean;
  readonly hashChange: boolean;
  readonly downloadRequest: string | null;
  readonly formData: unknown;
  /** Whatever `navigate()` passed as `info` — this engine passes its own marker. */
  readonly info?: unknown;
  /** Aborts when this navigation is superseded or cancelled. */
  readonly signal: AbortSignal;
  /**
   * The element that started the navigation, where the browser reports it.
   * `undefined` on implementations that predate it — hence the capture-phase
   * opt-out recorder below.
   */
  readonly sourceElement?: Element | null;
  intercept(options: NavigationInterceptOptions): void;
}

export interface NavigationResultLike {
  readonly committed: Promise<unknown>;
  readonly finished: Promise<unknown>;
}

export interface NavigationHistoryEntryLike {
  /** History-stack index of this entry — the other half of the direction oracle. */
  readonly index?: number;
  getState(): unknown;
}

export interface NavigationNavigateOptions {
  readonly history?: 'auto' | 'push' | 'replace';
  readonly state?: unknown;
  readonly info?: unknown;
}

export interface NavigationApiLike {
  readonly currentEntry: NavigationHistoryEntryLike | null;
  navigate(url: string, options?: NavigationNavigateOptions): NavigationResultLike;
  back(): NavigationResultLike;
  forward(): NavigationResultLike;
  addEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  addEventListener(type: 'navigatesuccess' | 'navigateerror', listener: () => void): void;
  removeEventListener(type: 'navigate', listener: (event: NavigateEventLike) => void): void;
  removeEventListener(type: 'navigatesuccess' | 'navigateerror', listener: () => void): void;
}

/** The `navigation` global, or `null` where the platform has none. */
export function navigationApi(): NavigationApiLike | null {
  const candidate = (globalThis as { navigation?: unknown }).navigation;
  if (candidate === null || typeof candidate !== 'object') return null;
  return candidate as NavigationApiLike;
}

/** Feature detection for `engine: 'auto'`. */
export function supportsNavigationApi(): boolean {
  const api = navigationApi();
  return api !== null
    && typeof api.navigate === 'function'
    && typeof api.addEventListener === 'function';
}

function requireNavigationApi(): NavigationApiLike {
  const api = navigationApi();
  if (api === null) throw new Error('NavigationApiEngine requires the Navigation API (window.navigation)');
  return api;
}

/** Swallow a rejection that is reported through another channel. */
function ignoreRejection(promise: Promise<unknown>): void {
  promise.then(undefined, () => undefined);
}

/**
 * Back/forward from the history-stack indices the API reports: the destination
 * index against the index of the entry being left. Only a traversal has a
 * destination index at all, so a push is forward by construction, a replace
 * moves nowhere, and anything unreported reads as unknown.
 */
function navigationDirection(
  type: NavigationApiType,
  destinationIndex: number | undefined,
  currentIndex: number | undefined,
): NavigationDirection {
  if (type !== 'traverse') return type === 'push' ? 'forward' : 'unknown';
  if (destinationIndex === undefined || currentIndex === undefined) return 'unknown';
  if (destinationIndex < 0 || currentIndex < 0 || destinationIndex === currentIndex) return 'unknown';
  return destinationIndex < currentIndex ? 'back' : 'forward';
}

/**
 * Per-navigation options the engine smuggles through `NavigateEvent.info`.
 * Identity is the marker: an `info` that is one of these came from
 * `Router.navigate()`, anything else came from the page (link click,
 * `location.href =`, a third party) and faces the eligibility checks.
 */
class RouterNavigateInfo {
  /**
   * The transition the intercept handler started, so `navigate()` can await the
   * whole chain — including a redirect hop that supersedes this navigation and
   * rejects its `finished` promise early.
   */
  transition: Promise<void> | null = null;
  constructor(
    readonly scroll: 'top' | 'preserve',
    readonly viewTransition: ViewTransitionIntent | undefined,
  ) {}
}

/**
 * The Navigation API engine (BET03 Phase 2): one `navigate` listener that
 * turns every same-origin navigation the router owns — link clicks,
 * `location.href =`, programmatic navigation, back/forward — into a
 * same-document transition via `navigation.intercept()`.
 *
 * What the History engine hand-emulates, the browser does here: per-entry
 * scroll memory, fragment jumps, traversal semantics, and a real per-navigation
 * `AbortSignal`. Click eligibility mostly disappears too — a different-navigable
 * click never reaches this window, cross-origin arrives with
 * `canIntercept: false`, downloads carry `downloadRequest`, and same-document
 * fragments carry `hashChange` — leaving one residue, `data-router-ignore`,
 * which needs to know which anchor was clicked.
 */
export class NavigationApiEngine implements NavigationEngine {
  /** The browser restores scroll and jumps to fragments, so the router applies none. */
  readonly ownsScrollRestoration = false;

  // Retained after disconnect for the same reason the History engine retains
  // it: navigating on a disconnected router must fail as a connection error.
  private sink: EngineSink | null = null;

  /**
   * Opt-out intent recorded by the capture-phase click listener, for
   * implementations whose `NavigateEvent` has no `sourceElement`.
   */
  private clickOptOut = false;

  /** The navigation currently being intercepted, cleared when it settles. */
  private inFlight: { readonly url: URL; readonly signal: AbortSignal } | null = null;

  connect(sink: EngineSink): () => void {
    this.sink = sink;
    const api = requireNavigationApi();
    const onNavigate = (event: NavigateEventLike): void => this.onNavigate(sink, event);
    // `navigatesuccess`/`navigateerror` close out the navigation lifecycle for
    // navigations this engine did not start (a link click has no promise to
    // await), so no per-navigation bookkeeping outlives its navigation.
    const onSettled = (): void => {
      this.inFlight = null;
      this.clickOptOut = false;
    };
    // Vestigial by design: no preventDefault, no eligibility logic. Its only
    // job is remembering whether the anchor that is about to navigate opted out.
    const onClick = (event: MouseEvent): void => this.recordOptOut(event);
    api.addEventListener('navigate', onNavigate);
    api.addEventListener('navigatesuccess', onSettled);
    api.addEventListener('navigateerror', onSettled);
    document.addEventListener('click', onClick, true);
    void sink.transition({ url: this.browserURL(), kind: 'initial', direction: 'unknown' });
    return () => {
      api.removeEventListener('navigate', onNavigate);
      api.removeEventListener('navigatesuccess', onSettled);
      api.removeEventListener('navigateerror', onSettled);
      document.removeEventListener('click', onClick, true);
      this.inFlight = null;
    };
  }

  async navigate(url: URL, options: EngineNavigateOptions): Promise<void> {
    const api = requireNavigationApi();
    if (url.origin !== this.browserURL().origin) {
      window.location.assign(url.href);
      return;
    }
    // Mirrors the core's own guard, as the History engine does.
    if (!this.sink) throw new Error('Router cannot navigate before an AppRouter outlet is connected');
    // Scroll intent and the view-transition override ride `info`, since the
    // navigate event is where the intercept options are chosen. A replace
    // preserves the position unless the caller asked for the top — the History
    // engine's effect table, applied by the browser instead of by the router.
    const info = new RouterNavigateInfo(
      options.scroll ?? (options.replace ? 'preserve' : 'top'),
      options.viewTransition,
    );
    const result = api.navigate(url.href, {
      history: options.replace ? 'replace' : 'push',
      state: options.state ?? null,
      info,
    });
    ignoreRejection(result.committed);
    // A redirect hop starts its own navigation from inside the handler, which
    // supersedes this one and rejects `finished`. That is not a caller-visible
    // failure: the transition below is the chain the History engine awaits.
    await result.finished.then(undefined, () => undefined);
    if (info.transition) await info.transition;
  }

  back(): void { this.traverse('back'); }
  forward(): void { this.traverse('forward'); }

  browserURL(): URL {
    return new URL(typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
  }

  state(): unknown {
    return navigationApi()?.currentEntry?.getState() ?? null;
  }

  /** Always `null`: the browser remembers per-entry scroll, so nothing is restored by hand. */
  rememberedScroll(): { readonly x: number; readonly y: number } | null {
    return null;
  }

  /**
   * The `AbortSignal` of the navigation being intercepted right now, aborted by
   * the browser when a later navigation supersedes it. Engine-internal: the
   * `EngineNavigation` seam carries no signal, so nothing in the router core
   * consumes it yet (bet 07 — abortable server-function fetches — is where it
   * earns its keep).
   */
  currentSignal(): AbortSignal | null {
    return this.inFlight?.signal ?? null;
  }

  private onNavigate(sink: EngineSink, event: NavigateEventLike): void {
    const info = event.info instanceof RouterNavigateInfo ? event.info : null;
    // Cross-origin and cross-document traversals arrive uninterceptable; a
    // reload must stay a reload.
    if (!event.canIntercept || event.navigationType === 'reload') return;
    const url = new URL(event.destination.url);
    let match: RouteMatch | undefined;
    if (info === null) {
      const optedOut = this.consumeOptOut(event);
      if (event.downloadRequest !== null) return;                             // download → native
      if (event.formData !== null && event.formData !== undefined) return;    // form submission → native (v1)
      // Same-document fragment: the browser keeps its native jump, exactly as
      // the delegated click listener declined it (§6 parity). A *traversal*
      // across such an entry is still intercepted, so `url`/`isActive` stay in
      // step with what `popstate` gives the History engine.
      if (event.hashChange && event.navigationType !== 'traverse') return;
      if (optedOut) return;                                                   // data-router-ignore → native
      if (event.navigationType !== 'traverse') {
        // Only intercept what the connected matcher owns (0.5.1): an unmatched
        // same-origin URL is a server document or a static asset. Traversals
        // are exempt — those entries were created inside this document.
        const owned = sink.match(url);
        if (owned === null) return;
        // Hand the resolved match on, as the click path does, so param/query
        // codecs, redirect resolvers, and metadata functions run once.
        match = owned;
      }
    }
    const kind: EngineNavigationKind = event.navigationType === 'traverse'
      ? 'traverse'
      : event.navigationType === 'replace' ? 'replace' : 'push';
    // Read now, not in the handler: by the time the intercept handler runs the
    // navigation has committed and `currentEntry` is already the destination.
    const direction = navigationDirection(
      event.navigationType,
      event.destination.index,
      navigationApi()?.currentEntry?.index,
    );
    this.inFlight = { url, signal: event.signal };
    event.intercept({
      // Traversals restore the remembered offset and pushes scroll to the top
      // or to the fragment, both after the handler resolves — which is what
      // retires the router's scroll map, `scrollTo(0, 0)`, and `scrollIntoView`.
      scroll: info?.scroll === 'preserve' ? 'manual' : 'after-transition',
      // Focus stays the router's: the native default focuses `autofocus`/body,
      // the documented contract focuses the outlet.
      focusReset: 'manual',
      handler: () => {
        const transition = sink.transition({
          url,
          kind,
          direction,
          scroll: info?.scroll,
          match,
          viewTransition: info?.viewTransition,
        });
        if (info) info.transition = transition;
        return transition;
      },
    });
  }

  /**
   * Whether the navigation about to start was opted out of routing. Prefers
   * `sourceElement`; falls back to the recorded click for implementations that
   * do not report it. Anchor-scoped, matching the History engine's rule.
   */
  private consumeOptOut(event: NavigateEventLike): boolean {
    const recorded = this.clickOptOut;
    this.clickOptOut = false;
    const source = event.sourceElement;
    if (source === undefined) return recorded;   // property unsupported here
    if (source === null) return false;           // reported, and there is no source element
    const anchor = source.closest('a[href]');
    return anchor !== null && anchor.hasAttribute('data-router-ignore');
  }

  private recordOptOut(event: MouseEvent): void {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    this.clickOptOut = anchor !== null && anchor.hasAttribute('data-router-ignore');
  }

  private traverse(direction: 'back' | 'forward'): void {
    const api = requireNavigationApi();
    try {
      const result = direction === 'back' ? api.back() : api.forward();
      // Traversing past the ends of the stack rejects; `history.back()` is a
      // silent no-op there, and this method's contract is `void`.
      ignoreRejection(result.committed);
      ignoreRejection(result.finished);
    } catch {
      // Same no-op.
    }
  }
}
