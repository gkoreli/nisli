# Nisli Framework — Complete Agent Guide

This document contains every rule for writing, reviewing, and migrating components using `@nisli/core`. Each rule includes the invariant, the bug it prevents, and correct/incorrect code examples.

**Framework source**: <https://github.com/gkoreli/nisli/tree/main/packages/core/src>
**ADR documentation**: <https://github.com/gkoreli/nisli/tree/main/docs/adr>
**Package entry points**: `@nisli/core`, `@nisli/core/vite-hmr`

---

## 1. Component Authoring (CRITICAL)

### `comp-setup-sync` — Setup function MUST be synchronous

The setup function runs inside `runWithContext()` which sets a module-level `currentComponent` variable. After the function returns, the context is gone. Any async code (await, .then, setTimeout) runs AFTER context is cleared.

```typescript
// ❌ WRONG — inject() will throw "called outside setup"
component('my-el', async (props) => {
  await someInit();
  const api = inject(ApiService); // THROWS
});

// ✅ CORRECT — capture everything synchronously, use async later
component('my-el', (props) => {
  const api = inject(ApiService); // works — sync in setup
  effect(() => {
    api.fetchData(props.id.value); // api captured in closure, safe
  });
  return html`...`;
});
```

### `comp-props-signals` — Props are signals in setup; factories accept values or signals

Props are declared as a TypeScript interface. Inside setup, every prop is a `Signal<T>`. Factory callers may pass either a `Signal<T>` for reactive updates or a plain `T` for a static value.

```typescript
interface TaskItemProps {
  task: Task;
  selected: boolean;
}

// Static value — accepted, but it will not update if currentTask changes later
TaskItem({ task: currentTask.value, selected: true })

// ✅ CORRECT — pass signals, child stays reactive
TaskItem({ task: currentTask, selected: isSelected })

// ✅ CORRECT — for truly static props, pass plain values
TaskItem({ task: staticTask, selected: false })
```

Inside the component, props are accessed as signals:

```typescript
component<TaskItemProps>('task-item', (props) => {
  // props.task → Signal<Task>
  // props.selected → Signal<boolean>
  const title = computed(() => props.task.value.title);
  return html`<span>${title}</span>`;
});
```

### `comp-factory-composition` — ALL custom elements MUST use factory composition

`component()` returns a typed factory function. ALL custom elements — whether framework components or migrated vanilla elements — MUST be consumed via their factory. HTML tag syntax (`<my-element>`) is ONLY for native HTML elements (`div`, `span`, `button`, `input`, etc.).

```typescript
const TaskItem = component<TaskItemProps>('task-item', (props) => { ... });

// ✅ Factory — type-safe, compile-time checked
html`<div>${TaskItem({ task: sig, selected: sel })}</div>`

// ❌ WRONG — never use HTML tag syntax for custom elements
html`<task-item task="${sig}" selected="${sel}"></task-item>`
```

### `comp-html-for-vanilla` — HTML tag syntax is ONLY for native elements

HTML tag syntax in templates is reserved for native HTML elements only. All custom elements must use factory composition for type safety and proper signal passing.

```typescript
// ✅ Native elements — HTML tag syntax
html`<div class="container"><span>${text}</span><button @click=${handler}>Go</button></div>`

// ✅ Custom elements — factory composition
const icon = SvgIcon({ src: signal(myIcon), size: signal('16px') });
const badge = TaskBadge({ taskId: props.id });
html`<div>${icon} ${badge}</div>`

// ❌ WRONG — custom element via HTML tag
html`<svg-icon src="${myIcon}" size="16px"></svg-icon>`
html`<task-badge task-id="${props.id}"></task-badge>`
```

### `comp-no-this` — No `this` in components

Components are pure functions. All state is via signals, services via `inject()`, DOM via `host` parameter.

```typescript
// ❌ WRONG
class MyComponent extends HTMLElement {
  this.count = 0;
}

// ✅ CORRECT
component('my-el', (props, host) => {
  const count = signal(0);
  return html`<span>${count}</span>`;
});
```

### `comp-no-innerhtml` — Do not assign innerHTML imperatively

The framework does targeted DOM patching via signal bindings. Imperative `innerHTML` assignment destroys the entire subtree, losing all state, focus, scroll position, and event listeners.

```typescript
// ❌ WRONG — destroys everything
host.innerHTML = `<div>${data}</div>`;

// ✅ CORRECT — targeted updates via signals
const content = signal(data);
return html`<div>${content}</div>`;
```

For HTML you must inject, `html:inner` is the only sanctioned sink — and it
never takes a bare string. The brand carries the trust decision and selects the
sink (see `tmpl-inner-brands`):

```typescript
html`<div html:inner=${raw(ownMarkup)}></div>`;        // trusted → innerHTML
html`<div html:inner=${sanitized(userMarkup)}></div>`; // untrusted → sanitizer
```

### `comp-host-escape-hatch` — Use host only for imperative DOM access

The `host` parameter is the raw `HTMLElement`. Use it only when you need imperative DOM APIs: `focus()`, `scrollIntoView()`, `getBoundingClientRect()`, third-party library init.

```typescript
component('my-el', (_props, host) => {
  // ✅ Legitimate use — imperative DOM API
  host.classList.add('loaded');

  // ❌ WRONG — use signals and templates instead
  host.innerHTML = '<div>content</div>';
});
```

### `comp-no-class-authoring` — Never extend HTMLElement for new components

All new components MUST use `component()`. There is no "simple attribute-driven leaf" exception any more: the `attrs` option declares live host attributes (string / boolean / number / forward kinds, with defaults), so an attribute-driven leaf is a normal `component()` with `{ attrs }`.

### `comp-move-resilient-setup` — Setup never re-runs on a DOM move

A same-tick remove + re-insert is a MOVE, not a removal, but per WHATWG an
append-based move fires `disconnectedCallback` then `connectedCallback`. Moves
happen routinely inside the framework — keyed `each()` reorders, `portal()`,
light-DOM projection of nested components — and re-running setup on one would
duplicate rendered output and lose state. Two mechanisms make that impossible:

- **Atomic moves.** Keyed `each()` reorders and `portal()` use `moveBefore()`
  where the engine has it, so the node is relocated instead of removed and
  re-inserted, and components define an empty `connectedMoveCallback` so the
  platform treats the move as a move. On Chromium and Firefox a reorder fires
  `connectedMoveCallback` with no connect/disconnect pair, and preserves focus,
  input selection, iframes (no reload), running animations including
  `currentTime`, and open popovers.
- **Deferred teardown (ADR 0023).** WebKit has no `moveBefore()` yet and takes
  the `insertBefore()` path, where that platform state is lost. Setup still
  never re-runs: `disconnectedCallback` defers teardown one microtask and skips
  it when the element is connected again, and `connectedCallback`'s `_mounted`
  guard makes the whole move a no-op. True removals still dispose, one
  microtask later.

