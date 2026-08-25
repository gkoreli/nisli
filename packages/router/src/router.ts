import { signal, viewTransition, type ReadonlySignal, type Signal, type TemplateResult } from '@nisli/core';
import {
  isFragmentOnly,
  type EngineNavigation,
  type EngineNavigationKind,
  type EngineSink,
  type NavigationDirection,
  type NavigationEngine,
  type ViewTransitionIntent,
} from './engine.js';
import { HistoryEngine } from './history-engine.js';
import { NavigationApiEngine, supportsNavigationApi } from './navigation-engine.js';
import { createMatcher, normalizePathname, type MatcherDefinition, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RedirectDefinition, RouteDefinition, RouteMetadata } from './route.js';

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
  scroll?: 'top' | 'preserve';
  /**
   * Override the router's view-transition policy for this navigation only:
   * `true` transitions even where the policy is off, `false` never transitions,
   * and `{ types }` transitions with those types instead of the policy's.
   */
  viewTransition?: ViewTransitionIntent;
}

/**
 * What a view-transition policy callback is told about the navigation it is
 * deciding on. `pop` is back/forward; `direction` is the engine's answer, and
 * `'unknown'` wherever it genuinely cannot tell.
 */
export interface NavInfo {
  readonly from: URL;
  readonly to: URL;
  readonly kind: 'push' | 'replace' | 'pop';
  readonly direction: NavigationDirection;
}

/**
 * Router-level View Transitions policy (`defineRouter(catalog, {
 * viewTransitions })`). Opt-in: no config, or `enabled` absent, means no
 * navigation ever transitions and the router behaves exactly as it did before.
 */
export interface RouterViewTransitions {
  /** Which navigations transition. Default `false`. */
  enabled?: boolean | ((nav: NavInfo) => boolean);
  /**
   * Transition types for `:active-view-transition-type()`. Defaults to the
   * navigation direction (`['forward']` / `['back']`, none when unknown).
   */
  types?: (nav: NavInfo) => string[];
}

/**
 * Which browser engine drives navigation. `'auto'` (the default) uses the
 * Navigation API where the browser has it and the History API everywhere else;
 * the explicit values are the kill switch, and `'navigation'` still falls back
 * rather than leaving a browser without the API unrouted.
 */
export type EngineOption = 'auto' | 'history' | 'navigation';

/** Options a root outlet passes when it connects its definition. */
export interface RouterConnectOptions {
  readonly engine?: EngineOption;
  readonly viewTransitions?: RouterViewTransitions;
}

/**
 * Pick a navigation engine. Both engines ship in the bundle because the choice
 * is a runtime one; the History engine stays maintained, not deprecated, while
 * pre-Navigation-API browsers are still in the field.
 */
export function createEngine(option: EngineOption = 'auto'): NavigationEngine {
  if (option === 'history') return new HistoryEngine();
  return supportsNavigationApi() ? new NavigationApiEngine() : new HistoryEngine();
}

export interface IsActiveOptions {
  /** Require an exact pathname match instead of a path-prefix match. */
  exact?: boolean;
}

/** Upper bound on consecutive client-side redirect hops before bailing. */
const MAX_REDIRECTS = 10;

/** Marker attribute for `<meta>`/`<link>` elements the router owns. */
const MANAGED_ATTR = 'data-nisli-managed';

interface HeadDescriptor {
  readonly key: string;
  readonly tag: 'meta' | 'link' | 'script';
  readonly selector: string;
  readonly attrs: Readonly<Record<string, string>>;
  /** Text content, for JSON-LD script blocks. */
  readonly text?: string;
}

