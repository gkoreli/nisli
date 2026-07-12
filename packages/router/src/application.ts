import { component, getCurrentComponent, html, inject, signal, type ComponentFactory, type TemplateResult } from '@nisli/core';
import { createMatcher, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RouteDefinition } from './route.js';
import { Router, type RouterApplicationDefinition } from './router.js';

type RouteMap = Readonly<Record<string, RouteDefinition>>;
type RouterInput<R extends RouteMap> = R & { notFound?: NotFoundDefinition };

export type ApplicationRouter<R extends RouteMap> = ComponentFactory<Record<string, never>> & {
  readonly routes: R;
  readonly notFound?: NotFoundDefinition;
  readonly definition: RouterApplicationDefinition;
  match(input: URL | string, baseURL?: string | URL): RouteMatch | null;
};

let routerId = 0;

export function defineRouter<const R extends RouteMap>(input: RouterInput<R>, options: { base?: string } = {}): ApplicationRouter<R> {
  const base = normalizeBase(options.base);
  const routes = Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value.kind === 'route')
      .map(([name, value]) => {
        const definition = value as RouteDefinition;
        if (!base) return [name, definition];
        return [name, Object.freeze({
          ...definition,
          href: (...args: unknown[]) => prefixBase(
            base,
            (definition.href as (...hrefArgs: unknown[]) => string)(...args),
          ),
        })];
      }),
  ) as R;
  const notFound = input.notFound?.kind === 'not-found' ? input.notFound : undefined;
  const definition: RouterApplicationDefinition = Object.freeze({ routes, notFound, base });
  const match = createMatcher(definition);
  const factory = component(`nisli-router-${++routerId}`, (_props, host) => {
    const router = inject(Router);
    const rendered = signal<TemplateResult | null>(null);
    host.setAttribute('role', 'main');
    host.setAttribute('tabindex', '-1');
    host.style.display = 'contents';
    const disconnect = router.connect(definition, host, rendered);
    getCurrentComponent().addDisposer(disconnect);
    return html`${rendered}`;
  }) as ApplicationRouter<R>;
  Object.defineProperties(factory, {
    routes: { value: routes, enumerable: true },
    notFound: { value: notFound, enumerable: true },
    definition: { value: definition, enumerable: true },
    match: { value: match, enumerable: true },
  });
  return factory;
}

function normalizeBase(base?: string): string {
  if (!base || base === '/') return '';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function prefixBase(base: string, href: string): string {
  return href === '/' ? `${base}/` : `${base}${href}`;
}