```typescript
// ❌ WRONG — guarding against a remount that cannot happen. The branch is
//    dead code, and the "re-init" it implies is a bug waiting to be written.
const Row = component<RowProps>('my-row', (props, host) => {
  if (host.dataset.inited) return html`<div></div>`;
  host.dataset.inited = '1';
  return html`<div>${props.title}</div>`;
});

// ✅ CORRECT — setup runs once per element lifetime. Local state survives
//    every keyed reorder and every portal move.
const Row = component<RowProps>('my-row', (props) => {
  const expanded = signal(false);
  return html`<div class:open=${expanded}>${props.title}</div>`;
});
```

Document `Selection` is the one exception: `moveBefore()` does not preserve it
and neither does the fallback. Never build on it surviving a reorder.

### `comp-host-box-for-focus` — A focusable or fragment-targeted host must generate a box

Layout-transparent hosts (`display: contents`) are the convention: the host
stays a real DOM node but generates no box, so the component's own element does
not interpose in its parent's layout. The convention has a hard limit — a
box-less element cannot hold focus and is not a viable fragment target — so a
host that is *also* a focus target, a scroll target, or a skip-link destination
MUST generate a box.

The `@nisli/router` outlet is that host. It is the application's `<main>`
landmark, the focus target of a push navigation, and the skip-link target, and
it carries all three at once:

```typescript
host.setAttribute('role', 'main');
host.setAttribute('tabindex', '-1');
host.style.display = 'block';   // applied after outletAttrs; not overridable
```

With `display: contents` there instead, the documented push→outlet focus reset
was a silent no-op in Chromium, Firefox and WebKit alike, and a skip link to
the outlet's `id` could neither focus nor scroll. Never "restore" it.

The layout consequence is intended: the outlet **host** is the flex/grid item
inside your shell, not the route content. Give it a stable `id` through
`outletAttrs` and style the host, or move the layout inside the route.

```typescript
const AppRouter = defineRouter(catalog, {
  outletAttrs: { id: 'main-content', 'aria-label': 'Main content' },
});
// html`<a href="#main-content" class="skip-link">Skip to content</a>`
```

---

## 2. Signals & Reactivity (CRITICAL)

### `signal-value-read` — Use `.value` in JS, implicit in templates

Signal reads require `.value` in JavaScript code (TypeScript enforces this). In `html` templates, signals are implicit — the template engine detects them and subscribes automatically.

```typescript
const count = signal(0);
const doubled = computed(() => count.value * 2); // .value in JS

// In templates — implicit, no .value
html`<span>${count}</span><span>${doubled}</span>`
```

### `signal-immutable-writes` — Assign new references for object signals

Signals use `Object.is()` for equality. Mutating an object's property doesn't change the reference, so no update fires.

```typescript
const data = signal({ x: 1 });

// ❌ WRONG — same reference, Object.is returns true, NO update
data.value.x = 2;

// ✅ CORRECT — new reference triggers update
data.value = { ...data.value, x: 2 };
```

### `signal-computed-derived` — Use computed() for derived state

Never manually synchronize derived state in effects. `computed()` is lazy, cached, and auto-tracks dependencies.

```typescript
// ❌ WRONG — manual sync, error-prone, extra signal
const doubled = signal(0);
effect(() => { doubled.value = count.value * 2; });

// ✅ CORRECT — derived, lazy, cached
const doubled = computed(() => count.value * 2);
```

### `signal-effect-side-effects` — Effects are for side effects only

Effects should perform external operations (DOM manipulation, localStorage writes, network calls). Don't use effects to compute derived state — use `computed()` for that.

```typescript
// ✅ CORRECT — effect for side effect
effect(() => {
  localStorage.setItem('sort', currentSort.value);
});

// ✅ CORRECT — effect for DOM imperative work
effect(() => {
  const select = host.querySelector('select') as HTMLSelectElement | null;
  if (select) select.value = currentSort.value;
});
```

### `signal-coalesced-writes` — Synchronous writes coalesce automatically

Multiple synchronous `.value` writes coalesce into one effect pass automatically. Write the signals directly. Use `flush()` only when code after the writes must observe DOM/effect side effects synchronously.

```typescript
filter.value = 'active';
sort.value = 'updated';
page.value = 1;

// Optional: only for imperative read-after-effect cases
flush();
```

There is no public `batch()` API. ADR 0015 removed it because microtask coalescing already handles normal multi-signal updates.

### `signal-view-transition` — viewTransition() flushes inside the capture window

`viewTransition(update, { types })` wraps a state update in a native View
Transition. `document.startViewTransition()` captures the OLD frame, runs the
update callback, then captures the NEW frame — and nisli coalesces signal
writes onto a microtask, so a bare write inside that callback would mutate the
DOM *after* the capture window and the browser would animate a frame to itself.
`viewTransition()` calls `flush()` inside the callback, so what the browser
snapshots is nisli's own synchronous flush.

```typescript
// ❌ WRONG — the write lands after the capture window; nothing animates.
document.startViewTransition(() => { items.value = sorted; });

// ✅ CORRECT — flush() runs inside the callback for you.
viewTransition(() => { items.value = sorted; }, { types: ['reorder'] });
```

`update` MUST be synchronous — the page is frozen during capture. Await the
data first and wrap only the commit:

```typescript
// ❌ WRONG — async work inside the capture window
viewTransition(async () => { items.value = await load(); });

// ✅ CORRECT
const next = await load();
viewTransition(() => { items.value = next; });
```

Progressive enhancement goes all the way down. Without
`document.startViewTransition` the update still applies — synchronously,
flushed, unanimated — and the call returns `null` instead of a handle, so
null-check before touching `finished`, `ready`, or `skipTransition()`. Engines
predating transition types get the plain callback form: the transition still
runs and only type-scoped CSS goes unmatched. No polyfill, no UA sniffing.

Core ships no stylesheet, and **reduced motion is answered in CSS, never by
branching in JS**: keep calling `viewTransition()` so the swap stays atomic and
typed styles stay active, and neutralise the motion with a media query.

```css
::view-transition-old(root),
::view-transition-new(root) { animation-duration: 200ms; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }
}
```

For route navigations, do not hand-roll this. `@nisli/router` has its own
policy layer — `defineRouter(catalog, { viewTransitions: { enabled, types } })`
with a per-navigation `NavigateOptions.viewTransition` override (`false`,
`true`, or `{ types }`). It wraps only the **commit** — rendered output,
managed head, and the scroll/focus effects, so title and meta swap atomically
inside the snapshot — and leaves the awaited route render outside, so a slow
loader never freezes the page inside a capture window.

### `signal-disposer-using` — Disposables support `using`

Every nisli disposer carries a guarded `Symbol.dispose` alias beside the
callable form, so explicit resource management works where the runtime has it:

```typescript
{
  using stop = effect(() => console.log(count.value));
  using tasks = query(() => ['tasks'], fetchTasks);
}   // both released here
```

This covers `effect()`, signal/computed `subscribe()`, `Emitter.on()` handles,
`resource()`, and `query()`. The alias is attached only when `Symbol.dispose`
exists — nisli never polyfills the platform, so code that downlevels `using`
for older runtimes must supply its own polyfill. The callable disposer and
`.dispose()` are unchanged.

