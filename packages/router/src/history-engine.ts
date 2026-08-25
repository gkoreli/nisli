import { isFragmentOnly, type EngineNavigateOptions, type EngineSink, type NavigationDirection, type NavigationEngine } from './engine.js';
import type { RouteMatch } from './matcher.js';

/** Reserved key under which the engine stamps its per-entry scroll key. */
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

/** The user state carried by a history state, wrapped by this engine or not. */
function unwrapHistoryState(state: unknown): unknown {
  return readHistoryKey(state) !== null ? (state as RouterHistoryState).state ?? null : state;
}

/**
 * Back/forward from the engine's monotonic per-entry keys: an entry stamped
 * earlier sits behind one stamped later. Unknown whenever the comparison
 * cannot be trusted — an entry this engine never stamped (a foreign or
 * reload-orphaned one), or the same entry on both sides.
 */
function traversalDirection(fromKey: string, toKey: string | null): NavigationDirection {
  if (toKey === null) return 'unknown';
  const from = Number(fromKey);
  const to = Number(toKey);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return 'unknown';
  return to < from ? 'back' : 'forward';
}

/**
 * The History API engine (ADR 0026 §9): one `popstate` listener, one delegated
 * document click listener, `history.pushState`/`replaceState` commits, and
 * hand-kept per-entry scroll memory (0.2.0 §4) — the browser primitives that
 * were universally available when the router was written. It owns the wrapped
 * `history.state` shape and therefore answers `state()` by unwrapping it.
 */
export class HistoryEngine implements NavigationEngine {
  /** The browser restores nothing here, so the router applies every effect. */
  readonly ownsScrollRestoration = true;

  // Retained after disconnect so a navigation on a disconnected router still
  // reaches the core's connection guard instead of failing differently here.
  private sink: EngineSink | null = null;

  // Scroll restoration: per-history-entry remembered scroll positions.
  private readonly scrollPositions = new Map<string, { x: number; y: number }>();
  private currentKey = '0';
  private keySeq = 0;
  private previousScrollRestoration: ScrollRestoration | null = null;
  /**
   * The URL this engine last reported. Fragment classification needs the URL
   * being left, and by `popstate` time `window.location` is already the
   * destination — what the engine itself last committed or adopted is the only
   * record of where the router still thinks it is.
   */
  private currentUrl = this.browserURL();

  connect(sink: EngineSink): () => void {
    this.sink = sink;
    const onPopState = () => {
      const url = this.browserURL();
      // A native fragment navigation is a same-document navigation, so the
      // browser runs "apply the history step" and this listener sees it — but
      // nothing about the document changed, and (critically) the page is
      // already on its way to the anchor. Remembering scroll here is what used
      // to overwrite the pre-fragment entry's offset with the anchor's.
      if (isFragmentOnly(this.currentUrl, url)) {
        this.adoptFragmentEntry(url);
        sink.fragment(url);
        return;
      }
      // Record the scroll of the entry being left (manual restoration keeps it
      // intact at popstate time), then adopt the target entry's key. The
      // comparison has to happen before that adoption — the key being left is
      // the only thing that says which way this traversal went.
      this.rememberScroll();
      const leavingKey = this.currentKey;
      const incomingKey = readHistoryKey(history.state);
      this.currentKey = incomingKey ?? this.nextKey();
      this.currentUrl = url;
      void sink.transition({
        url,
        kind: 'traverse',
        direction: traversalDirection(leavingKey, incomingKey),
      });
    };
    const onClick = (event: MouseEvent) => this.onDocumentClick(event);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick);
    this.enableManualScrollRestoration();
    this.currentUrl = this.browserURL();
    void sink.transition({ url: this.currentUrl, kind: 'initial', direction: 'unknown' });
    return () => {
      window.removeEventListener('popstate', onPopState);
      document.removeEventListener('click', onClick);
      this.restoreScrollRestoration();
    };
  }

  async navigate(url: URL, options: EngineNavigateOptions): Promise<void> {
    if (url.origin !== this.browserURL().origin) {
      window.location.assign(url.href);
      return;
    }
    await this.commit(url, options);
  }

  back(): void { history.back(); }
  forward(): void { history.forward(); }

  browserURL(): URL {
    return new URL(typeof window === 'undefined' ? 'http://localhost/' : window.location.href);
  }

  state(): unknown {
    return typeof history === 'undefined' ? null : unwrapHistoryState(history.state);
  }

  rememberedScroll(): { readonly x: number; readonly y: number } | null {
    return this.scrollPositions.get(this.currentKey) ?? null;
  }

  /** Write the history entry for a same-origin navigation, then transition. */
  private async commit(url: URL, options: EngineNavigateOptions, match?: RouteMatch): Promise<void> {
    const { replace, state, scroll } = options;
    // Remember where we are before leaving so back/forward can restore it.
    this.rememberScroll();
    const key = replace ? this.currentKey : this.nextKey();
    const wrapped = this.wrapHistoryState(key, state ?? null);
    if (replace) history.replaceState(wrapped, '', url);
    else history.pushState(wrapped, '', url);
    this.currentKey = key;
    this.currentUrl = url;
    // Mirrors the core's own guard: navigating before an outlet is connected is
    // the same misuse whether it is caught here or one call deeper.
    if (!this.sink) throw new Error('Router cannot navigate before an AppRouter outlet is connected');
    await this.sink.transition({
      url,
      // A push creates an entry ahead of this one; a replace moves nowhere.
      kind: replace ? 'replace' : 'push',
      direction: replace ? 'unknown' : 'forward',
      scroll,
      match,
      viewTransition: options.viewTransition,
    });
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

  /**
   * Take over the history entry the browser just navigated to on its own —
   * either the one a native fragment navigation created, or one traversed back
   * onto — without touching scroll memory. A browser-created entry carries no
   * state of its own (measured: `history.state` is `null` after a fragment
   * navigation), so it gets a fresh key stamped in; a traversal re-adopts the
   * key already on the entry.
   */
  private adoptFragmentEntry(url: URL): void {
    const existing = readHistoryKey(history.state);
    this.currentKey = existing ?? this.nextKey();
    if (existing === null) {
      history.replaceState(this.wrapHistoryState(this.currentKey, history.state), '', url.href);
    }
    this.currentUrl = url;
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
    return { [HISTORY_KEY]: key, state: unwrapHistoryState(userState) ?? null };
  }

  private rememberScroll(): void {
    if (typeof window === 'undefined') return;
    this.scrollPositions.set(this.currentKey, { x: window.scrollX, y: window.scrollY });
  }

  private onDocumentClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    if ((target.target && target.target !== '_self') || target.hasAttribute('download') || target.hasAttribute('data-router-ignore')) return;
    const current = this.browserURL();
    const url = new URL(target.href, current);
    if (url.origin !== current.origin) return;
    // A same-document fragment stays the browser's: it jumps and scrolls
    // natively, and the `popstate` that follows reaches `sink.fragment`. Adding,
    // changing and removing a fragment are all that same navigation, which is
    // why the current hash counts as much as the destination's.
    if (url.pathname === current.pathname && url.search === current.search && (url.hash !== '' || current.hash !== '')) return;
    const match = this.sink?.match(url);
    if (!match) return;
    event.preventDefault();
    void this.commit(url, { replace: false, state: null }, match);
  }
}
