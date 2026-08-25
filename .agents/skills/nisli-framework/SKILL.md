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
- `comp-no-innerhtml` - Do not assign `innerHTML` imperatively; use templates. `html:inner` is the only sanctioned sink and it takes a BRAND, never a bare string — `raw()` for trusted markup, `sanitized()` for untrusted (see `tmpl-inner-brands`)
- `comp-host-escape-hatch` - `host` is the second param; use it only for imperative DOM access
- `comp-no-class-authoring` - Never extend HTMLElement directly for new components; use `component()`
- `comp-host-attrs` - Use second factory arg `{ class: '...' }` for host-level CSS classes (ADR 0009)
- `comp-prop-input` - Factory props accept `T | Signal<T>` — plain values are auto-wrapped (ADR 0009)

**Attribute reactivity (ADR 0025 item 3) — prefer over userland `attr()`/`boolAttr()`/`forwardedAttr()`:**
- `comp-attrs-declare` - Declare live attribute fallbacks via the `attrs` option: `component(tag, setup, { attrs: { disabled: 'boolean', id: 'forward', variant: 'string' } })`. Attribute name = kebab-case of the prop key (`className` ↔ `class-name`); `setAttribute` after mount updates the prop signal LIVE. Zero cost when `attrs` is omitted
- `comp-attrs-boolean` - Declared booleans: bare/any attribute → `true`, literal `"false"` → `false`, absent → declared default; use `{ type: 'boolean', default: true }` for opt-out flags. Declared-default booleans are runtime-guaranteed non-undefined
- `comp-attrs-forward` - `'forward'` relocates `id`/`name` off the layout-transparent host onto the inner control (native form participation) — replaces `forwardedAttr()`
- `comp-attrs-prop-pins` - An explicit DEFINED prop wins over its attribute; passing `undefined` does NOT pin (falls back to the attribute/default) — so spreading an unset optional prop stays attribute-driven
- `comp-transparent-host-no-style-attr` - NEVER declare `style` in the `attrs` map of a component that calls `transparentHost(host)`. `transparentHost` writes `display: contents` on the host; observing `style` feeds that implementation value back into `props.style`, so forwarding the prop paints `display:contents` onto the inner box. Keep inner-node style passthrough factory-only (UI-54)

**Content projection (ADR 0025 item 1) — prefer over `captureChildren()`/`projectChildren()`:**
- `comp-children-slot` - Project content with `children(fallback?)`, interpolated as a slot: `html`<button>${children()}</button>``. It folds the factory `children` prop + captured light-DOM children + late parser children into ONE slot; no `captureChildren`/`projectChildren`/`onMount` dance
- `comp-children-fallback` - `children(fallback)` renders the fallback ONLY when no MEANINGFUL children exist (whitespace-only ignored) and REPLACES it reactively when children arrive — the conditional-default pattern; never hand-roll a default-swap
- `comp-children-single-slot` - One default slot per component (v1); named/multiple slots are not yet supported
- `comp-children-before-onmount` - Call `children()` during setup BEFORE any `onMount` that observes projected DOM. `children()` consumes the light-DOM capture at CALL time and registers its own late-parser sweep as an `onMount` (which run in registration order); a `${children()}` inlined in the returned template registers last, so an earlier `onMount` reading projected children would run before projection settles. Hoist it: `const slot = children(); … onMount(() => { /* reads projected DOM */ }); return html\`…${slot}…\``
- `comp-attrs-open-state` - Root open/pressed/value state uses attribute-as-truth (ADR 0025 item 3): declare `open: 'boolean'` (or `pressed`; string `value` for selection), the attribute IS the uncontrolled state (like native `<dialog open>`); `setX` writes it only when uncontrolled — `if (!isPinned(host, key)) host.toggleAttribute(key, next)` (setAttribute/removeAttribute for a string value) — and always dispatches the change event; a reflect `effect` mirrors resolved state back to the attribute; `defaultX` is init-seed-only, double-guarded (skip when pinned or when `host.hasAttribute(key)`). `isPinned(host, key)` from `lib/utils.ts` is the controlled discriminator
- `comp-register-signal-not-value` - When a child registers itself with a context-provided parent collection at mount, register the SIGNAL OBJECT itself (or an explicit getter thunk), never a snapshot `.value`, or a live attr/prop write never re-drives the parent. Child: `onMount(() => { parent.registerPanel(el, sizeSignal, minSignal); })` and `onCleanup(() => parent.unregisterPanel(el))`; parent: hold the registered signals in its collection, bump a registration-version signal on register/unregister, and run reactive effects that read the version plus every registered signal `.value` they depend on — those reads subscribe recomputation to live child writes, while cleanup keeps membership/layout math honest. Registering `size.value` once freezes the value; omitting unregister leaves detached entries stale. Reference implementation: `resizable` (default-size reflows membership; min-size re-clamps the current layout). Documented pattern per ADR 0025 candidate (c); graduates to a core `reactiveRegistry` primitive only when a second registration-reactive consumer lands

