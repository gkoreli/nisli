import { component, getCurrentComponent, html, inject, signal, type ComponentFactory, type TemplateResult } from '@nisli/core';
import { createMatcher, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RouteDefinition } from './route.js';
import { Router, type RouterApplicationDefinition } from './router.js';

type AnyRouteDefinition = RouteDefinition<any, any>;
type RouteMap = Readonly<Record<string, AnyRouteDefinition>>;
type RoutesFrom<Input extends Record<string, unknown>> = {
  readonly [K in keyof Input as Input[K] extends AnyRouteDefinition ? K : never]:
    Extract<Input[K], AnyRouteDefinition>;
};
type InvalidRouterKeys<Input extends Record<string, unknown>> = {
  [K in keyof Input]: K extends 'notFound'
    ? Input[K] extends NotFoundDefinition ? never : K
    : Input[K] extends AnyRouteDefinition ? never : K;
}[keyof Input];

export type ApplicationRouter<R extends RouteMap> = ComponentFactory<Record<string, never>> & {
  readonly routes: R;
  readonly notFound?: NotFoundDefinition;
  readonly definition: RouterApplicationDefinition;
  match(input: URL | string, baseURL?: string | URL): RouteMatch | null;
};

let routerId = 0;

export function defineRouter<const Input extends Record<string, unknown>>(
  input: Input,
  options: { base?: string } = {},
  ...validation: InvalidRouterKeys<Input> extends never ? [] : [invalidRouterConfig: never]
): ApplicationRouter<RoutesFrom<Input>> {
  void validation;
  type R = RoutesFrom<Input>;
  const base = normalizeBase(options.base);
  const routes = Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter((entry): entry is [string, AnyRouteDefinition] => (
        typeof entry[1] === 'object' && entry[1] !== null &&
        (entry[1] as { kind?: unknown }).kind === 'route'
      ))
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
  const configuredNotFound = (input as { notFound?: NotFoundDefinition }).notFound;
  const notFound = configuredNotFound?.kind === 'not-found' ? configuredNotFound : undefined;
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
