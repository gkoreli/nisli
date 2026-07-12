---
name: nisli-framework
description: Reactive web component framework guidelines for code that uses `@nisli/core`. This skill should be used when writing, reviewing, migrating, or refactoring Nisli components, signals, templates, dependency injection, emitter events, or query-based data loading.
license: MIT
metadata:
  author: nisli-team
  version: "1.0.0"
---

# Nisli Framework — Agent Skill

Comprehensive guide for building reactive web components using `@nisli/core`. Contains rules across 9 categories covering component authoring, reactivity, templates, dependency injection, events, data loading, error handling, migration, and testing.

## When to Apply

Reference these guidelines when:
- Creating new web components with `@nisli/core`
- Migrating existing `HTMLElement`-based components to the reactive framework
- Writing or reviewing signal-based reactive state
- Implementing `html` tagged templates with bindings and `@event` handlers
- Using `inject()` / `provide()` for dependency injection
- Setting up `query()` for declarative data loading
- Wiring typed `Emitter` events between components
- Reviewing code for memory leaks, XSS, or lifecycle issues
- Writing tests for framework components

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Component Authoring | CRITICAL | `comp-` |
| 2 | Signals & Reactivity | CRITICAL | `signal-` |
| 3 | Template Engine | HIGH | `tmpl-` |
| 4 | Dependency Injection | HIGH | `di-` |
| 5 | Typed Emitters | MEDIUM-HIGH | `emitter-` |
| 6 | Declarative Data Loading | MEDIUM-HIGH | `query-` |
| 7 | Error Handling & Resilience | MEDIUM | `error-` |
| 8 | Migration & Interop | MEDIUM | `migration-` |
| 9 | Testing | LOW-MEDIUM | `test-` |

## Quick Reference

### 1. Component Authoring (CRITICAL)

- `comp-setup-sync` - Setup function MUST be synchronous; capture services sync, use them async
- `comp-props-signals` - All props are `Signal<T>` in setup; factories accept `T | Signal<T>` inputs
- `comp-factory-composition` - ALL custom elements MUST use factory composition; HTML tag syntax is ONLY for native elements (div, span, button)
- `comp-html-for-vanilla` - HTML tag syntax (`<tag>`) is ONLY for native HTML elements; never for custom elements
- `comp-no-this` - No `this` in components; use pure functions with props and host
- `comp-no-innerhtml` - Do not assign `innerHTML` imperatively; use templates, or `html:inner` only for trusted HTML
- `comp-host-escape-hatch` - `host` is the second param; use it only for imperative DOM access
- `comp-no-class-authoring` - Never extend HTMLElement directly for new components; use `component()`
- `comp-host-attrs` - Use second factory arg `{ class: '...' }` for host-level CSS classes (ADR 0009)
- `comp-prop-input` - Factory props accept `T | Signal<T>` — plain values are auto-wrapped (ADR 0009)

**Attribute reactivity (ADR 0025 item 3) — prefer over userland `attr()`/`boolAttr()`/`forwardedAttr()`:**
- `comp-attrs-declare` - Declare live attribute fallbacks via the `attrs` option: `component(tag, setup, { attrs: { disabled: 'boolean', id: 'forward', variant: 'string' } })`. Attribute name = kebab-case of the prop key (`className` ↔ `class-name`); `setAttribute` after mount updates the prop signal LIVE. Zero cost when `attrs` is omitted
- `comp-attrs-boolean` - Declared booleans: bare/any attribute → `true`, literal `"false"` → `false`, absent → declared default; use `{ type: 'boolean', default: true }` for opt-out flags. Declared-default booleans are runtime-guaranteed non-undefined
- `comp-attrs-forward` - `'forward'` relocates `id`/`name` off the layout-transparent host onto the inner control (native form participation) — replaces `forwardedAttr()`
- `comp-attrs-prop-pins` - An explicit DEFINED prop wins over its attribute; passing `undefined` does NOT pin (falls back to the attribute/default) — so spreading an unset optional prop stays attribute-driven

