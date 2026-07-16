# nisli

A small, reactive web-component framework built on browser standards. Nisli
combines fine-grained signals, typed component factories, light-DOM templates,
dependency injection, routing, and static generation without a virtual DOM or
a framework compiler.

## Install

```sh
npm install @nisli/core
```

`@nisli/core` has no runtime dependencies. It works with TypeScript or plain
JavaScript and does not require a framework-specific build step.

## Quick start

```ts
import { component, html, signal } from '@nisli/core';

const Counter = component('x-counter', () => {
  const count = signal(0);

  return html`
    <button @click=${() => count.value++}>
      Count: ${count}
    </button>
  `;
});

html`${Counter({})}`.mount(document.body);
```

Signals are read with `.value` in TypeScript and passed directly to templates.
Only the bound text, attribute, class, or child slot updates when a signal
changes.

## Components that also work as HTML

`component()` registers a standard custom element and returns its typed factory.
Factory callers can pass plain values or signals. The optional `attrs` map makes
selected host attributes live, so plain-HTML consumers and factory consumers
share the same component implementation.

```ts
import {
  children,
  component,
  html,
  type ComponentAttrs,
} from '@nisli/core';

interface DisclosureProps {
  open?: boolean;
  children?: unknown;
}

const attrs = {
  open: 'boolean',
} satisfies ComponentAttrs<DisclosureProps>;

const Disclosure = component<DisclosureProps, typeof attrs>(
  'x-disclosure',
  (props) => {
    const content = children('Nothing to show');
    return html`
      <section class:open=${props.open}>
        ${content}
      </section>
    `;
  },
  { attrs },
);
```

```ts
html`${Disclosure({ open: true, children: 'Factory content' })}`;
```

```html
<x-disclosure open>Plain HTML content</x-disclosure>
```

Declared string, boolean, number, and forwarded attributes react to
`setAttribute()` after mount. `children(fallback?)` projects factory children,
initial light-DOM children, and late parser children through one reactive slot.

## Async derivations

Use `resource()` when a local value is derived asynchronously and does not need
query caching or invalidation policy. Only the synchronous source function is
tracked; stale work is aborted and cannot overwrite a newer result.

```ts
import { component, html, resource } from '@nisli/core';

const Markdown = component<{ content: string }>('x-markdown', (props) => {
  const rendered = resource(
    () => props.content.value || undefined,
    (content, signal) => renderMarkdown(content, { signal }),
  );

  return html`<article html:inner=${rendered.data}></article>`;
});
```

`data`, `loading`, and `error` are readonly signals. `refresh()` reruns the
current source; component teardown disposes automatically, while standalone
callers can use `dispose()`. Returning `undefined` from the source disables the
resource and clears its current state.

## Core capabilities

- Fine-grained reactivity: `signal`, `computed`, `effect`, `untrack`, `flush`,
  and awaitable `tick`.
- Typed web components: composition-style synchronous setup, signal-backed
  props, typed factories, and live attribute declarations.
- Safe light-DOM templates: signal bindings, typed events and modifiers,
  `class:*`, trusted `html:inner`, refs, and dynamic HTML tags through `el()`.
- Stable control flow: lazy `when()` branches and keyed `each()` lists that
  preserve focus, scroll position, and component state.
- Two scopes of dependency injection: app-wide singleton services with
  `inject`/`provide`, and portal-safe subtree state with `createContext`.
- Lifecycle and resilience: `onMount`, `onCleanup`, `useHostEvent`, automatic
  effect/event cleanup, move-resilient disconnects, and component error
  boundaries.
- Async work: `resource` handles local async derivations; `query` and
  `QueryClient` add shared caching, invalidation, and reactive refetching.
- Typed application events with `Emitter` and automatic component cleanup.

## Ecosystem

This repository contains four independently versioned packages and the site
that exercises them together:

- [`@nisli/core`](./packages/core) — component authoring and browser runtime.
- [`@nisli/router`](./packages/router) — one typed route catalog for browser,
  Vite, static builds, and edge/Worker matching. It includes codecs, redirects,
  managed SEO metadata, render-separated catalogs, and accessible outlets.
- [`@nisli/ssg`](./packages/ssg) — renders normal Nisli templates and the shared
  application router to static output.
- [`@nisli/ui`](./packages/ui) — “shadcn for Nisli”: a CLI and source registry
  that copy accessible, Tailwind v4 components into your project.
- [`packages/www`](./packages/www) — the private nisli.dev application and
  end-to-end integration surface.

### Source-owned UI components

```sh
npm install -D @nisli/ui tailwindcss tw-animate-css
npx nisli-ui init
npx nisli-ui add button dialog tabs
```

Import `tailwindcss`, `tw-animate-css`, and the copied
`nisli-ui/styles/theme.css` in that order. The copied `ui-*` components support
typed Nisli factories and plain HTML; your application owns the resulting
source.

### One router across environments

```ts
import { html } from '@nisli/core';
import { defineRouter, route } from '@nisli/router';

export const AppRouter = defineRouter({
  home: route('/', {
    metadata: { title: 'Home' },
    render: () => html`<h1>Home</h1>`,
  }),
});
```

Mount `AppRouter({})` in the browser, pass the same router to
`nisliRoutes(AppRouter)` for Vite direct-route fallback, and pass it to
`buildStaticSite({ router: AppRouter })` for static output. Larger applications
can author an environment-neutral catalog from `@nisli/router/catalog` and
attach client renderers later with `bindRenders()`.

### Vite HMR

```ts
import { defineConfig } from 'vite';
import { nisliHmr } from '@nisli/core/vite-hmr';

export default defineConfig({
  plugins: [nisliHmr()],
});
```

The development-only plugin remounts an edited component in place without a
full page reload.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Architecture decisions live in [`docs/adr`](./docs/adr). Package-specific
usage and release history live beside each package.

## Inspiration

Nisli stands on the shoulders of React's component model, Solid's fine-grained
reactivity, Lit's web components and templates, Angular's dependency injection,
and Vue's composition-style authoring.

## License

MIT