- `comp-transparent-host-hazards` - `display: contents` hosts are real DOM nodes but generate NO box, which breaks two distinct upstream-port categories. (1) BOX-MODEL: box utilities (`ring`, margins/`space-*`, borders, backgrounds) and direct-child/positional selectors (`>`, `*:`, `first:`, `last:`, `divide-x/y`) aimed at what upstream renders as a direct painted child are dead through the host. At port time, mechanically audit every such upstream selector against the rendered DOM and translate it to the boxed DESCENDANT (`**:` / explicit host depth, the command/avatar/field/ButtonGroup precedent); verbatim utility-token equality is not parity when the selector cannot reach the painted node. Never declare `@container` on the host (a boxless element cannot be a container). (2) NATIVE-RELATIONSHIP: platform contracts requiring structural parent→child (`fieldset`→`legend` naming, `select`→`option`, table row/cell) break when the host interposes — restore the semantics explicitly (e.g. `aria-labelledby` wiring, the FormField/FieldSet precedent) and test the restored relationship, not just the markup. Check BOTH categories at port design time; document each translation in the file and the parity worklist

- `comp-move-resilient-setup` - Component setup NEVER re-runs on a DOM move, on any engine. Keyed `each()` reorders and `portal()` use `moveBefore()` where the engine has it (Chromium/Firefox: `connectedMoveCallback` fires with no connect/disconnect pair, and focus, input selection, iframes, running animations and open popovers survive); WebKit has no `moveBefore()` yet and takes the `insertBefore()` path, where those are lost — but ADR 0023's deferred teardown (disconnect waits one microtask and skips if the node reconnected) still keeps setup from re-running there. Components define an empty `connectedMoveCallback` so the platform treats an atomic move as a move. So never write re-init guards, `_alreadySetUp` flags, or "restore state on reconnect" code for moves; and never assume document `Selection` survives — neither path preserves it
- `comp-host-box-for-focus` - The layout-transparent host is a convention, NOT a law: a host that must hold focus, be scrolled to, or serve as a fragment/skip-link target MUST generate a box, because a box-less element is neither focusable nor a viable fragment target. The `@nisli/router` outlet is exactly that host and is `display: block` BY DESIGN (managed `role="main"` + `tabindex="-1"` + `display: block`, applied after `outletAttrs` and not overridable), so the outlet host — not the route content — is the flex/grid item in your shell: give it a stable `id` via `outletAttrs` and style it, or lay the route out inside the route. NEVER "fix" a focusable host back to `display: contents`; the push-navigation focus reset and every `href="#main-content"` skip link silently become no-ops

### 2. Signals & Reactivity (CRITICAL)

