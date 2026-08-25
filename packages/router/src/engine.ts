import type { RouteMatch } from './matcher.js';

/**
 * How the browser reached an entry, which selects the router's post-render
 * navigation effects. `traverse` is back/forward.
 */
export type EngineNavigationKind = 'initial' | 'push' | 'replace' | 'traverse';

/** A navigation an engine hands to the router core. */
export interface EngineNavigation {
  /** Destination, already resolved against the current location. */
  readonly url: URL;
  readonly kind: EngineNavigationKind;
  /** Scroll intent carried through from `navigate()`, when the caller gave one. */
  readonly scroll?: 'top' | 'preserve';
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
