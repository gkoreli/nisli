# nisli

A reactive web component framework. Signals, templates, dependency injection — no build step, no virtual DOM, no dependencies.

## Install

```bash
npm install @nisli/core
```

To add the source-first component registry with Tailwind v4 animations:

```bash
npm install @nisli/core
npm install -D @nisli/ui tailwindcss tw-animate-css
npx nisli-ui init
```

Then import `tailwindcss`, `tw-animate-css`, and the copied
`nisli-ui/styles/theme.css` in that order in your entry stylesheet.

## Quick Start

```typescript
import { signal, component, html } from '@nisli/core';

const Counter = component('x-counter', () => {
  const count = signal(0);
  return html`
    <button @click=${() => count.value++}>
      Count: ${count}
    </button>
  `;
});
```

## Features

- **Signals** — Fine-grained reactivity with `signal`, `computed`, `effect`
- **Components** — Web Components with a composition-style setup function
- **Templates** — Tagged template literals with automatic signal binding
- **Dependency Injection** — `inject` any class as a singleton, `provide` overrides for testing
- **Queries** — Declarative async data loading with caching and auto-refetch
- **Event Emitters** — Typed event bus with auto-disposal in component context
- **Lifecycle** — `onMount`, `onCleanup`, `useHostEvent`
- **Refs** — Direct element access via `ref()`
- **Control Flow** — `when()` for toggles, `each()` for keyed list rendering

## API

```typescript
// Reactivity
signal(value)           // Reactive signal
computed(() => expr)    // Derived signal (lazy, cached)
effect(() => { ... })   // Side effect that tracks dependencies

// Components
component('tag-name', (props, host) => html`...`)
component<Props>('tag-name', (props, host) => html`...`)

// Templates — signals are implicit, no .value needed
html`<div>${count}</div>`
html`<button @click=${handler}>Go</button>`
html`<div class:active=${isActive}>...</div>`

// Control flow
when(condition, () => html`...`)
each(items, item => item.id, (item) => html`...`)

// Dependency injection — class IS the token
inject(MyService)                    // Auto-creates singleton
provide(MyService, () => mock)       // Override (testing)

// Queries
const { data, loading, error } = query(
  () => ['tasks', id.value],         // Cache key (tracked)
  () => api.getTasks(id.value),      // Fetcher
)

// Lifecycle
onMount(() => { ... })
onCleanup(() => { ... })
useHostEvent(host, 'click', handler)

// Refs
const el = ref<HTMLDivElement>()
html`<div ref="${el}">...</div>`

// Events
class Nav extends Emitter<{ select: { id: string } }> {}
inject(Nav).emit('select', { id })
inject(Nav).on('select', ({ id }) => { ... })
```

## Static Site Generation

Use the companion `@nisli/ssg` package when you want build-time pages,
publication output, feeds, or other DOM-free static output.

```typescript
import { buildStaticSite } from '@nisli/ssg';

await buildStaticSite({
  outDir: 'dist',
  routes: [
    { path: '/', render: () => '<article>...</article>' },
  ],
});
```

`@nisli/core` stays focused on component authoring and the browser runtime.
`@nisli/ssg` owns static site generation; static rendering internals stay behind
the build tool.

## Vite HMR Plugin

`@nisli/core/vite-hmr` — a dev-only Vite plugin for granular component hot module replacement. Edit a component, it re-mounts in place with no page reload.

```ts
// vite.config.ts
import { nisliHmr } from '@nisli/core/vite-hmr';

export default defineConfig({
  plugins: [nisliHmr()],
});
```

Used in production by [backlog-mcp](https://github.com/gkoreli/backlog-mcp) — a single Vite process serves the SPA + API on one origin, with component edits hot-swapping via this plugin.

## Size

~2,600 lines of TypeScript. Zero dependencies.

## Inspiration

nisli stands on the shoulders of giants:

- [React](https://react.dev) — Component model, declarative UI
- [Solid](https://www.solidjs.com) — Signals, fine-grained reactivity, no virtual DOM
- [Lit](https://lit.dev) — Web Components, tagged template literals
- [Angular](https://angular.dev) — Dependency injection, typed tokens
- [Vue](https://vuejs.org) — Composition-style setup functions, reactive system design

## License

MIT
