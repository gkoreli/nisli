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
import { component, html, resource, sanitized } from '@nisli/core';

const Markdown = component<{ content: string }>('x-markdown', (props) => {
  const rendered = resource(
    () => props.content.value || undefined,
    // Rendered markdown is untrusted markup — brand it for the sanitizer.
    async (content, signal) => sanitized(await renderMarkdown(content, { signal })),
  );

  return html`<article html:inner=${rendered.data}></article>`;
});
```

`data`, `loading`, and `error` are readonly signals. `refresh()` reruns the
current source; component teardown disposes automatically, while standalone
callers can use `dispose()`. Returning `undefined` from the source disables the
resource and clears its current state.

## Trusted and untrusted HTML

`html:inner` never takes a bare string. The brand is where the trust decision
is made, and it picks the sink:

```ts
import { html, raw, sanitized, setSanitizerFallback } from '@nisli/core';

html`<article html:inner=${raw(ownMarkup)}></article>`;      // → innerHTML
html`<article html:inner=${sanitized(userMarkup)}></article>`; // → sanitizer
```

`raw()` is the author asserting the markup is already trustworthy; it is
written straight to `innerHTML`. Never wrap user-generated input in it. A
native `TrustedHTML` object (from a Trusted Types policy) is accepted on the
same path and passed through unwrapped, so apps under
`require-trusted-types-for 'script'` can assign policy output directly.

`sanitized()` is the opposite assertion — untrusted markup — and is written
with the platform's `Element.setHTML()` and its XSS-safe default sanitizer
where the engine has one (Chrome 146+, Firefox 148+). Where it does not
(Safari today), register a sanitizer once at startup:

```ts
setSanitizerFallback((el, markup) => {
  el.innerHTML = DOMPurify.sanitize(markup);
});
```

With no native `setHTML()` and no registered hook, the binding throws `N107`.
It fails closed by design: nisli never silently downgrades untrusted markup to
`innerHTML`, and never bundles a sanitizer of its own.

## Explicit resource management

Standalone Nisli disposables support `using` on runtimes with native explicit
resource management:

```ts
{
  using stop = effect(() => console.log(count.value));
  using tasks = query(() => ['tasks'], fetchTasks);
}
```

This applies to `effect()`, signal/computed `subscribe()`, `Emitter.on()`,
`resource()`, and `query()`. Existing callable disposers and `.dispose()`
methods are unchanged. Nisli only attaches the guarded `Symbol.dispose` alias;
it never polyfills the platform. Apps that downlevel `using` for older runtimes
must provide their own `Symbol.dispose` polyfill.

## View transitions

`viewTransition()` wraps a state update in a native View Transition. It calls
`flush()` inside the browser's update callback, so the DOM mutation captured
between the old and new frames is Nisli's own synchronous flush rather than the
next microtask:

```ts
viewTransition(() => { items.value = sorted; }, { types: ['reorder'] });
```

It is opt-in and progressively enhanced. Without
`document.startViewTransition` the update still applies — synchronously,
flushed, unanimated — and the call returns `null` instead of a `ViewTransition`
handle. Engines that predate transition types get the plain callback form, so
the transition still runs and only type-scoped CSS goes unmatched. No polyfill,
no UA sniffing, and nothing in your bundle unless you import it.

Nisli ships no stylesheet. The root crossfade is the browser default; tune it,
and answer `prefers-reduced-motion` in CSS so the swap stays atomic and typed
styles stay active while the motion is cut:

```css
::view-transition-old(root),
::view-transition-new(root) { animation-duration: 200ms; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

Keep async work outside the callback — the page is frozen during capture — and
use the returned handle (`finished`, `ready`, `skipTransition()`) for hard
opt-outs and for superseding an in-flight transition.

Animating a keyed `each()` list needs one thing spelled out: the
`<each-item>` wrapper is `display: contents`, and a box-less element cannot be
captured, so `view-transition-name` must sit on the item's painted child — the
element your item template actually renders. Put it there and `each()`'s stable
per-key DOM identity does the rest, with no generated names:

```css
.card {
  view-transition-name: match-element;  /* identity-keyed, nothing to bookkeep */
  view-transition-class: card;          /* styles every card as one group */
}
::view-transition-group(.card) { animation-duration: 200ms; }
```

## Core capabilities

- Fine-grained reactivity: `signal`, `computed`, `effect`, `untrack`, `flush`,
  and awaitable `tick`.
- Typed web components: composition-style synchronous setup, signal-backed
  props, typed factories, and live attribute declarations.
- Safe light-DOM templates: signal bindings, typed events and modifiers,
  `class:*`, branded `html:inner` (trusted or sanitizer-routed), refs, and
  dynamic HTML tags through `el()`.
- Stable control flow: lazy `when()` branches and keyed `each()` lists that
  preserve focus, scroll position, and component state, moved atomically with
  `moveBefore()` where the engine has it.
- Two scopes of dependency injection: app-wide singleton services with
  `inject`/`provide`, and portal-safe subtree state with `createContext`.
- Lifecycle and resilience: `onMount`, `onCleanup`, `useHostEvent`, automatic
  effect/event cleanup, move-resilient disconnects, and component error
  boundaries.
- Async work: `resource` handles local async derivations; `query` and
  `QueryClient` add shared caching, invalidation, and reactive refetching.
- Typed application events with `Emitter` and automatic component cleanup.

## Ecosystem

The Nisli repository contains four independently versioned packages and the
site that exercises them together:

- [`@nisli/core`](https://github.com/gkoreli/nisli/tree/main/packages/core) —
  component authoring and browser runtime.
- [`@nisli/router`](https://github.com/gkoreli/nisli/tree/main/packages/router)
  — one typed route catalog for browser, Vite, static builds, and edge/Worker
  matching. It includes codecs, redirects, managed SEO metadata,
  render-separated catalogs, and accessible outlets.
- [`@nisli/ssg`](https://github.com/gkoreli/nisli/tree/main/packages/ssg) —
  renders normal Nisli templates and the shared application router to static
  output.
- [`@nisli/ui`](https://github.com/gkoreli/nisli/tree/main/packages/ui) —
  “shadcn for Nisli”: a CLI and source registry that copy accessible, Tailwind
  v4 components into your project.
- [`packages/www`](https://github.com/gkoreli/nisli/tree/main/packages/www) —
  the private nisli.dev application and end-to-end integration surface.

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

Architecture decisions live in the
[`docs/adr`](https://github.com/gkoreli/nisli/tree/main/docs/adr) directory.
Package-specific usage and release history live beside each package.

## Inspiration

Nisli stands on the shoulders of React's component model, Solid's fine-grained
reactivity, Lit's web components and templates, Angular's dependency injection,
and Vue's composition-style authoring.

## License

MIT
