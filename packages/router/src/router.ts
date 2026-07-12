import { signal, type ReadonlySignal, type Signal, type TemplateResult } from '@nisli/core';
import { createMatcher, type MatcherDefinition, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RouteDefinition } from './route.js';

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
  scroll?: 'top' | 'preserve';
}

export interface RouterApplicationDefinition extends MatcherDefinition {
  readonly routes: Readonly<Record<string, RouteDefinition<any, any>>>;
  readonly notFound?: NotFoundDefinition;
}

interface Connection {
  definition: RouterApplicationDefinition;
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
    const onPopState = () => { void this.transition(this.browserURL(), 'pop'); };
    const onClick = (event: MouseEvent) => this.onDocumentClick(event);
    window.addEventListener('popstate', onPopState);
    document.addEventListener('click', onClick);
    const connection: Connection = {
      definition,
      outlet,
      rendered,
      generation: 0,
      dispose: () => {
        window.removeEventListener('popstate', onPopState);
        document.removeEventListener('click', onClick);
        if (this.connection === connection) this.connection = null;
      },
    };
    this.connection = connection;
    void this.transition(this.browserURL(), 'initial');
    return connection.dispose;
  }

  async navigate(href: string, options: NavigateOptions = {}): Promise<void> {
    const url = new URL(href, this.urlState.value);
    if (url.origin !== this.urlState.value.origin) {
      window.location.assign(url.href);
      return;
    }
    const replace = options.replace === true;
    if (replace) history.replaceState(options.state ?? null, '', url);
    else history.pushState(options.state ?? null, '', url);
    await this.transition(url, replace ? 'replace' : 'push', options.scroll);
  }

  replace(href: string, options: Omit<NavigateOptions, 'replace'> = {}): Promise<void> {
    return this.navigate(href, { ...options, replace: true });
  }

  back(): void { history.back(); }
  forward(): void { history.forward(); }

  private async transition(url: URL, kind: 'initial' | 'push' | 'replace' | 'pop', scroll?: NavigateOptions['scroll']): Promise<void> {
    const connection = this.connection;
    if (!connection) throw new Error('Router cannot navigate before an AppRouter outlet is connected');
    const match = createMatcher(connection.definition)(url);
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
      const output = match.notFound
        ? await (match.route as NotFoundDefinition).render({ url: match.url })
        : await (match.route as RouteDefinition).render({
            url: match.url,
            params: match.params,
            query: match.query,
            searchParams: match.searchParams,
          });
      if (this.connection !== connection || generation !== connection.generation) return;
      connection.rendered.value = output;
      this.applyMetadata(match);
      this.applyNavigationEffects(connection.outlet, url, kind, scroll);
    } catch (error) {
      if (this.connection !== connection || generation !== connection.generation) return;
      this.errorState.value = error;
    } finally {
      if (this.connection === connection && generation === connection.generation) this.pendingState.value = false;
    }
  }

  private applyMetadata(match: RouteMatch): void {
    if (match.metadata?.title !== undefined) document.title = match.metadata.title;
    if (!match.metadata?.meta) return;
    for (const [name, content] of Object.entries(match.metadata.meta)) {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${CSS.escape(name)}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.name = name;
        document.head.appendChild(element);
      }
      element.content = content;
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
      }
    });
  }

  private onDocumentClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    if (target.target || target.hasAttribute('download') || target.hasAttribute('data-router-ignore')) return;
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