Inside component setup you do not need this: effects, subscriptions, emitter
handles, resources, and queries already dispose on disconnect. `using` is for
services, standalone code, and tests.

### `signal-no-async-in-setup-context` — Reactive primitives are synchronous

`inject()`, `effect()`, and `emitter.on()` rely on the setup context. They MUST be called synchronously during setup — never inside `await`, `.then()`, `setTimeout`, or any async boundary.

```typescript
// ❌ WRONG — context is gone after await
component('my-el', async (props) => {
  await delay(100);
  const api = inject(ApiService); // THROWS
  effect(() => { ... }); // THROWS
});

// ✅ CORRECT — all registration is synchronous
component('my-el', (props) => {
  const api = inject(ApiService);
  effect(() => { /* use api here */ });
  return html`...`;
});
```

### `signal-conditional-deps` — Dependencies are re-tracked every run

Before a computed or effect re-evaluates, ALL previous subscriptions are removed. Dependencies are discovered fresh on each run. This makes conditional dependencies correct:

```typescript
// This tracks `a` OR `b` depending on `flag`, and switches correctly
const result = computed(() => flag.value ? a.value : b.value);

// When flag changes from true → false:
// - a is unsubscribed, b is subscribed
// - Changes to a no longer trigger recomputation
```

### `signal-equality-object-is` — Signal equality uses Object.is()

Signal writes and computed value comparisons use `Object.is()`, not `===`. This correctly handles `NaN === NaN` (Object.is returns true, preventing infinite loops). Changing to `===` would cause `signal(NaN)` to notify on every write.

---

## 3. Template Engine (HIGH)

### `tmpl-implicit-signals` — Write `${signal}` not `${signal.value}` in templates

The `html` tagged template receives raw values in `${}` slots. It detects signals via `SIGNAL_BRAND`, reads `.value` for initial render, and subscribes for updates.

```typescript
const count = signal(0);
const label = computed(() => `Count: ${count.value}`);

// ❌ WRONG — reads value once, loses reactivity
html`<span>${count.value}</span>`

// ✅ CORRECT — template engine handles subscription
html`<span>${count}</span>`
html`<span>${label}</span>`
```

### `tmpl-no-eager-value-in-render` — Never read `.value` while building a template

Reactivity tracks through a single global active observer: **while a `computed`
or `effect` is running, every `signal.value` read anywhere is registered as a
dependency of that scope.** Building a template is not exempt. If you read a
signal's `.value` *eagerly* while constructing the template a `computed` returns
(or inside a render helper called from one), you subscribe the **enclosing view**
to that signal — not the leaf binding.

This is the same teardown footgun as `tmpl-no-bare-array-slot`, reached by a
different route. When the leaked signal changes, the enclosing computed view
re-runs and its reactive slot rebuilds the **entire subtree**.

**Symptoms** (identical to a bare-array slot — shared root cause):
- Scroll position resets; focus / text selection / IME state lost
- Expanded/collapsed, hover, and animation state reset on unrelated edits
- A whole panel re-renders when one nested value changes

```typescript
// ❌ WRONG — eager .value read leaks `r.label` into `view`.
//    Editing ONE row's label rebuilds the WHOLE <ul> (scroll/focus lost).
const view = computed(() => {
  const rows = store.rows.value;                 // structural dep — intended
  return html`<ul>${rows.map(r =>
    html`<li>${r.label.value}</li>`              // ← leaks r.label into `view`
  )}</ul>`;
});

// ✅ CORRECT — pass the signal into the slot; the leaf text-binding owns the
//    subscription, so `view` depends only on `store.rows`.
const view = computed(() => {
  const rows = store.rows.value;
  return html`<ul>${rows.map(r => html`<li>${r.label}</li>`)}</ul>`;
});

// ✅ BEST for dynamic lists — each() gives keyed, per-item reactivity
html`<ul>${each(store.rows, r => r.id, r => html`<li>${computed(() => r.value.label)}</li>`)}</ul>`
```

**Rule of thumb:** inside a `computed`/render function, read `.value` ONLY for
values that *should* re-run that computed — structural inputs like list length
or which branch to show. For per-item and leaf values, pass the **signal itself**
into the slot (`${signal}`, see `tmpl-implicit-signals`) so the binding
subscribes, not the view.

**Deliberate snapshot:** if you genuinely need a one-shot read without
subscribing the enclosing scope, wrap it in `untrack()` (see `signal-untrack`).

**Contributor note:** the engine obeys the same invariant — mounting must never
establish dependencies in the enclosing scope. `replaceMarkerWithBinding`
creates the child slot's dedicated effect before reading its current value, and
reactive slots memoize by referential identity. See ADR 0008.1.

### `tmpl-event-colocated` — Use @event on the element

Events are part of the template, colocated with elements. No detached listeners, no selector coupling.

```typescript
// ❌ WRONG — selector coupling, breaks if class changes
host.querySelector('.save-btn')?.addEventListener('click', onSave);

// ✅ CORRECT — event on the element
html`<button @click=${onSave}>Save</button>`
```

Event handlers are wrapped in try/catch — a throwing handler logs the error but doesn't crash the component.

### `tmpl-event-modifiers` — Use built-in event modifiers

The template engine supports modifiers on `@event` bindings:

```typescript
html`
  <button @click.stop=${handler}>Click</button>         <!-- stopPropagation -->
  <form @submit.prevent=${onSubmit}>...</form>           <!-- preventDefault -->
  <button @click.once=${handler}>One time</button>       <!-- auto-unsubscribe -->
  <input @keydown.enter=${onSubmit} />                   <!-- filter by key -->
  <input @keydown.escape=${onCancel} />                  <!-- filter by key -->
`
```

Modifier order: `.stop`/`.prevent` wrap first, then `.once`, then keyboard filters.

### `tmpl-class-directive` — Use class:name for conditional classes

Toggle Tailwind classes cleanly without ternary expressions:

```typescript
// ❌ WRONG — ternary soup
html`<div class="p-2 ${selected.value ? 'bg-white/10' : ''}">`;

// ✅ CORRECT — class:name directive
html`<div class="p-2"
          class:bg-white/10=${selected}
          class:border-l-2=${selected}>`;
```

Uses `classList.toggle(name, bool)` — preserves other classes on the element.

### `tmpl-class-attribute-safe` — Reactive class attributes use classList, not setAttribute

The class attribute binding uses `classList.add/remove` internally (not `setAttribute('class', ...)`) so it composes safely with `class:name` directives on the same element. This means `class` with signal interpolations and `class:name` directives can coexist:

```typescript
// ✅ SAFE — class attribute + class:name directives on the same element
const type = signal('task');
const selected = signal(true);
html`<div class="item type-${type}" class:selected="${selected}">`;
// Changing type.value does NOT wipe out 'selected' class
```