**Content projection (ADR 0025 item 1) — prefer over `captureChildren()`/`projectChildren()`:**
- `comp-children-slot` - Project content with `children(fallback?)`, interpolated as a slot: `html`<button>${children()}</button>``. It folds the factory `children` prop + captured light-DOM children + late parser children into ONE slot; no `captureChildren`/`projectChildren`/`onMount` dance
- `comp-children-fallback` - `children(fallback)` renders the fallback ONLY when no MEANINGFUL children exist (whitespace-only ignored) and REPLACES it reactively when children arrive — the conditional-default pattern; never hand-roll a default-swap
- `comp-children-single-slot` - One default slot per component (v1); named/multiple slots are not yet supported
- `comp-children-before-onmount` - Call `children()` during setup BEFORE any `onMount` that observes projected DOM. `children()` consumes the light-DOM capture at CALL time and registers its own late-parser sweep as an `onMount` (which run in registration order); a `${children()}` inlined in the returned template registers last, so an earlier `onMount` reading projected children would run before projection settles. Hoist it: `const slot = children(); … onMount(() => { /* reads projected DOM */ }); return html\`…${slot}…\``
- `comp-attrs-open-state` - Root open/pressed/value state uses attribute-as-truth (ADR 0025 item 3): declare `open: 'boolean'` (or `pressed`; string `value` for selection), the attribute IS the uncontrolled state (like native `<dialog open>`); `setX` writes it only when uncontrolled — `if (!isPinned(host, key)) host.toggleAttribute(key, next)` (setAttribute/removeAttribute for a string value) — and always dispatches the change event; a reflect `effect` mirrors resolved state back to the attribute; `defaultX` is init-seed-only, double-guarded (skip when pinned or when `host.hasAttribute(key)`). `isPinned(host, key)` from `lib/utils.ts` is the controlled discriminator
- `comp-register-signal-not-value` - When a child registers itself with a context-provided parent collection at mount, register the SIGNAL OBJECT itself (or an explicit getter thunk), never a snapshot `.value`, or a live attr/prop write never re-drives the parent. Child: `onMount(() => { parent.registerPanel(el, sizeSignal, minSignal); })` and `onCleanup(() => parent.unregisterPanel(el))`; parent: hold the registered signals in its collection, bump a registration-version signal on register/unregister, and run reactive effects that read the version plus every registered signal `.value` they depend on — those reads subscribe recomputation to live child writes, while cleanup keeps membership/layout math honest. Registering `size.value` once freezes the value; omitting unregister leaves detached entries stale. Reference implementation: `resizable` (default-size reflows membership; min-size re-clamps the current layout). Documented pattern per ADR 0025 candidate (c); graduates to a core `reactiveRegistry` primitive only when a second registration-reactive consumer lands

### 2. Signals & Reactivity (CRITICAL)

- `signal-value-read` - Always use `.value` in JS code; signals are implicit in `html` templates
- `signal-immutable-writes` - Mutating objects doesn't trigger updates; assign a new reference
- `signal-computed-derived` - Use `computed()` for derived state, not manual sync in effects
- `signal-effect-side-effects` - Effects are for side effects only (DOM, network, localStorage)
- `signal-coalesced-writes` - Multiple synchronous writes coalesce automatically; use `flush()` only when synchronous effects are needed
- `signal-no-async-in-setup-context` - `inject()`, `effect()`, `emitter.on()` must be called synchronously in setup
- `signal-untrack` - Use `untrack()` to read signals without tracking them as dependencies (ADR 0009)
- `signal-conditional-deps` - Dependencies are re-tracked on every run; conditional reads track correctly
- `signal-equality-object-is` - Signal equality uses `Object.is()`, not `===`

### 3. Template Engine (HIGH)

