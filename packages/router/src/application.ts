import { component, getCurrentComponent, html, inject, signal, type ComponentFactory, type TemplateResult } from '@nisli/core';
import { createMatcher, defineRoutes, prefixBase, type RouteMatch } from './matcher.js';
import type { NotFoundDefinition, RedirectDefinition, RouteDefinition } from './route.js';
import { Router, type EngineOption, type RouterApplicationDefinition, type RouterViewTransitions } from './router.js';

type AnyRouteDefinition = RouteDefinition<any, any, any>;
type RouteMap = Readonly<Record<string, AnyRouteDefinition>>;
type RoutesFrom<Input extends Record<string, unknown>> = {
  readonly [K in keyof Input as Input[K] extends AnyRouteDefinition ? K : never]:
    Extract<Input[K], AnyRouteDefinition>;
};
type InvalidRouterKeys<Input extends Record<string, unknown>> = {
  [K in keyof Input]: K extends 'notFound'
    ? Input[K] extends NotFoundDefinition ? never : K
    : Input[K] extends AnyRouteDefinition ? never
      : Input[K] extends RedirectDefinition<any> ? never : K;
}[keyof Input];

/**
 * Attributes applied to the router outlet's `<main>` landmark host. Conservative
 * surface: `id` (e.g. for a skip link `href="#main-content"`) and any `aria-*`.
 * The managed `role="main"`/`tabindex="-1"` are applied *after* these and are not
 * part of this type, so the landmark + focus contract cannot be overridden.
 */
export interface OutletAttrs {
  id?: string;
  [attr: `aria-${string}`]: string | undefined;
}

export type ApplicationRouter<R extends RouteMap> = ComponentFactory<Record<string, never>> & {
  readonly routes: R;
  readonly notFound?: NotFoundDefinition;
  readonly definition: RouterApplicationDefinition;
  match(input: URL | string, baseURL?: string | URL): RouteMatch | null;
};

let routerId = 0;

export function defineRouter<const Input extends Record<string, unknown>>(
  input: Input,
  options: {
    base?: string;
    outletAttrs?: OutletAttrs;
    engine?: EngineOption;
    viewTransitions?: RouterViewTransitions;
  } = {},
  ...validation: InvalidRouterKeys<Input> extends never ? [] : [invalidRouterConfig: never]
): ApplicationRouter<RoutesFrom<Input>> {
  void validation;
  type R = RoutesFrom<Input>;
  // Partition the flat catalog through the one shared normalizer so the browser
  // outlet and any Worker consuming the same catalog can never disagree.
  const partitioned = defineRoutes(input as Parameters<typeof defineRoutes>[0], { base: options.base });
  const base = partitioned.base;
  const routes = Object.fromEntries(
    Object.entries(partitioned.routes).map(([name, definition]) => {
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
  const definition: RouterApplicationDefinition = Object.freeze({
    routes,
    redirects: partitioned.redirects,
    notFound: partitioned.notFound,
    base,
  });
  const match = createMatcher(definition);
  const tagName = `nisli-router-${++routerId}`;
  let outletFactory: ComponentFactory<Record<string, never>> | undefined;
  const factory = ((props, hostAttrs) => {
    outletFactory ??= component(tagName, (_props, host) => {
      const router = inject(Router);
      const rendered = signal<TemplateResult | null>(null);
      applyOutletAttrs(host, options.outletAttrs);
      // Managed landmark contract, applied last so it cannot be overridden. The
      // host is the `<main>` landmark, the skip-link target and the focus
      // target, and one element cannot be all three without generating a box:
      // `display: contents` makes it unfocusable and makes a fragment jump to
      // its `id` land nowhere.
      host.setAttribute('role', 'main');
      host.setAttribute('tabindex', '-1');
      host.style.display = 'block';
      const disconnect = router.connect(definition, host, rendered, {
        engine: options.engine,
        viewTransitions: options.viewTransitions,
      });
      getCurrentComponent().addDisposer(disconnect);
      return html`${rendered}`;
    });
    return outletFactory(props, hostAttrs);
  }) as ApplicationRouter<R>;
  Object.defineProperties(factory, {
    routes: { value: routes, enumerable: true },
    notFound: { value: partitioned.notFound, enumerable: true },
    definition: { value: definition, enumerable: true },
    match: { value: match, enumerable: true },
  });
  return factory;
}

/** Apply consumer outlet attributes, restricted to `id`/`aria-*` even at runtime. */
function applyOutletAttrs(host: HTMLElement, attrs?: OutletAttrs): void {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (name === 'id' || name.startsWith('aria-')) host.setAttribute(name, String(value));
  }
}
