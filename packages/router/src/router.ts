import { signal, type ReadonlySignal, type Signal, type TemplateResult } from '@nisli/core';
import { createMatcher, normalizePathname, type MatcherDefinition, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RedirectDefinition, RouteDefinition, RouteMetadata } from './route.js';

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
  scroll?: 'top' | 'preserve';
}

export interface IsActiveOptions {
  /** Require an exact pathname match instead of a path-prefix match. */
  exact?: boolean;
}

/** Reserved key under which the router stamps its per-entry scroll key. */
const HISTORY_KEY = '__nisli_router';

interface RouterHistoryState {
  readonly [HISTORY_KEY]?: string;
  readonly state?: unknown;
}

function readHistoryKey(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;
  const key = (state as RouterHistoryState)[HISTORY_KEY];
  return typeof key === 'string' ? key : null;
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
  dispose: () => void;
}

export class Router {
  private readonly urlState: Signal<URL>;
  private readonly currentState = signal<RouteMatch | null>(null);
  private readonly pendingState = signal(false);
  private readonly errorState = signal<unknown | null>(null);
  private connection: Connection | null = null;

  // Scroll restoration: per-history-entry remembered scroll positions.
  private readonly scrollPositions = new Map<string, { x: number; y: number }>();
  private currentKey = '0';
  private keySeq = 0;
  private previousScrollRestoration: ScrollRestoration | null = null;
  // Document title / html lang / html dir to fall back to when a route omits
  // them (captured at connect).
  private defaultTitle = '';
  private defaultLang = '';
  private defaultDir = '';
  // Consecutive redirect hops in the current navigation (loop guard).
  private redirectHops = 0;

  readonly url: ReadonlySignal<URL>;
  readonly current: ReadonlySignal<RouteMatch | null> = this.currentState;
  readonly pending: ReadonlySignal<boolean> = this.pendingState;
  readonly error: ReadonlySignal<unknown | null> = this.errorState;

  constructor() {
    this.urlState = signal(this.browserURL());
    this.url = this.urlState;
  }

  connect(definition: RouterApplicationDefinition, outlet: HTMLElement, rendered: Signal<TemplateResult | null>): () => void {
    if (this.connection) throw new Error('Router already has a root application definition connected');
    const onPopState = () => {
      // Record the scroll of the entry being left (manual restoration keeps it
      // intact at popstate time), then adopt the target entry's key.
      this.rememberScroll();
      this.currentKey = readHistoryKey(history.state) ?? this.nextKey();
      void this.transition(this.browserURL(), 'pop');
    };
    const onClick = (event: MouseEvent) => this.onDocumentClick(event);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick);
    if (typeof document !== 'undefined') {
      this.defaultTitle = document.title;
      this.defaultLang = document.documentElement.getAttribute('lang') ?? '';
      this.defaultDir = document.documentElement.getAttribute('dir') ?? '';
    }
    this.enableManualScrollRestoration();
    const connection: Connection = {
      match: createMatcher(definition),
      outlet,
      rendered,
      generation: 0,
      dispose: () => {
        window.removeEventListener('popstate', onPopState);
        document.removeEventListener('click', onClick);
        this.restoreScrollRestoration();
        if (this.connection === connection) this.connection = null;
      },
    };
    this.connection = connection;
    void this.transition(this.browserURL(), 'initial');
    return connection.dispose;
  }

  /** Take over scroll restoration and stamp the current entry with a key. */
  private enableManualScrollRestoration(): void {
    if (typeof history === 'undefined') return;
    if ('scrollRestoration' in history) {
      this.previousScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = 'manual';
    }
    const existing = readHistoryKey(history.state);
    // Seed the sequence past any key persisted across a reload so freshly
    // pushed entries never collide with keys still live in the back stack.
    if (existing !== null) this.keySeq = Math.max(this.keySeq, Number(existing) || 0);
    this.currentKey = existing ?? this.nextKey();
    if (existing === null) {
      history.replaceState(this.wrapHistoryState(this.currentKey, history.state), '', this.browserURL().href);
    }
  }

  private restoreScrollRestoration(): void {
    if (this.previousScrollRestoration !== null && typeof history !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = this.previousScrollRestoration;
    }
    this.previousScrollRestoration = null;
    this.scrollPositions.clear();
  }

  private nextKey(): string {
    return String(++this.keySeq);
  }

  private wrapHistoryState(key: string, userState: unknown): RouterHistoryState {
    const unwrapped = readHistoryKey(userState) !== null ? (userState as RouterHistoryState).state : userState;
    return { [HISTORY_KEY]: key, state: unwrapped ?? null };
  }

  private rememberScroll(): void {
    if (typeof window === 'undefined') return;
    this.scrollPositions.set(this.currentKey, { x: window.scrollX, y: window.scrollY });
  }

  async navigate(href: string, options: NavigateOptions = {}): Promise<void> {
    const url = new URL(href, this.urlState.value);
    if (url.origin !== this.urlState.value.origin) {
      window.location.assign(url.href);
      return;
    }
    const replace = options.replace === true;
    // Remember where we are before leaving so back/forward can restore it.
    this.rememberScroll();
    const key = replace ? this.currentKey : this.nextKey();
    const state = this.wrapHistoryState(key, options.state ?? null);
    if (replace) history.replaceState(state, '', url);
    else history.pushState(state, '', url);
    this.currentKey = key;
    await this.transition(url, replace ? 'replace' : 'push', options.scroll);
  }

  replace(href: string, options: Omit<NavigateOptions, 'replace'> = {}): Promise<void> {
    return this.navigate(href, { ...options, replace: true });
  }

  back(): void { history.back(); }
  forward(): void { history.forward(); }

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

  private async transition(url: URL, kind: 'initial' | 'push' | 'replace' | 'pop', scroll?: NavigateOptions['scroll']): Promise<void> {
    const connection = this.connection;
    if (!connection) throw new Error('Router cannot navigate before an AppRouter outlet is connected');
    const match = connection.match(url);
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
    this.urlState.value = url;
    this.currentState.value = match;
    this.errorState.value = null;
    const generation = ++connection.generation;
    if (!match) {
      this.pendingState.value = false;
      connection.rendered.value = null;
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
      connection.rendered.value = output;
      this.applyMetadata(match.metadata);
      this.applyNavigationEffects(connection.outlet, url, kind, scroll);
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

  private applyNavigationEffects(outlet: HTMLElement, url: URL, kind: 'initial' | 'push' | 'replace' | 'pop', scroll?: NavigateOptions['scroll']): void {
    queueMicrotask(() => {
      if (url.hash) {
        document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
        return;
      }
      if (kind === 'push') {
        if ((scroll ?? 'top') === 'top') window.scrollTo(0, 0);
        outlet.focus({ preventScroll: true });
      } else if (kind === 'replace' && scroll === 'top') {
        window.scrollTo(0, 0);
      } else if (kind === 'pop') {
        const saved = this.scrollPositions.get(this.currentKey);
        if (saved) window.scrollTo(saved.x, saved.y);
      }
    });
  }

  private onDocumentClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    if ((target.target && target.target !== '_self') || target.hasAttribute('download') || target.hasAttribute('data-router-ignore')) return;
    const url = new URL(target.href, this.urlState.value);
    if (url.origin !== this.urlState.value.origin) return;
    if (url.pathname === this.urlState.value.pathname && url.search === this.urlState.value.search && url.hash) return;
    event.preventDefault();
    void this.navigate(url.href);
  }

  private browserURL(): URL {
    return new URL(typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
  }
}