/** Escape a value for safe use inside an attribute selector. */
function escapeSelector(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/["\\]/g, '\\$&');
}

/** Translate declarative route metadata into the head elements it implies. */
function desiredHeadElements(metadata: RouteMetadata | undefined): HeadDescriptor[] {
  if (!metadata) return [];
  const descriptors: HeadDescriptor[] = [];
  for (const [name, content] of Object.entries(metadata.meta ?? {})) {
    descriptors.push({
      key: `meta:name:${name}`,
      tag: 'meta',
      selector: `meta[name="${escapeSelector(name)}"]`,
      attrs: { name, content },
    });
  }
  for (const [property, content] of Object.entries(metadata.property ?? {})) {
    descriptors.push({
      key: `meta:property:${property}`,
      tag: 'meta',
      selector: `meta[property="${escapeSelector(property)}"]`,
      attrs: { property, content },
    });
  }
  if (metadata.canonical !== undefined) {
    descriptors.push({
      key: 'link:canonical',
      tag: 'link',
      selector: 'link[rel="canonical"]',
      attrs: { rel: 'canonical', href: metadata.canonical },
    });
  }
  for (const alternate of metadata.alternates ?? []) {
    descriptors.push({
      key: `link:alternate:${alternate.hreflang}`,
      tag: 'link',
      selector: `link[rel="alternate"][hreflang="${escapeSelector(alternate.hreflang)}"]`,
      attrs: { rel: 'alternate', hreflang: alternate.hreflang, href: alternate.href },
    });
  }
  for (const [id, data] of Object.entries(metadata.jsonLd ?? {})) {
    // Serialize defensively: a value that stringifies to `undefined` (function,
    // `undefined`) or throws (circular, BigInt) yields no block for this key,
    // so it is removed rather than left stale or breaking the render path.
    let text: string | undefined;
    try {
      text = JSON.stringify(data);
    } catch {
      continue;
    }
    if (text === undefined) continue;
    descriptors.push({
      key: `jsonld:${id}`,
      tag: 'script',
      // Adopt an as-yet-unmanaged JSON-LD block (e.g. a server-rendered one)
      // rather than duplicating it; once tagged it is excluded from `:not`, so
      // multiple keys adopt distinct blocks.
      selector: `script[type="application/ld+json"]:not([${MANAGED_ATTR}])`,
      attrs: { type: 'application/ld+json' },
      text,
    });
  }
  return descriptors;
}

/**
 * The navigation as a policy callback sees it, or `null` for the initial
 * render: there is no previous frame to animate from, so no policy is
 * consulted and no transition is ever started.
 */
function navInfo(
  from: URL,
  to: URL,
  kind: EngineNavigationKind,
  direction: NavigationDirection,
): NavInfo | null {
  if (kind === 'initial') return null;
  return { from, to, kind: kind === 'traverse' ? 'pop' : kind, direction };
}

/**
 * The transition types for this navigation, or `null` to commit without a
 * transition at all.
 *
 * Two suppressions are unconditional, checked before any policy callback runs:
 * a hash-only move (the browser is already doing that jump) and a hidden
 * document (capture would animate a frame nobody can see, and the API is
 * documented to skip it anyway). Everything else is the policy's call, and the
 * per-navigation override outranks it in both directions.
 */
function transitionTypes(
  config: RouterViewTransitions | undefined,
  nav: NavInfo,
  override: ViewTransitionIntent | undefined,
): string[] | null {
  if (isFragmentOnly(nav.from, nav.to)) return null;
  if (typeof document === 'undefined' || document.hidden) return null;
  const enabled = override !== undefined
    ? override !== false
    : typeof config?.enabled === 'function' ? config.enabled(nav) : config?.enabled === true;
  if (!enabled) return null;
  const requested = typeof override === 'object' ? override.types : undefined;
  if (requested !== undefined) return requested;
  if (config?.types) return config.types(nav);
  // Direction is the default type, so `:active-view-transition-type(back)`
  // works with no configuration. `'unknown'` is not a design token — an empty
  // list is the honest answer, and core then uses the plain callback form.
  return nav.direction === 'unknown' ? [] : [nav.direction];
}

export interface RouterApplicationDefinition extends MatcherDefinition {
  readonly routes: Readonly<Record<string, RouteDefinition<any, any, any>>>;
  readonly redirects?: Readonly<Record<string, RedirectDefinition<any>>>;
  readonly notFound?: NotFoundDefinition;
}

interface Connection {
  match: ReturnType<typeof createMatcher>;
  outlet: HTMLElement;
  rendered: Signal<TemplateResult | null>;
  generation: number;
  /** The connected application's View Transitions policy, if it declared one. */
  viewTransitions?: RouterViewTransitions;
  dispose: () => void;
}

export class Router {
  private engine: NavigationEngine;
  /** An engine handed in explicitly wins over any `defineRouter` preference. */
  private readonly engineInjected: boolean;
  private readonly sink: EngineSink;
  private readonly urlState: Signal<URL>;
  private readonly currentState = signal<RouteMatch | null>(null);
  private readonly pendingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);
  private connection: Connection | null = null;

  // Document title / html lang / html dir to fall back to when a route omits
  // them (captured at connect).
  private defaultTitle = '';
  private defaultLang = '';
  private defaultDir = '';
  // Consecutive redirect hops in the current navigation (loop guard).
  private redirectHops = 0;
  /**
   * The view transition currently animating, so a navigation that lands
   * mid-animation can skip it instead of queueing behind it.
   */
  private activeTransition: ViewTransition | null = null;

  readonly url: ReadonlySignal<URL>;
  readonly current: ReadonlySignal<RouteMatch | null> = this.currentState;
  readonly pending: ReadonlySignal<boolean> = this.pendingState;
  readonly error: ReadonlySignal<unknown | null> = this.errorState;

  constructor(engine?: NavigationEngine) {
    this.engineInjected = engine !== undefined;
    this.engine = engine ?? createEngine();
    this.urlState = signal(this.engine.browserURL());
    this.url = this.urlState;
    this.sink = {
      match: (url) => this.connection?.match(url) ?? null,
      transition: (navigation) => this.transition(navigation),
      fragment: (url) => this.syncFragment(url),
    };
  }

  connect(
    definition: RouterApplicationDefinition,
    outlet: HTMLElement,
    rendered: Signal<TemplateResult | null>,
    options: RouterConnectOptions = {},
  ): () => void {
    if (this.connection) throw new Error('Router already has a root application definition connected');
    // The engine preference travels with the application being connected, since
    // that is where `defineRouter` declared it. An injected engine is left
    // alone: an explicit engine is the more specific instruction.
    if (!this.engineInjected && options.engine !== undefined) this.engine = createEngine(options.engine);
    if (typeof document !== 'undefined') {
      this.defaultTitle = document.title;
      this.defaultLang = document.documentElement.getAttribute('lang') ?? '';
      this.defaultDir = document.documentElement.getAttribute('dir') ?? '';
    }
    let disconnectEngine: (() => void) | null = null;
    const connection: Connection = {
      match: createMatcher(definition),
      outlet,
      rendered,
      generation: 0,
      // Declared by `defineRouter`, so it lives and dies with the connection.
      viewTransitions: options.viewTransitions,
      dispose: () => {
        disconnectEngine?.();
        if (this.connection === connection) this.connection = null;
      },
    };
    // Connect the engine last: it drives the initial transition, which needs
    // the connection in place to match and render against.
    this.connection = connection;
    disconnectEngine = this.engine.connect(this.sink);
    return connection.dispose;
  }

  async navigate(href: string, options: NavigateOptions = {}): Promise<void> {
    const url = new URL(href, this.urlState.value);
    await this.engine.navigate(url, {
      replace: options.replace === true,
      state: options.state,
      scroll: options.scroll,
      viewTransition: options.viewTransition,
    });
  }

  replace(href: string, options: Omit<NavigateOptions, 'replace'> = {}): Promise<void> {
    return this.navigate(href, { ...options, replace: true });
  }

  back(): void { this.engine.back(); }
  forward(): void { this.engine.forward(); }

  /**
   * The navigation state of the current history entry — the value last passed
   * as `NavigateOptions.state`. Read this rather than `history.state.state`:
   * the wrapper shape is a History-engine detail, not part of the contract.
   */
  state(): unknown {
    return this.engine.state();
  }

  /**
   * Whether `href` corresponds to the current location, for `aria-current` on
   * navigation links. Reads the reactive `url` signal, so it re-evaluates
   * inside templates/effects on every navigation. Matches by pathname prefix
   * by default; `{ exact: true }` (and the root path `/`) require an exact
   * match.
   */
  isActive(href: string, options: IsActiveOptions = {}): boolean {
    const current = this.urlState.value;
    const target = new URL(href, current);
    if (target.origin !== current.origin) return false;
    const targetPath = normalizePathname(target.pathname);
    const currentPath = normalizePathname(current.pathname);
    if (options.exact || targetPath === '/') return currentPath === targetPath;
    return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
  }

  /**
   * A same-document fragment-only change, reported by the engine after the
   * browser already performed it: `url` advances and nothing else. The matched
   * route, the rendered output, the head and the focused element are all still
   * correct — only the hash moved — so re-running the transition pipeline would
   * buy a needless re-render, a metadata reapplication and a stolen focus.
   * `isActive()` compares pathnames only, so carrying the hash here is safe.
   *
   * Scroll is the engine's to claim, as it is for a transition: an engine whose
   * browser owns fragment jumps and scroll restoration has already scrolled.
   */
  private syncFragment(url: URL): void {
    this.urlState.value = url;
    if (!this.engine.ownsScrollRestoration) return;
    if (url.hash) {
      this.scrollToFragment(url);
      return;
    }
    // Leaving a fragment behind: the entry being restored keeps whatever offset
    // was remembered for it, and the top is the honest default when the browser
    // created that entry without the router ever parking a position on it.
    const saved = this.engine.rememberedScroll();
    window.scrollTo(saved?.x ?? 0, saved?.y ?? 0);
  }

  private async transition(navigation: EngineNavigation): Promise<void> {
    const { url, kind, scroll } = navigation;
    const connection = this.connection;
    if (!connection) throw new Error('Router cannot navigate before an AppRouter outlet is connected');
    const match = navigation.match ?? connection.match(url);
    if (match?.redirect !== undefined) {
      const target = new URL(match.redirect, url);
      // Bail on a self-loop or an over-long chain/cycle across several redirects.
      if (target.href === url.href || ++this.redirectHops > MAX_REDIRECTS) {
        this.redirectHops = 0;
        this.errorState.value = new Error(`Redirect loop detected at ${url.pathname} → ${match.redirect}`);
        return;
      }
      // Replace semantics: the redirect source leaves no history entry.
      await this.navigate(match.redirect, { replace: true });
      return;
    }
    this.redirectHops = 0;
    // Captured before the signal advances: the URL being left is what a policy
    // callback sees as `NavInfo.from`.
    const from = this.urlState.value;
    this.urlState.value = url;
    this.currentState.value = match;
    this.errorState.value = null;
    const generation = ++connection.generation;
    if (!match) {
      this.pendingState.value = false;
      connection.rendered.value = null;
      this.applyMetadata(undefined);
      return;
    }
    this.pendingState.value = true;
    try {
      const renderer = (match.route as RouteDefinition | NotFoundDefinition).render;
      if (!renderer) {
        throw new Error(`Route "${match.name ?? 'notFound'}" has no render; bind it with bindRenders() before defineRouter()`);
      }
      const output = match.notFound
        ? await (renderer as NotFoundDefinition['render'])!({ url: match.url })
        : await (renderer as NonNullable<RouteDefinition['render']>)({
            url: match.url,
            params: match.params as Record<string, string>,
            query: match.query,
            searchParams: match.searchParams,
          });
      if (this.connection !== connection || generation !== connection.generation) return;
      // Everything the browser would snapshot, in one synchronous closure: the
      // rendered output, the reconciled head, and the scroll/focus effects.
      const commit = (): void => {
        connection.rendered.value = output;
        this.applyMetadata(match.metadata);
        this.applyNavigationEffects(connection.outlet, url, kind, scroll);
      };
      const nav = navInfo(from, url, kind, navigation.direction);
      const types = nav === null
        ? null
        : transitionTypes(connection.viewTransitions, nav, navigation.viewTransition);
      if (types === null) {
        commit();
        return;
      }
      // A navigation landing mid-animation wins outright: skip the transition
      // in flight rather than let this commit queue behind it.
      this.activeTransition?.skipTransition();
      const handle = viewTransition(commit, { types });
      this.activeTransition = handle;
      if (handle === null) return;   // no platform support: `commit` already ran
      const release = (): void => { if (this.activeTransition === handle) this.activeTransition = null; };
      handle.finished.then(release, release);
      // Navigation still resolves at commit, as it always has. The platform
      // runs the update callback after capturing the old frame, so the DOM is
      // only current once this settles — and a commit that threw rejects it,
      // which keeps the catch below authoritative.
      await handle.updateCallbackDone;
    } catch (error) {
      if (this.connection !== connection || generation !== connection.generation) return;
      this.errorState.value = error;
      // Atomic head reset: a failed render must not retain the previous route's
      // managed title/meta/canonical/OG/hreflang/JSON-LD/lang/dir.
      this.applyMetadata(undefined);
    } finally {
      if (this.connection === connection && generation === connection.generation) this.pendingState.value = false;
    }
  }

  private applyMetadata(metadata: RouteMetadata | undefined): void {
    // Reconcile the title too: a route that omits it falls back to the title
    // present at connect, so a previous route's title never lingers.
    document.title = metadata?.title ?? this.defaultTitle;
    this.applyDocumentLocale(metadata);
    this.reconcileHead(desiredHeadElements(metadata));
  }

  /**
   * Reconcile `<html lang>` / `<html dir>`. A route that declares them wins; a
   * route that omits them restores the connect-time value (removing the
   * attribute when there was none), so URL locale can be authoritative.
   */
  private applyDocumentLocale(metadata: RouteMetadata | undefined): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const lang = metadata?.lang ?? this.defaultLang;
    if (lang) root.setAttribute('lang', lang); else root.removeAttribute('lang');
    const dir = metadata?.dir ?? this.defaultDir;
    if (dir) root.setAttribute('dir', dir); else root.removeAttribute('dir');
  }

  /**
   * Reconcile router-managed `<meta>`/`<link>` elements to exactly the desired
   * set. Elements the router creates or adopts are tagged with
   * `data-nisli-managed="<key>"`; any managed element whose key is no longer
   * desired is removed, so canonical/OpenGraph/hreflang tags never go stale
   * across client navigations.
   */
  private reconcileHead(desired: HeadDescriptor[]): void {
    const managed = new Map<string, Element>();
    for (const element of document.head.querySelectorAll(`[${MANAGED_ATTR}]`)) {
      const key = element.getAttribute(MANAGED_ATTR);
      if (key !== null) managed.set(key, element);
    }
    const keep = new Set<string>();
    for (const descriptor of desired) {
      if (keep.has(descriptor.key)) continue;
      keep.add(descriptor.key);
      const element = managed.get(descriptor.key)
        ?? document.head.querySelector(descriptor.selector)
        ?? document.head.appendChild(document.createElement(descriptor.tag));
      element.setAttribute(MANAGED_ATTR, descriptor.key);
      for (const [name, value] of Object.entries(descriptor.attrs)) element.setAttribute(name, value);
      if (descriptor.text !== undefined && element.textContent !== descriptor.text) {
        element.textContent = descriptor.text;
      }
    }
    for (const [key, element] of managed) {
      if (!keep.has(key)) element.remove();
    }
  }

  private applyNavigationEffects(outlet: HTMLElement, url: URL, kind: EngineNavigationKind, scroll?: NavigateOptions['scroll']): void {
    queueMicrotask(() => {
      // Scroll is the engine's to claim: an engine whose browser restores and
      // resets scroll itself takes none of the manual effects below.
      if (this.engine.ownsScrollRestoration) this.applyScrollEffects(url, kind, scroll);
      // The a11y focus reset, and its one exception: a hash carries its own
      // destination, so focus stays where the user left it.
      if (kind === 'push' && !url.hash) {
        outlet.focus({ preventScroll: true });
        return;
      }
      // Otherwise the host must not be holding focus. Now that it generates a
      // box it is focusable, which makes it the nearest focusable ancestor of
      // every route element — and WebKit's focus fixup, unlike Chromium's and
      // Firefox's, walks up to that ancestor when the focused element is the
      // one this render just replaced. Left alone it announces the main
      // landmark as if the reset above had run, on exactly the navigations that
      // deliberately skip it. The body is what the other two engines leave.
      if (document.activeElement === outlet) outlet.blur();
    });
  }

  private applyScrollEffects(url: URL, kind: EngineNavigationKind, scroll?: NavigateOptions['scroll']): void {
    if (url.hash) {
      this.scrollToFragment(url);
      return;
    }
    if (kind === 'push' && (scroll ?? 'top') === 'top') {
      window.scrollTo(0, 0);
    } else if (kind === 'replace' && scroll === 'top') {
      window.scrollTo(0, 0);
    } else if (kind === 'traverse') {
      const saved = this.engine.rememberedScroll();
      if (saved) window.scrollTo(saved.x, saved.y);
    }
  }

  /** Park the viewport on `url`'s fragment target, when the document has one. */
  private scrollToFragment(url: URL): void {
    document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
  }
}
