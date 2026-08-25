import type { RouteMatch } from './matcher.js';

/**
 * How the browser reached an entry, which selects the router's post-render
 * navigation effects. `traverse` is back/forward.
 */
export type EngineNavigationKind = 'initial' | 'push' | 'replace' | 'traverse';

/**
 * Which way a navigation moves through the history stack, for the router's
 * `NavInfo.direction`. Engine-answered because only the engine can know: the
 * Navigation API compares history-entry indices, the History engine compares
 * its own per-entry keys, and `'unknown'` is the honest answer wherever
 * neither can decide (a foreign entry, keys restarted with the session).
 */
export type NavigationDirection = 'forward' | 'back' | 'unknown';

/**
 * Per-navigation view-transition intent, as `NavigateOptions.viewTransition`
 * gave it. Engines thread it through untouched, the way they thread `scroll`.
 */
export type ViewTransitionIntent = boolean | { readonly types?: string[] };

/** A navigation an engine hands to the router core. */
export interface EngineNavigation {
  /** Destination, already resolved against the current location. */
  readonly url: URL;
  readonly kind: EngineNavigationKind;
  /** Which way through the history stack this navigation moves. */
  readonly direction: NavigationDirection;
  /** Scroll intent carried through from `navigate()`, when the caller gave one. */
  readonly scroll?: 'top' | 'preserve';
  /** View-transition override carried through from `navigate()`, likewise. */
  readonly viewTransition?: ViewTransitionIntent;
  /**
   * The match the engine already resolved — anchor eligibility needs one before
   * `preventDefault()`. Passed through so param/query codecs, redirect
   * resolvers, and metadata functions run exactly once per navigation.
   */
  readonly match?: RouteMatch;
}

/** A commit the router core asks an engine to perform. */
export interface EngineNavigateOptions {
  readonly replace: boolean;
  readonly state: unknown;
  readonly scroll?: 'top' | 'preserve';
  /** Per-navigation view-transition override, when the caller gave one. */
  readonly viewTransition?: ViewTransitionIntent;
}

/** What an engine may ask of the router core. */
export interface EngineSink {
  /** Resolve a URL through the connected matcher (anchor eligibility). */
  match(url: URL): RouteMatch | null;
  /**
   * The router's transition pipeline (match → render → head → effects). The
   * engine ties the returned promise to its own lifecycle.
   */
  transition(navigation: EngineNavigation): Promise<void>;
}

/**
 * What the router core needs from a browser engine (ADR 0026 §9). Matching,
 * signals, redirects, head reconciliation, and the render pipeline are
 * engine-independent; everything that touches `window`, `history`, or document
 * clicks lives behind this interface.
 */
export interface NavigationEngine {
  /**
   * Whether the router applies its own scroll effects. `false` for an engine
   * whose browser owns scroll restoration and fragment jumps itself.
   */
  readonly ownsScrollRestoration: boolean;
  /** Register listeners, drive the initial transition, and return the disposer. */
  connect(sink: EngineSink): () => void;
  /** Commit `url` and drive a transition. Resolves when the transition settles. */
  navigate(url: URL, options: EngineNavigateOptions): Promise<void>;
  back(): void;
  forward(): void;
  /** The browser's current location. */
  browserURL(): URL;
  /** The navigation state of the current entry, as `navigate()` supplied it. */
  state(): unknown;
  /**
   * The scroll position remembered for the entry just traversed to, for the
   * router's manual restoration effect.
   */
  rememberedScroll(): { readonly x: number; readonly y: number } | null;
}