- `signal-value-read` - Always use `.value` in JS code; signals are implicit in `html` templates
- `signal-immutable-writes` - Mutating objects doesn't trigger updates; assign a new reference
- `signal-computed-derived` - Use `computed()` for derived state, not manual sync in effects
- `signal-effect-side-effects` - Effects are for side effects only (DOM, network, localStorage)
- `signal-coalesced-writes` - Multiple synchronous writes coalesce automatically; use `flush()` only when synchronous effects are needed
- `signal-view-transition` - Animate a state change with `viewTransition(update, { types })`: it calls `flush()` INSIDE the browser's update callback, so the frame the browser captures is nisli's own synchronous flush and not the next microtask — a bare signal write in that callback mutates after the capture window and animates a frame to itself. `update` MUST be synchronous (the page is frozen during capture): keep loaders and fetches outside and wrap only the commit. With no `document.startViewTransition` the update still applies — synchronously, flushed, unanimated — and the return is `null`, so null-check before touching `finished`/`ready`/`skipTransition()`. Answer `prefers-reduced-motion` in CSS, NEVER by branching in JS: the call still runs, so the swap stays atomic and typed styles stay live while the motion is cut. For route navigations use the router's wrapper instead — `defineRouter(catalog, { viewTransitions: { enabled, types } })` plus per-navigation `NavigateOptions.viewTransition` — which wraps only the COMMIT and leaves the awaited render outside the callback
- `signal-disposer-using` - Disposables carry a guarded `Symbol.dispose` alias, so `using stop = effect(…)` releases at scope exit — likewise for `subscribe()`, `Emitter` handles, `resource()` and `query()`. Nisli attaches the alias only where the runtime already has `Symbol.dispose` and NEVER polyfills; the callable disposer and `.dispose()` are unchanged. Inside component setup disposal is still automatic — reach for `using` in services, standalone code, and tests
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
- `tmpl-each-view-transition-name` - Put `view-transition-name` on the item's PAINTED child, never on the `<each-item>` wrapper: the wrapper is `display: contents` and a box-less element cannot be captured. With the name on the painted child, `each()`'s stable per-key DOM identity carries the rest — `view-transition-name: match-element` needs no generated per-item names, and `view-transition-class` styles the whole group. `match-element` is same-document only; cross-document names must be spelled out explicitly on both pages
- `tmpl-computed-views` - Use `computed()` for multi-branch conditional rendering
- `tmpl-when-simple` - `when(cond, then, else?)` is the boolean-gated one-or-two-branch toggle; use `computed()` for 3+ branches. The gate is `!!cond` and a truthy→truthy transition returns the memoized result, so the live branch is never rebuilt. Pass lazy `() => html\`…\`` arms so only the active branch is constructed, and interpolate reactive parts as signals — branch callbacks evaluate UNTRACKED
- `tmpl-xss-safe` - Text bindings use `textNode.data`; never parse user input as HTML
- `tmpl-inner-brands` - `html:inner` never takes a bare string; the brand IS the trust decision and it picks the sink. `raw(markup)` = author-asserted trust → `innerHTML` (a native `TrustedHTML` rides the same sink, passed through unwrapped). `sanitized(markup)` = untrusted → the platform's `Element.setHTML()`, else an app-registered `setSanitizerFallback()` hook, else it THROWS N107. `sanitized()` NEVER falls back to `innerHTML` and nisli bundles no sanitizer, so an app that must run on engines without native `setHTML()` registers a fallback once at startup. Never wrap user input in `raw()`, and — the brands being structural — never pass unvalidated parsed JSON to `html:inner`
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
- `di-provide-for-overrides` - `provide()` is for tests and deliberate overrides only, and it MUST come before the first `inject()` of that token: once the token is instantiated the injector is frozen for it and `provide()` throws N501 (overriding later would leave old consumers on the old instance — a silent mixed-instance split). `resetInjector()` is the escape hatch
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

- `query-key-function` - First arg is a key function whose signal reads are tracked; keys are FLAT `readonly (string|number|boolean|null)[]` with `null` as the optional sentinel. Objects, nested arrays, `undefined` and non-finite numbers throw N602 (synchronously at the call site for the construction-time key) — spread object params into tuple elements. Flat keys are order-sensitive, so a reordered key is a cache MISS: use per-endpoint key-builder helpers
- `query-cache-key` - Same key = one per-key RECORD in the `QueryClient` (`data`/`error`/`status`/`fetchedAt` signals + at most one run in flight); `query()` is a thin observer over it, so dedup is structural. The most-recently-mounted ENABLED observer's fetcher/`retry` owns the next run, `staleTime` is per-observer policy, and records are never GC'd (bound it with `client.clear()` or a per-lifetime client)
- `query-read-signals` - Read `data`/`loading`/`error`/`status` — there are NO `onSuccess`/`onError` options (removed); the signals ARE the notification. Options are `staleTime`, `retry`, `enabled`, `initialData` (a seed into an idle record, not a fetch). `refetch()` bypasses freshness but JOINS an in-flight run
- `query-generation-guard` - Runs are superseded, not raced: starting a run aborts the previous `AbortController`, bumps the record's generation, and hands the new controller's `signal` to the fetcher — take it and pass it to `fetch`. Every commit point re-checks the generation, so a superseded run cannot write even if it ignored the abort; a synchronous fetcher throw becomes a normal rejection on the same retry/terminal path
- `query-enabled-guard` - Use `enabled` to skip fetches; its signal reads are tracked and flipping back to `true` revalidates. `loading` is `false` while disabled, so neither a disabled query nor a key switch can strand it
- `query-invalidate-prefix` - `invalidate(['tasks'])` matches element-by-element over validated keys (no string-prefix, no deserialization), marks matches stale, reruns only records with ≥1 enabled observer, and returns the count; disabled observers revalidate on re-enable. `clear()` drops every record and aborts in-flight runs
- `query-dispose-unregisters` - `dispose()` unregisters THIS observer; the record and any in-flight run survive, and a zero-observer run still completes and commits. Component setup disposes automatically — there is no detached-signal write to guard against, because the record's signals belong to the client
- `resource-source-tracked` - For local async derivations, `resource(source, loader)` tracks ONLY synchronous signal reads in `source`; loader reads are never dependencies; `undefined` disables and clears
- `resource-stale-safe` - Source changes, refresh, and disposal abort/invalidate older loader generations so stale results cannot commit
- `resource-vs-query` - Use `resource()` for local derived async work (markdown, transforms); use `query()` only when shared cache keys/invalidation are required