- `tmpl-implicit-signals` - Write `${count}` not `${count.value}` in templates
- `tmpl-no-eager-value-in-render` - NEVER read `signal.value` while building a template (inside a `computed`/render fn) — it leaks the signal into the enclosing view, so unrelated changes rebuild the whole subtree (scroll/focus/state lost). Pass the signal into the slot or use `each()` (ADR 0008.1)
- `tmpl-event-colocated` - Use `@click=${handler}` on the element, not detached listeners
- `tmpl-event-modifiers` - Use `.stop`, `.prevent`, `.once`, `.enter`, `.escape` modifiers
- `tmpl-class-directive` - Use `class:name=${signal}` for conditional classes, not ternary soup
- `tmpl-class-attribute-safe` - Reactive class attributes use classList, safe alongside class:name directives (ADR 0007)
- `tmpl-no-bare-array-slot` - NEVER use `computed(() => arr.map(...))` for reactive lists — causes full teardown; use `each()` instead
- `tmpl-computed-views` - Use `computed()` for multi-branch conditional rendering
- `tmpl-when-simple` - Use `when()` only for simple single-branch toggles
- `tmpl-xss-safe` - Text bindings use `textNode.data`; never parse user input as HTML
- `tmpl-comment-markers` - Framework uses `<!--bk-N-->` markers; avoid this pattern in content
- `tmpl-el-dynamic-tag` - For a tag chosen at RUNTIME (the one thing `html` can't express), use `el(tag, props?, children?)` — a factory returning a `TemplateResult` that composes in an `html` slot (`html`${el(tag, { class }, kids)}``). Prefer `html` for static tags. `el()` sets **attributes** (`setAttribute`, never `_setProp`) — a component tag reached via `el()` resolves values through its `attr()`/`boolAttr()` fallbacks, so use typed **factories** for typed composition. Props: `class` (string|signal), other keys → attribute, `ref`, `on: { event: handler }`; children take the full text-slot range. HTML-only in v1 (no SVG/namespaced tags)

### 4. Dependency Injection (HIGH)

**Two DI systems — pick by scope:**

| | App-global DI (`injector`) | Subtree context (`createContext`) |
|---|---|---|
| Import | free `inject()` / `provide()` | `createContext<T>(name)` → `.provide` / `.inject` methods |
| Scope | one app-wide singleton per token | per-provider, resolved by walking up the DOM |
| Token | the class itself | the context object's private symbol (typed, no strings) |
| Use for | services, stores, emitters, query clients | parent↔descendant component state (tabs/menus/dialog "state on the host") |
| Resolves via | the injector registry | `parentElement` walk from the injecting host |

They do not overlap: services are singletons; component-family state is subtree-scoped. Reach for `createContext` wherever you'd otherwise write `host.__uiX = state` + `host.closest('ui-x')`.

**App-global (`injector`):**
- `di-class-as-token` - Use the class itself as the injection token; no `createToken()` for services
- `di-auto-singleton` - `inject(Class)` auto-creates a singleton; no registration needed
- `di-provide-for-overrides` - `provide()` is for testing and subtree overrides only
- `di-sync-only` - `inject()` must be called synchronously during setup
- `di-bootstrap-eager` - Long-lived services with startup side effects must be eagerly created by the app
- `di-no-failed-cache` - Failed construction is never cached; next `inject()` retries

**Subtree context (`createContext`):**
- `ctx-provide-in-setup` - Provider calls `Ctx.provide(host, state)` in setup, before returning its template
- `ctx-inject-in-setup` - Descendants call `Ctx.inject()` (no host) in setup — this CAPTURES the value while still under the provider, so it survives later reparenting (portals). Outside setup, pass an explicit host: `Ctx.inject(host)`
- `ctx-value-holds-signals` - Put all reactivity in signals inside the provided value; **swapping the provided value object mid-life is unsupported** (inject resolves once, does not re-walk)
- `ctx-inject-throws` - `Ctx.inject()` throws into the setup error boundary when no provider exists; `Ctx.inject.optional()` returns `undefined` instead
- `ctx-peek-this-host-only` - `Ctx.peek(host)` reads the value on THAT host only (no walk) — the low-level primitive for bespoke walks (e.g. "nearest provider of A or B"); prefer `inject` for ordinary resolution
- `ctx-symbol-identity` - Distinct `createContext` calls never collide, even with the same `name` (name is diagnostic only); use separate contexts for separate scopes (e.g. one per menu family's radio-group)

### 5. Typed Emitters (MEDIUM-HIGH)

- `emitter-typed-events` - Extend `Emitter<T>` with a typed event map; no `CustomEvent` strings
- `emitter-inject-singleton` - Inject emitters via DI; they are auto-singleton services
- `emitter-auto-dispose` - `on()` inside component context auto-disposes on disconnect
- `emitter-to-signal` - Use `toSignal()` to bridge events into the reactive system
- `emitter-copy-on-emit` - `emit()` iterates a copy; safe to unsubscribe during callback

### 6. Declarative Data Loading (MEDIUM-HIGH)

- `query-key-function` - First arg is a key function returning an array; signals inside are tracked
- `query-cache-key` - Same cache key = same cached result; design keys for proper deduplication
- `query-generation-guard` - Stale responses are discarded via generation counter; no race conditions
- `query-enabled-guard` - Use `enabled` option to conditionally skip fetches
- `query-invalidate-prefix` - `invalidate(['tasks'])` matches all keys starting with `['tasks']`
- `query-disposed-check` - All async writes check `!disposed` before updating signals

### 7. Error Handling & Resilience (MEDIUM)

- `error-setup-boundary` - Setup errors render a fallback; sibling components unaffected
- `error-effect-survives` - Effect errors are logged, not thrown; the effect stays alive
- `error-effect-loop-guard` - Effects that re-run >100 times in 2s are auto-disposed (ADR 0009)
- `error-handler-wrapped` - `@event` handlers are try/caught; broken handlers don't crash the UI
- `error-cleanup-swallowed` - Cleanup/disposer errors are swallowed; disposal always completes
- `error-circular-detection` - Both computed and DI have circular dependency detection

### 8. Migration & Interop (MEDIUM)

- `migration-preserve-contract` - Preserve existing tag names and public APIs intentionally during migration
- `migration-prefer-services` - Prefer DI services, signals, and emitters over DOM querying or document events
- `migration-auto-resolve` - Template auto-resolves `_setProp` vs `setAttribute`; `class` uses classList (ADR 0007)

### 9. Testing (LOW-MEDIUM)

- `test-flush-effects` - Call `flushEffects()` after signal changes to run pending effects
- `test-cascading-flush` - Cascading effects need multiple `flushEffects()` calls
- `test-provide-mock` - Use `provide(Class, () => mock)` before `inject()` in tests
- `test-reset-injector` - Call `resetInjector()` between tests to clear singleton cache
- `test-query-client-isolated` - Provide a fresh `QueryClient` in tests for cache isolation

## How to Use

Read the full compiled document for detailed explanations and code examples: `AGENTS.md`

Each section contains:
- The invariant or rule explained
- Why it matters (the bug it prevents)
- Incorrect code example with explanation
- Correct code example with explanation
- References to framework source files