See [ADR 0007](https://github.com/gkoreli/nisli/blob/main/docs/adr/0007-class-attribute-classList-conflict.md) for the full bug analysis.

### `tmpl-computed-views` — Use computed() for multi-branch rendering

For anything with 2+ branches, use `computed()` to select the template in JavaScript:

```typescript
const content = computed(() => {
  if (loading.value) return html`<div class="animate-pulse">Loading...</div>`;
  if (error.value) return html`<div class="text-red-400">${error}</div>`;
  return html`<div>${data}</div>`;
});

return html`<div class="container">${content}</div>`;
```

### `tmpl-no-bare-array-slot` — NEVER use computed(() => arr.map(...)) for reactive lists

A bare `computed(() => items.value.map(renderItem))` in a template slot does **full teardown-and-remount** of every item on every signal change. This is intentional — the framework has no key to reconcile by, so it correctly refuses to guess and destroys/recreates all DOM nodes.

**Symptoms of this mistake:**
- Scroll position resets (scroll container jumps to top)
- Focus is lost (input fields lose cursor position)
- Stateful children reset (expanded/collapsed state, animations, diff2html renders)
- Performance degrades linearly with list size

This is the #1 performance footgun in nisli. The code *looks* correct and produces the right DOM — it just destroys and rebuilds it every time.

```typescript
// ❌ WRONG — full teardown on every change. Looks correct, silently broken.
const taskList = computed(() =>
  tasks.value.map(t => html`<div>${t.title}</div>`)
);
html`<div class="scroll-container">${taskList}</div>`
// ^ Every time tasks changes: all DOM removed, all DOM recreated, scroll jumps

// ❌ ALSO WRONG — same problem even with factory components
const taskList = computed(() =>
  tasks.value.map(t => TaskItem({ task: t }))
);

// ✅ CORRECT — use each() for keyed reconciliation
html`<div class="scroll-container">${each(
  tasks,
  t => t.id,
  (task) => html`<div>${computed(() => task.value.title)}</div>`
)}</div>`
// ^ Only affected nodes update; scroll/focus/state preserved
```

**Why the framework can't auto-reconcile bare arrays:**
- `html\`...\`` returns a frozen `TemplateResult` with no identity across renders
- Ten items from the same `html\`<div>...\`` call site share one `TemplateStringsArray` — the framework knows "same shape" but never "this is item #7 from last render"
- Positional (index-based) matching would silently bind wrong state to wrong logical row on insert/remove/reorder — worse than the teardown
- The key is irreducible input that only `each()` demands

**When bare arrays ARE fine:**
- Static arrays that never change after mount (not wrapped in computed/signal)
- Very short lists (2-3 items) with no scroll container or stateful children
- Conditional fragments where teardown is the desired behavior

### `tmpl-each-lists` — Use each() for reactive list rendering

`each()` renders an array of items reactively with keyed reconciliation. When the array signal changes, only affected DOM nodes are added, removed, or reordered.

```typescript
const tasks = signal([...]);

html`<div>${each(
  tasks,
  (task) => task.id,                     // key function
  (task, index) => html`                  // template function
    <div class="task-item">
      <span>${computed(() => task.value.title)}</span>
    </div>
  `,
)}</div>`
```

**Key rules:**
- First argument is a signal of an array
- Key function maps each item to a unique, stable key
- Duplicate keys log an actionable error and skip that reconciliation, leaving
  the last valid DOM intact until the array is corrected
- Template function receives `ReadonlySignal<T>` (not raw T) — use `.value` in computed/effect
- Each item updates in-place via its signal — no remount for data changes
- Reorders relocate the item's stable wrapper with `moveBefore()` where the
  engine has it — atomic, so focus, selection, iframes and running animations
  survive; the `insertBefore()` fallback loses those but still never re-runs
  component setup (see `comp-move-resilient-setup`)
- One `flush()` (a.k.a. `flushEffects()`) settles the whole synchronous cascade, so a test needs no second flush after an each() update — see `test-flush-effects`

```typescript
// ❌ WRONG — static array, no reactivity
const items = tasks.value.map(t => html`<li>${t.title}</li>`);

// ✅ CORRECT — reactive list with keyed reconciliation
each(tasks, t => t.id, (task) => html`<li>${computed(() => task.value.title)}</li>`)
```

### `tmpl-each-view-transition-name` — Name the painted child, not the `<each-item>` wrapper

`each()` wraps every item in a stable `<each-item>` element styled
`display: contents`. That wrapper is what gives an item DOM identity across
reorders — and, generating no box, it can never be captured by a view
transition. `view-transition-name` on it does nothing.

Put the name on the element your item template actually paints:

```typescript
each(cards, c => c.id, (card) => html`
  <div class="card">${computed(() => card.value.title)}</div>
`)
```

```css
.card {
  view-transition-name: match-element;  /* identity-keyed, nothing to bookkeep */
  view-transition-class: card;          /* styles every card as one group */
}
::view-transition-group(.card) { animation-duration: 200ms; }
```

`each()`'s stable per-key DOM identity is exactly what `match-element` needs,
so there are no generated per-item names to allocate, thread through props, or
clean up. `match-element` is same-document only — element identity cannot cross
a document boundary — so cross-document transitions still need explicit names
written on both pages.

### `tmpl-when-simple` — when() is the one- or two-branch toggle

`when(condition, then, else?)` gates on `!!condition`. Both arms accept a
`TemplateResult` or a lazy `() => TemplateResult`, and only the active arm's
callback is evaluated. Use `computed()` once there are three or more branches.

```typescript
// ✅ Single-branch toggle
html`${when(hasUnsaved, html`<span class="text-yellow-400">Unsaved</span>`)}`

// ✅ Two branches — one when(), lazy arms so the inactive branch is not built
html`${when(loading,
  () => html`<div>Loading…</div>`,
  () => html`<div>${content}</div>`,
)}`

// ❌ WRONG — two mirrored when() calls, plus an inverse computed, where an
//    else arm belongs
const notLoading = computed(() => !loading.value);
html`${when(loading, html`<div>Loading...</div>`)}
     ${when(notLoading, html`<div>${content}</div>`)}`
```

A truthy→truthy (or falsy→falsy) transition returns the memoized previous
result, so the live branch is never rebuilt and no state, scroll, or focus is
lost. Branch callbacks evaluate **untracked**: a signal read while constructing
a branch does not subscribe the `when()`, so interpolate reactive parts as
signals or computeds instead of reading them raw at construction time.

### `tmpl-xss-safe` — Text bindings are safe by default

Text bindings use `textNode.data = String(value)` — the browser treats it as text content, never parsing HTML. Attribute bindings use `setAttribute()`. User-generated content in `${}` slots is never parsed as HTML.

```typescript
const userInput = signal('<img onerror=alert(1)>');

// ✅ SAFE — renders as visible text, not HTML
html`<span>${userInput}</span>`

// ⚠️ DANGEROUS — href/src with user input needs validation
html`<a href="${userInput}">Link</a>` // javascript: URLs would execute
```

### `tmpl-inner-brands` — html:inner takes a brand, never a string

`html:inner` is the one binding that parses markup, and it refuses bare
strings. The brand you wrap the value in *is* the trust decision, and it selects
the sink.

```typescript
import { html, raw, sanitized, setSanitizerFallback } from '@nisli/core';

// ❌ WRONG — a bare string has made no trust decision
html`<article html:inner=${markup}></article>`;

// ✅ Author-asserted trust → innerHTML. NEVER wrap user input in raw().
html`<article html:inner=${raw(ownMarkup)}></article>`;

// ✅ Untrusted → the sanitizer sink. It never reaches innerHTML.
html`<article html:inner=${sanitized(userMarkup)}></article>`;
```

`sanitized()` is written with the platform's `Element.setHTML()` and its
XSS-safe default sanitizer where the engine has one. Where it does not, it uses
the hook the app registered once at startup:

```typescript
setSanitizerFallback((el, markup) => {
  el.innerHTML = DOMPurify.sanitize(markup);
});
```

With no native `setHTML()` and no registered hook, the binding **throws N107**.
It fails closed by design: nisli never silently downgrades untrusted markup to
`innerHTML`, and ships no sanitizer of its own. The native method is recognised
by identity (`Element.prototype.setHTML`), so an element-local callable merely
*named* `setHTML` is not trusted and falls through to the hook or to N107.

A native `TrustedHTML` object from a Trusted Types policy rides the `raw()`
sink and is passed through unwrapped, so apps under
`require-trusted-types-for 'script'` can assign policy output directly.

**Known limitation:** the brands are structural, so an object forged from
untrusted JSON (`{"__raw": true, "value": "…"}`) satisfies `raw()`'s check and
reaches `innerHTML`. Never pass unvalidated parsed JSON to `html:inner`.

### `tmpl-comment-markers` — Framework uses <!--bk-N--> markers

Each `${}` in the tagged template becomes `<!--bk-0-->`, `<!--bk-1-->`, etc. Avoid this pattern in your content. The `bk-` prefix is the collision boundary.

---

## 4. Dependency Injection (HIGH)

### `di-class-as-token` — Use the class as the injection token

A class constructor is already a unique JavaScript object reference, already typed, already named. No `createToken()` needed for services.

```typescript
class ApiService {
  async getTasks(filter: string): Promise<Task[]> { ... }
}

// ✅ Class IS the token
const api = inject(ApiService);

// Only for non-class dependencies (config objects, primitives):
const AppConfig = createToken<{ apiUrl: string }>('AppConfig');
provide(AppConfig, () => ({ apiUrl: '/api' }));
```

### `di-auto-singleton` — inject() auto-creates singletons

`inject(Class)` checks the global cache, creates via `new Class()` if not present, and returns the singleton. No registration step needed.

```typescript
// First call — creates singleton
const api = inject(ApiService);

// All subsequent calls — same instance
inject(ApiService) === inject(ApiService) // always true
```

Singleton identity is a hard contract. Breaking it means diverging state.

### `di-provide-for-overrides` — provide() must come before the first inject()

`provide(Class, factory)` registers a factory override and drops any cached
instance, so the next `inject()` builds from the factory. It is for tests and
deliberate overrides — not an application wiring step.

Ordering is a hard contract: once a token has been instantiated, the injector is
FROZEN for it and `provide()` throws the coded error **N501** in dev. Overriding
after the fact would leave everything that already injected holding the old
instance while later `inject()` calls got the new one — a silent mixed-instance
split.

```typescript
// ✅ CORRECT — override before anything injects it
provide(ApiService, () => new MockApiService());
const api = inject(ApiService); // the mock

// ❌ WRONG — throws N501: the singleton already exists
inject(ApiService);
provide(ApiService, () => new MockApiService());

// ✅ CORRECT — the escape hatch between tests
resetInjector();
provide(ApiService, () => new MockApiService());
```

### `di-sync-only` — inject() must be called during setup

`inject()` requires the setup context. Call it synchronously in the component setup function.

### `di-bootstrap-eager` — Startup side-effect services must be eagerly created

Services that must not miss startup events or must begin work before any component requests them should be eagerly instantiated by the app before the component tree mounts:

```typescript
const service = inject(StartupService);
service.start();
```

### `di-no-failed-cache` — Failed construction is never cached

If `new Class()` or the factory throws, the error propagates but no instance is stored. The next `inject()` call retries construction. This prevents permanently broken services from a temporary failure.

### `di-circular-detection` — Circular dependencies throw immediately

An `instantiating` set detects circular dependencies. If A's constructor calls `inject(B)` and B's constructor calls `inject(A)`, it throws immediately instead of stack overflow.

---

## 5. Typed Emitters (MEDIUM-HIGH)

### `emitter-typed-events` — Extend Emitter<T> with a typed event map

Replace `document.dispatchEvent(new CustomEvent(...))` with typed emitter services:

```typescript
class NavigationEvents extends Emitter<{
  select: { id: string };
  filter: { filter: string; type: string };
}> {}

// Producer
const nav = inject(NavigationEvents);
nav.emit('select', { id: props.task.value.id });
// Type error if payload shape is wrong

// Consumer
nav.on('select', ({ id }) => setSelectedId(id));
// Type-safe — id is string, not any
```

### `emitter-inject-singleton` — Inject emitters via DI

Emitters are services. `inject(NavigationEvents)` returns the same singleton everywhere. Producers and consumers automatically share the same instance.

### `emitter-auto-dispose` — on() auto-disposes in component context

If `on()` is called during component setup (when `hasContext()` is true), the unsubscribe function is auto-registered as a disposer. On disconnect, the subscription is cleaned up.

Outside component context (services, tests), the caller gets the unsubscribe function and must manage it.

### `emitter-to-signal` — Bridge events into the reactive system

`toSignal()` creates a signal that updates on every event:

```typescript
const nav = inject(NavigationEvents);
const selectedId = nav.toSignal('select', e => e.id, null);
// selectedId is Signal<string | null>
// Updates every time 'select' is emitted
```

If called inside component context, auto-disposes. Outside context, the subscription is permanent.

### `emitter-copy-on-emit` — emit() iterates a copy of subscribers

`emit()` copies the subscriber set before iterating. It's safe to unsubscribe during a callback. One broken subscriber cannot prevent others from executing — errors are logged with `console.error`.

---

## 6. Declarative Data Loading (MEDIUM-HIGH)

### `resource-source-tracked` — Local async derivations have an explicit source

Use `resource(source, loader)` when async work derives a local value and does
not need query caching or invalidation policy. Only signal reads in the
synchronous `source()` function are tracked:

```typescript
const rendered = resource(
  () => props.markdown.value || undefined,
  (markdown, signal) => renderMarkdown(markdown, { signal }),
);
```

The loader starts outside the reactive observer. Signal reads inside it —
before or after `await` — do not become dependencies. This makes the source
contract explicit and avoids pretending async dependency tracking crosses
await boundaries. Returning `undefined` disables the resource, aborts current
work, and clears `data`/`error`.

### `resource-stale-safe` — Older async work cannot commit

Every source change and `refresh()` starts a new generation and aborts the
previous loader's `AbortSignal`. Generation checks remain authoritative when a
loader ignores abort. Component teardown disposes automatically; standalone
callers must call `dispose()`.

`resource()` exposes readonly `data`, `loading`, and `error` signals. It retains
the latest successful data while a newer generation loads.

### `resource-vs-query` — Local derivation vs shared server cache

Use `resource()` for local transformations such as asynchronous markdown
rendering. Use `query()` when consumers intentionally share a cache key and
need stale-time, prefetch, or invalidation behavior. Do not invent a cache key
for local derived content merely to obtain loading/error signals.

### `query-key-function` — Reactive key function, flat primitive keys

The first argument returns the cache key. Signals read inside it are tracked, so
a key change re-registers the query on the record the new key names. The fetcher
receives that run's `AbortSignal`.

```typescript
const tasks = query(
  () => ['tasks', props.scopeId.value],          // tracked: scopeId
  (signal) => api.getTasks(props.scopeId.value, { signal }),
);
// When scopeId changes → re-register on the new record, fetch if it needs one
```

Keys are **flat**: `readonly (string | number | boolean | null)[]`. `null` is
the optional sentinel. Anything else — an object, a nested array, `undefined`, a
non-finite number — throws the coded error **N602**, synchronously at the
`query()` call site for the construction-time key.

```typescript
// ❌ WRONG — N602. Objects have no stable serialization contract here.
query(() => ['tasks', { scope: id.value, page }], fetchTasks);

// ✅ CORRECT — spread object params into tuple elements
query(() => ['tasks', id.value, page], fetchTasks);

// ❌ WRONG — N602: undefined at index 1
query(() => ['tasks', maybeId.value], fetchTasks);

// ✅ CORRECT — null is the optional sentinel
query(() => ['tasks', maybeId.value ?? null], fetchTasks);
```

Flat keys are order-sensitive, so a reordered key is a cache *miss* rather than
a collision. Prefer a per-endpoint key-builder helper over hand-writing tuples
at each call site.

### `query-cache-key` — Same key = one logical request

The cache unit is a per-key record in the `QueryClient`: `data`, `error`,
`status`, and `fetchedAt` signals plus at most one run in flight. `query()`
itself is a thin OBSERVER registered on that record, and its outputs are
`computed()` views over it. Deduplication is therefore structural — two
components on the same key cannot produce two requests.

```typescript
// Component A
const tasks = query(() => ['tasks', scope.value], fetchTasks);

// Component B — same key → same record, same run, no second request
const tasks = query(() => ['tasks', scope.value], fetchTasks);
```

Two consequences worth knowing when observers of one key disagree:

- The **most recently mounted enabled observer** owns the next run, so its
  `fetcher` and `retry` are the ones used. Keep the fetcher for a key
  consistent across call sites.
- `staleTime` is per-observer POLICY — it decides whether *that* observer
  triggers a run — while the record's data is shared truth.

Records are never garbage-collected: the cache is unbounded for the life of the
client. Bound it operationally with `client.clear()` or a fresh client per app
lifetime.

### `query-read-signals` — Read the signals; there are no lifecycle callbacks

`query()` returns `data`, `loading`, `error`, and `status`
(`'idle' | 'loading' | 'success' | 'error'`) as readonly signals, plus
`refetch()` and `dispose()`. There are **no** `onSuccess` / `onError` options —
they were removed. React to results by reading the signals.

```typescript
// ❌ WRONG — these options do not exist
query(() => ['tasks'], fetchTasks, {
  onSuccess: (data) => toast(`${data.length} tasks`),
  onError: (e) => toast(e.message),
});

// ✅ CORRECT — the signals ARE the notification
const tasks = query(() => ['tasks'], fetchTasks);
const summary = computed(() => tasks.error.value
  ? `Failed: ${tasks.error.value.message}`
  : `${tasks.data.value?.length ?? 0} tasks`);
```

Supported options are `staleTime`, `retry`, `enabled`, and `initialData`
(a synchronous seed committed into an untouched record — a seed, not a fetch, so
`status` stays `'idle'`). `refetch()` bypasses freshness but JOINS an in-flight
run rather than starting a second one.

### `query-generation-guard` — Runs are superseded, not raced

Each record carries a generation counter and at most one `AbortController`.
Starting a run aborts the previous controller, increments the generation, and
hands the new controller's `signal` to the fetcher. Every commit point in the
run re-checks its captured generation against the record's, so a superseded run
can never write — even if its fetcher ignored the abort.

Write fetchers that honour the signal, because that is what makes the abort
cheap as well as correct:

```typescript
query(
  () => ['task', id.value],
  (signal) => fetch(`/api/tasks/${id.value}`, { signal }).then(r => r.json()),
);
```

A synchronous throw from the fetcher becomes a normal rejection (the run hops a
microtask first), so it enters the same retry-then-terminal-error path as an
async failure instead of escaping the run.

### `query-enabled-guard` — Conditionally skip fetches

`enabled` is both a guard and a tracked dependency: signals read inside it are
tracked, and flipping it back to `true` revalidates.

```typescript
const tasks = query(
  () => ['tasks', scopeId.value ?? null],
  (signal) => api.getTasks(scopeId.value, { signal }),
  { enabled: () => !!scopeId.value },   // skip while null
);
```

`loading` is `false` while an observer is disabled, so neither a disabled query
nor a key switch can strand it `true`. A record whose only observers are
disabled stays stale until an enabled one arrives.

### `query-invalidate-prefix` — Prefix-based cache invalidation

`invalidate(['tasks'])` matches `['tasks']`, `['tasks', '1']`,
`['tasks', '1', 'x']`. Matching is element-by-element over the validated keys —
not string-prefix matching, and no deserialization step.

```typescript
const client = inject(QueryClient);
await api.updateTask(id, patch);
client.invalidate(['tasks']); // → number of records marked
```

It marks every matching record stale and reruns only those with at least one
enabled observer, using the owning observer's fetcher. Disabled observers
revalidate when they are re-enabled, and a record with no enabled observer stays
stale until one arrives. `client.clear()` is the harder tool: it drops every
record and aborts in-flight runs, and live observers re-resolve fresh records.

### `query-dispose-unregisters` — Disposal removes the observer, not the request

`dispose()` unregisters this observer from its record and stops the registration
effect. Component setup registers it automatically, so unmounting is enough;
standalone callers (tests, scripts) call it explicitly, or use `using`
(`signal-disposer-using`).

The record survives disposal, and so does an in-flight run: a zero-observer run
completes and commits, so the data is already cached when the next observer
arrives. There is no "wrote to a detached signal" hazard to guard against — the
record's signals are owned by the client, not by the component.

### `query-catch-required` — Effects are synchronous; async work needs an owner

`effect()` is synchronous and REJECTS async callbacks — a Promise-returning
effect fails to compile and is diagnosed at runtime as **N310**. A returned
Promise is not a cleanup function.

```typescript
// ❌ WRONG — does not compile; N310 at runtime
effect(async () => { data.value = await api.get(id.value); });

// ✅ CORRECT — give the async work a real owner
const item = resource(() => id.value, (id, signal) => api.get(id, { signal }));

// ✅ If you must kick off a promise from a sync effect, attach .catch()
effect(() => { void audit(id.value).catch(() => {}); });
```

`query()` and `resource()` exist precisely so async state has a home with
cancellation, generations, and error signals instead of a bare promise inside an
effect.

---

## 7. Error Handling & Resilience (MEDIUM)

### `error-setup-boundary` — A contained failure is a DOM fact

If `setup()` or an `onMount()` callback throws, the failure is contained to that
component and sibling components are unaffected. Containment has four observable
parts, in this order:

1. The partial scope is torn down — effects, lifecycle cleanups, and any
   bindings `mountTemplate()` had installed — so no hidden work survives behind
   the fallback.
2. The host is stamped `data-nisli-error="N401"` for a setup failure or
   `"N402"` for an `onMount` failure. This is the DURABLE channel:
   `document.querySelectorAll('[data-nisli-error]')` answers "what failed" long
   after the fact, with no listener installed in advance.
3. A fallback renders — the `onError` template if the component declared one,
   otherwise a plain red `<div>Error in &lt;tag&gt;</div>`. A throwing `onError`
   falls back to the same default.
4. A bubbling, composed `nisli-error` CustomEvent is dispatched last, so a
   single document-level listener sees the settled DOM (stamp plus fallback).
   Its `detail` carries `{ code, tag, phase, message }`.

```typescript
// Per-component fallback (optional)
component<Props>('my-el', (props) => { ... }, {
  onError: (error, host) => html`<div class="text-red-400">Failed: ${error.message}</div>`
});

// App-wide observation — one listener, every contained failure
document.addEventListener('nisli-error', (e) => {
  report((e as CustomEvent).detail);   // { code, tag, phase, message }
});
```

The stamp is removed by a SUCCESSFUL re-setup (including the HMR remount path),
so it always reflects current state rather than history. Bubbling is a DOM-tree
walk, so `display: contents` hosts never affect delivery — but a component
mounted into a DETACHED fragment has no path to the document and its event is
swallowed; the attribute is the record for those.

### `error-effect-survives` — Effect errors don't kill the effect

If an effect throws, the error is logged (`console.error`) and the effect is NOT disposed. A temporary failure — network timeout, missing element — must not permanently kill the effect; it re-runs on the next signal change. The one exception is the loop guard: an effect that re-schedules itself on 100 consecutive runs is diagnosed **N301** and disposed, because that is a freeze rather than a failure.

### `error-handler-wrapped` — @event handlers are try/caught

Handler errors are logged but don't crash the component or prevent other handlers. A broken click handler must not take down the entire UI.

### `error-cleanup-swallowed` — Cleanup errors are always swallowed

Cleanup function errors are caught and ignored. Cleanup failure must not prevent the effect from running again or from being disposed.

### `error-circular-detection` — Circular dependencies fail fast

Both computed (via `computing` flag) and DI (via `instantiating` set) detect circular dependencies and throw immediately — no infinite loops or stack overflows.

### `error-coded-diagnostics` — Failures speak in stable `[nisli N…]` codes

Framework diagnostics go through one leaf that formats every message as
`[nisli N401] …`. The code is the stable identifier — grep for it, assert on it
in a test, and look it up rather than pattern-matching prose. The ranges in use:
`N1xx` template parse/audit, `N2xx` define and prop contracts, `N3xx`
reactivity (`N301` effect loop, `N302` write-in-own-sources, `N303`
flush/tick cap, `N310` async effect), `N4xx` component containment
(`N401` setup, `N402` onMount), `N501` DI freeze, `N6xx` query/async
(`N602` invalid key, `N603` settle cap).

Reporting is behind a dev gate. The probe runs once at module load: it reads
Vite's flags, then `NODE_ENV`, and where neither is present — raw buildless ESM
in a browser — it defaults to LOUD, matching the framework's no-build posture.
A production build is silent. `setDevMode(on)` overrides the probe
(`false` is the explicit opt-out for a buildless production page, `null`
restores the probed default), but note it lives in `diagnostics.ts` and is NOT
re-exported from the `@nisli/core` barrel today: the gate is something to
understand, not something application code wires.

Only the REPORTING is gated. The guarded behaviour never is: a coded error that
is *thrown* (`N107`, `N501`, `N602`) throws in production too, and the effect
loop guard disposes the effect whether or not it can print.

---

## 8. Interop & Migration (MEDIUM)

### `migration-preserve-contract` — Preserve public contracts intentionally

When migrating an existing custom element to `component()`, preserve tag names
and public APIs only when existing callers require them. Document the reason
near the compatibility code.

```typescript
// Compatibility: existing callers still query <my-widget>.
const MyWidget = component('my-widget', (props) => html`...`);
```

### `migration-prefer-services` — Prefer framework communication primitives

For new code, prefer injectable services, signals, and typed `Emitter` classes
over cross-component `querySelector`, monkey-patched public methods, or document
event buses.

```typescript
class AppState {
  readonly selectedId = signal<string | null>(null);
}

const state = inject(AppState);
state.selectedId.value = id;
```

### `migration-auto-resolve` — Props auto-resolve on framework elements

The template engine's `bindAttribute()` checks for `_setProp()` on the element. Framework components get prop routing; vanilla elements get `setAttribute()`. Standard HTML attributes always use `setAttribute()` even on a framework component — `id`, `style`, `slot`, `title`, `role`, `tabindex`, `name`, and any `data-*` / `aria-*` — because routed through `_setProp()` they were silently dead (no component declares them as props). The `class` attribute is handled specially by `bindClassAttribute()` (uses `classList` operations, see `tmpl-class-attribute-safe`).

### `migration-prerender-gate` — Wrap observable work in whenActive()

Speculation-rules prerendering runs a page **fully** in a hidden document:
subresources load, scripts execute, fetches fire. DOM wiring — event listeners,
custom-element upgrades, island mounts — may legitimately run there. Anything
*observable* has to wait for activation.

```typescript
import { whenActive } from '@nisli/ssg/client';

document.querySelectorAll('[data-copy]').forEach(wireCopyButton); // eager: fine
whenActive(() => { analytics.pageview(location.pathname); });      // deferred
```

`whenActive()` defers to the `prerenderingchange` event. Without
`document.prerendering` (every non-Chromium engine), and without a document at
all, it runs the callback immediately. `@nisli/ssg/client` is dependency-free
and side-effect-free, so importing it from a browser bundle pulls in none of
the build-only code behind the package root.

### `migration-ssg-view-transitions` — Cross-document transitions are a build option

A cross-document view transition runs only when **both** the outgoing and the
incoming document carry `@view-transition { navigation: auto }`. A page cannot
opt its own inbound navigations in, so this belongs to the build — the only
layer that sees every page:

```typescript
await buildStaticSite({ outDir: 'dist', router: AppRouter, viewTransitions: true });
```

`true` emits the crossfade opt-in into every page's head; the object form adds
speculation rules through `speculationRules`. Absent or `false` leaves output
byte-identical. Per-page names stay authoring-side CSS, and `match-element` is
same-document only, so cross-document names must be spelled out on both pages.

## 9. Testing (LOW-MEDIUM)

### `test-flush-effects` — Flush effects after signal changes

Effects are scheduled on a microtask. After changing a signal in a test, call
`flush()` to run them synchronously. `flushEffects` is a back-compat alias for
the same function.

```typescript
import { signal, effect, flush } from '@nisli/core';

const count = signal(0);
const results: number[] = [];
effect(() => results.push(count.value));

flush(); // runs the effect
expect(results).toEqual([0]);

count.value = 5;
flush(); // runs the effect again
expect(results).toEqual([0, 5]);
```

### `test-one-flush-drains-the-cascade` — No double-flush idiom

One `flush()` settles the WHOLE synchronous cascade: it loops until the pending
queue is empty, so effects scheduled by effects run in the same call. The old
double-`flushEffects()` idiom is obsolete — if a second flush changes a result,
the work is not synchronous and needs `tick()` or `settle()` instead.

```typescript
// ✅ One flush — A runs, schedules B, B runs
source.value = 2;
flush();
expect(results).toEqual([20]);

// ✅ Microtask-scheduled work (projection sweeps, query initial passes)
await tick();

// ✅ Async data — resolves when every query run and resource load has
//    TERMINATED (commit, terminal error, or abort) and the graph is quiescent
await settle();
expect(el.textContent).toContain('loaded');
```

`flush()` and `tick()` are bounded: a self-perpetuating scheduler is cut off
with diagnostic **N303** rather than hanging, and `settle()` with **N603**. Use
`settle()` instead of polling `waitFor`-style helpers — an abort-ignoring
fetcher cannot wedge it, because a superseded run's registry entry closes at the
abort.

### `test-provide-mock` — Use provide() for test mocks, before the first inject()

`provide()` throws **N501** once the token has been instantiated
(`di-provide-for-overrides`), so a mock must be registered before anything
injects the real service — which in practice means `resetInjector()` first.

```typescript
beforeEach(() => {
  resetInjector();
  provide(ApiService, () => ({
    getTasks: vi.fn().mockResolvedValue([]),
  } as unknown as ApiService));
});

const api = inject(ApiService); // returns mock
```

### `test-reset-injector` — Reset between tests

Call `resetInjector()` in `beforeEach` or `afterEach` to clear the singleton cache. Without this, test order matters and mocks leak between tests.

```typescript
import { resetInjector } from '@nisli/core';

afterEach(() => {
  resetInjector();
});
```

### `test-query-client-isolated` — Isolated QueryClient per test

Records are never garbage-collected, so a shared `QueryClient` leaks cache
across tests. Provide a fresh one — after `resetInjector()`, since `provide()`
throws N501 once the client has been instantiated:

```typescript
beforeEach(() => {
  resetInjector();
  provide(QueryClient, () => new QueryClient());
});
```

`client.clear()` is the alternative when the same client must be reused.

---

## Cross-Module Dependencies

These are the critical dependency chains. A bug in an upstream module propagates to everything downstream.

| Dependent | Depends on | Why |
|---|---|---|
| emitter.ts `on()` | context.ts `hasContext()` | Auto-disposal registration |
| component.ts `connectedCallback` | context.ts `runWithContext()` | Enables inject/effect/on inside setup |
| component.ts `mountTemplate()` | template.ts `TemplateResult.mount()` | Renders the component's DOM |
| template.ts text bindings | signal.ts `effect()` | Reactive DOM updates |
| template.ts `isSignal()` check | signal.ts `SIGNAL_BRAND` | Detects signals in expression slots |
| query.ts observer effect | signal.ts `effect()` | Re-registers on key/enabled changes |
| query.ts record store | injector.ts `inject(QueryClient)` | One keyed cache per app |
| query.ts disposal | context.ts `getCurrentComponent()` | Registers cleanup on disconnect |
| query.ts / resource.ts runs | settle.ts `__enrollPending()` | Makes `await settle()` a real barrier |
| signal.ts, component.ts, injector.ts | diagnostics.ts `diag()` / `formatDiag()` | Stable coded `[nisli N…]` messages |

**Critical path**: signal.ts → context.ts → component.ts → template.ts

---

## Component Template — Complete Example

```typescript
import {
  computed, component, html, inject, resource, when,
} from '@nisli/core';

interface MyComponentProps {
  itemId: string;
  expanded: boolean;
}

const MyComponent = component<MyComponentProps>('my-component', (props) => {
  // ── Inject services (synchronous) ────────────────────────────
  const api = inject(ApiService);
  const nav = inject(NavigationEvents);

  // ── Async state: resource() owns the load ────────────────────
  //    Only the source is tracked; stale loads abort and cannot commit.
  const item = resource(
    () => props.itemId.value || undefined,
    (id, signal) => api.getItem(id, { signal }),
  );

  // ── Derived state ────────────────────────────────────────────
  const title = computed(() => item.data.value?.title ?? 'Loading…');
  const status = computed(() => item.data.value?.status ?? '');
  const isActive = computed(() => item.data.value?.status === 'active');

  // ── Event handlers ───────────────────────────────────────────
  const onSelect = () => nav.emit('select', { id: props.itemId.value });

  // ── Computed view (multi-branch) ─────────────────────────────
  //    Structural reads only: never read a leaf value eagerly here —
  //    pass the signal into the slot (see tmpl-no-eager-value-in-render).
  const content = computed(() => {
    if (item.loading.value) return html`<div class="animate-pulse">Loading…</div>`;
    if (item.error.value) return html`<div class="text-red-400">${item.error}</div>`;
    if (!item.data.value) return html`<div class="text-gray-500">No data</div>`;
    return html`
      <div class="flex items-center gap-2" @click=${onSelect}>
        <span class="font-medium">${title}</span>
        <span class="text-xs" class:text-green-400=${isActive}>${status}</span>
      </div>
    `;
  });

  // ── Template ─────────────────────────────────────────────────
  return html`
    <div class="p-3 rounded border border-white/10"
         class:bg-white/5=${props.expanded}>
      ${content}
      ${when(props.expanded, () => html`
        <div class="mt-2 text-sm text-gray-400">
          Additional details here
        </div>
      `)}
    </div>
  `;
});

export { MyComponent };
```

---

## Shared Reactive Services (Cross-Component Communication)

Instead of `expose()` (rejected — see ADR 0007), use shared injectable services with signal properties for cross-component communication:

```typescript
// Service definition
class AppState {
  readonly selectedTaskId = signal<string | null>(null);
  readonly filter = signal('active');
}

// Producer component
const state = inject(AppState);
state.selectedTaskId.value = taskId;

// Consumer component — reacts automatically
const state = inject(AppState);
effect(() => {
  const id = state.selectedTaskId.value;
  if (id) loadTask(id);
});
```

This replaces cross-component DOM queries and direct method calls with shared
reactive state.