### 7. Error Handling & Resilience (MEDIUM)

- `error-setup-boundary` - A setup or `onMount` throw is contained: the partial scope is torn down, the host is stamped `data-nisli-error="N401"`/`"N402"`, a fallback renders (`onError` or a default red div), and a bubbling composed `nisli-error` event fires LAST with `{ code, tag, phase, message }`. The stamp is the durable channel (`querySelectorAll('[data-nisli-error]')`) and is cleared by a successful re-setup; siblings are unaffected
- `error-effect-survives` - Effect errors are logged, not thrown, and the effect stays alive to retry on the next change — the only exception is the N301 loop guard, which disposes
- `error-effect-loop-guard` - The effect loop guard is clock-free: an effect that re-schedules ITSELF on 100 consecutive runs is diagnosed (N301) and disposed. Converging writers pass, because an equal write stops the cascade at the `Object.is` cutoff
- `error-handler-wrapped` - `@event` handlers are try/caught; broken handlers don't crash the UI
- `error-cleanup-swallowed` - Cleanup/disposer errors are swallowed; disposal always completes
- `error-circular-detection` - Both computed and DI have circular dependency detection
- `error-coded-diagnostics` - Framework failures speak stable `[nisli N…]` codes — assert on the CODE, not the prose (`N1xx` template, `N2xx` define/props, `N3xx` reactivity, `N4xx` component containment, `N501` DI freeze, `N6xx` query/async). Reporting sits behind a dev gate probed once from Vite flags then `NODE_ENV`, loud by default in buildless ESM and silent in production builds; guarded BEHAVIOUR is never gated, so thrown codes (N107, N501, N602) throw in production too

### 8. Migration & Interop (MEDIUM)

- `migration-preserve-contract` - Preserve existing tag names and public APIs intentionally during migration
- `migration-prefer-services` - Prefer DI services, signals, and emitters over DOM querying or document events
- `migration-auto-resolve` - Template auto-resolves `_setProp` vs `setAttribute`; `class` uses classList (ADR 0007)
- `migration-prerender-gate` - Speculation-rules prerendering runs a page FULLY in a hidden document, so DOM wiring (listeners, custom-element upgrades, island mounts) may legitimately run while prerendering — but anything OBSERVABLE (analytics, timers, autofocus, media playback) must be wrapped in `whenActive()` from `@nisli/ssg/client`, which defers to `prerenderingchange` and runs the callback immediately where `document.prerendering`, or the document itself, is absent
- `migration-ssg-view-transitions` - Cross-document view transitions are a BUILD option, not an authoring one: both the outgoing and incoming document must carry `@view-transition { navigation: auto }`, and only the build sees every page. Opt in with `buildStaticSite({ viewTransitions: true })` (object form adds speculation rules); absent or `false` leaves output byte-identical

### 9. Testing (LOW-MEDIUM)

- `test-flush-effects` - Call `flush()` after signal changes to run pending effects synchronously (`flushEffects` is a back-compat alias for the same function)
- `test-one-flush-drains-the-cascade` - ONE `flush()` settles the whole synchronous cascade — the double-`flushEffects()` idiom is obsolete. If a second flush changes the result the work is not synchronous: use `await tick()` for microtask-scheduled work and `await settle()` for query/resource async, instead of polling helpers
- `test-provide-mock` - `provide(Class, () => mock)` must precede the first `inject()` or it throws N501 — in practice `resetInjector()` then `provide()` in `beforeEach`
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
