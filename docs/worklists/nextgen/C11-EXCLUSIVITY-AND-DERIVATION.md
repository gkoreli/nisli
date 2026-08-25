# C11 — Exclusivity and Derivation, in Code

**Date**: 2026-08-25 · **Status**: design sketch for a scratchpad candidate.
**Not a proposal, not an ADR, nothing here is landed.**
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) §4 C10/C11, §5 round 5.

Two claims from the brainstorm needed code before they could be believed:

- **Exclusivity** — the guarantees only exist if the intent layer is the *only*
  channel. A second channel (`className`) voids all of them.
- **Derivation** — existing systems *map* a token to a hand-written class
  string; nothing *resolves* a value from where the element sits.

Everything marked **TODAY** is real, copied from this repository. Everything
marked **SKETCH** is invented for this document — it shows the shape of the
idea, not a committed API. The CSS mechanisms used by the sketch are all
shipping browser features, and container style queries are already adopted in
this repo (`bd90728`).

---

## 1. Where we actually are — TODAY

Real file, real code: `packages/ui/registry/default/ui/button.ts`.

```ts
// TODAY — packages/ui/registry/default/ui/button.ts:22-54 (abridged)
export const buttonVariants = cv(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm …",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border bg-background shadow-xs hover:bg-accent …',
        ghost:   'hover:bg-accent hover:text-accent-foreground …',
        // …6 total
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs:      "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 …",
        sm:      'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg:      'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon:    'size-9',
        // …8 total
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
```

```ts
// TODAY — packages/ui/registry/default/ui/button.ts:74-84
export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  …
  /** Merged last into the inner <button>'s class list via cn(). */
  className?: string;        // ← the second channel
  children?: string | TemplateResult;
};
```

Read those two blocks as an engineer, not as a user. Three facts:

1. **The caller decides the size.** `size="sm"` is a *decision made by whoever
   writes the callsite*, based on looking at a design. That decision requires
   eyes, and it is made ~40 times in a real app.
2. **Every value is hand-written and duplicated.** `h-9`, `h-6`, `h-8`, `h-10`,
   `px-4`, `px-2`, `px-3`, `px-6`, `gap-1`, `gap-1.5`, `gap-2` — 8 sizes × 6
   variants of hand-maintained strings, per component, for 58 components. This
   table *is* the design system, transcribed. It is also exactly what our own
   history records as rank-3 defect class: *"first 13 components were ported
   from model memory… 8 heavily drifted."* There is nothing to derive from, so
   an agent has to remember.
3. **`className` is a hole in the floor.** One prop, and every guarantee below
   becomes unenforceable.

This is a good component library. It is not a framework capability.

---

## 2. Exclusivity — what the second channel actually costs

Take the smallest possible override. It looks harmless:

```ts
// TODAY — legal, common, and it silently voids five properties
Button({ variant: 'outline', size: 'sm', className: 'mt-[7px] px-3.5' })
```

Now walk each guarantee and ask what breaks:

| Guarantee | Why `className` kills it |
|---|---|
| **Derive** | Two writers own `padding-inline`. The engine cannot own rhythm when the caller may overwrite it, and it cannot tell an intentional override from a mistake — so it must assume every value is intentional, which means it can derive nothing. |
| **Check** | "This should be 12px" is unstateable if arbitrary CSS may move it. Every check degrades to "whatever it currently is", which is a snapshot, and snapshots rot (`ROUND2-EVIDENCE-visual-oracle-prior-art.md` §2). |
| **Consistency** | `mt-[7px]` is off-scale by 1px. Nobody notices. It gets copied — that one line becomes the local template. This is the actual mechanism by which design systems decay, and it is a *social* process the framework can only stop by refusing the channel. |
| **Explain** | "Why is this 12px?" is answerable only if every value came from the table. One override and provenance is guesswork. |
| **Global fit** | A solver must know which properties it may change. If arbitrary CSS may set any of them, the solver's decisions can be silently overridden mid-solve, at a different specificity, with no error. |

So `className` is not a convenience with a small cost. It is the difference
between a framework that can promise something and a library that can only
suggest. **The channel must be closed, or there is no bet.**

### 2.1 What closing it looks like

```ts
// SKETCH — the same component, second channel removed
export type ButtonProps = {
  role?: 'action' | 'quiet' | 'danger' | 'link';   // what it IS
  // no size          — derived from context (§3)
  // no variant table — derived from role × surface depth (§3)
  // no className     — deleted
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  children?: string | TemplateResult;
};
```

Nine props become four, and two of the four are behaviour, not appearance.

### 2.2 The escape hatch, designed rather than inherited

Removing the hole without an escape is how purist frameworks die. TypeScript
won because it shipped `any`. So: raw styling stays possible, is *explicit*, and
**forfeits the guarantees for that subtree only**.

```ts
// SKETCH — you can always escape; you cannot escape quietly
html`<div escape="mt-[7px] rotate-3">${chart}</div>`
```

```
[nisli N601] escaped appearance — app-dashboard.ts:41
  <div escape="mt-[7px] rotate-3"> opts this subtree out of the resolver.
  Excluded while escaped: rhythm derivation, fit solving, contrast checks.
  Off-scale value: 7px is not on the 4px scale (nearest: 8px).
  → <div layout="stack" priority="2"> expresses this without escaping
  docs: nisli.dev/e/N601
```

And because the escape is a declared fact, it is *countable*:

```jsonc
// SKETCH — generated manifest entry, i.e. the 0029 §4 manifest gaining one field
{ "tag": "app-dashboard", "escapes": 1, "escapedProps": ["margin-block-start"] }
```

Which buys a metric no framework currently has — **escape ratio** — gateable in
CI exactly like the existing size budget: *the registry ships zero escapes; an
app may set its own ceiling.* Gradual adoption, measurable convergence, no
purity theatre.

### 2.3 Why only this project can close it

Not cleverness — structure:

| Structural fact (real, today) | Why it matters here |
|---|---|
| Copy-in registry, you own the source (ADR 0022) | Removing `className` is a codemod in your tree, not a breaking change to a million node_modules |
| One version per tree, no scoped-registry problem (0030.2 §1) | No third-party component depends on our class channel |
| Light DOM (ADR 0019) | Inherited custom properties reach descendants — including *through* `display: contents` hosts (§3.3) |
| Owns the build (`@nisli/ssg`) | The static tier of resolution can be pre-solved; no runtime cost |
| Fine-grained signals, no VDOM | A measured re-solve touches one subtree, not a render pass |
| 14-statement public API | The whole vocabulary can fit in one page of context |

React structurally cannot: `className` is load-bearing in every third-party
library, it is Tailwind's entire interface, and there is no closed component set
to enforce anything over. This is the honest form of the moat — **not an
algorithm, an ability to say no.**

---

## 3. Derivation — mapping vs resolving, in CSS

### 3.1 What "mapping" is (every existing system)

```ts
size="sm"  →  'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5'
```

A lookup. The input was chosen by a human with eyes; the output is a
hand-written string. Radix Themes' `size="2"`, Material's component tokens,
Chakra's recipes — all the same shape. **The context is never consulted**, which
is why you still hand-place `<Flex gap="2">` around everything.

### 3.2 What "resolving" is

The value is a *function of position in the tree*. Concretely, in CSS that ships
today:

```css
/* SKETCH — theme.css: the ONLY place numbers exist.
   Context sets one unit; every value is a function of it. */
[data-density="comfortable"] { --ui-unit: 4px; --ui-text: 0.875rem; }
[data-density="compact"]     { --ui-unit: 3px; --ui-text: 0.8125rem; }
[data-density="dense"]       { --ui-unit: 2px; --ui-text: 0.75rem; }

/* Roles consume the resolved unit. No component owns a number. */
[data-appearance="action"] {
  block-size:     calc(var(--ui-unit) * 9);
  padding-inline: calc(var(--ui-unit) * 4);
  gap:            calc(var(--ui-unit) * 2);
  font-size:      var(--ui-text);
  border-radius:  var(--ui-radius);
}

/* Rhythm is a function of the container, not of each child. */
[data-layout] { display: flex; gap: calc(var(--ui-unit) * 2); }
[data-layout="stack"] { flex-direction: column; }
```

That is the entire mechanism for the static tier: **inheritance is the
derivation engine, and it is free.** Nesting is the input. No JavaScript, works
in `@nisli/ssg` output, survives with JS disabled.

### 3.3 The detail that makes it fit *this* framework

Custom properties are **inherited properties**. They pass straight through an
element that generates no box.

Our worst-ever defect class (10 tickets, ~30 component surfaces) is upstream
utilities like `-space-x-2` and `*:ring-2` dying at a `display: contents` host,
because box-model utilities need a box to apply to. Inherited values do not.

**The channel this design uses is precisely the channel that our layout-
transparent hosts do not break.** That is not a coincidence to be grateful for;
it is the reason this design is a natural fit here and an awkward retrofit
anywhere else.

### 3.4 Derivation from *depth*, not just from a declared context

```css
/* SKETCH — elevation derived from nesting, so nobody picks a shade */
[data-surface]                { --ui-bg: var(--ui-surface-1); background: var(--ui-bg); }
[data-surface] [data-surface] { --ui-bg: var(--ui-surface-2); }
[data-surface] [data-surface] [data-surface] { --ui-bg: var(--ui-surface-3); }

/* A quiet action inside a raised surface needs no border; on the page it does.
   Container STYLE queries make context legible by name (already adopted: bd90728). */
@container style(--ui-elevated: yes) {
  [data-appearance="action"][data-role="quiet"] { border-color: transparent; }
}
```

A card inside a dialog inside a page is automatically the right shade. Nobody
typed a shade. **No component library can do this** — it requires knowing where
you are, and a library only knows what it shipped.

---

## 4. The same component, in nisli's language

### 4.1 TODAY

```ts
// TODAY — packages/ui/registry/default/ui/button.ts:98-123 (real)
export const Button = component<ButtonProps, typeof buttonAttrs>('ui-button', (props, host) => {
  transparentHost(host);

  const variant = props.variant;
  const size = props.size;
  const className = props.className;
  const disabled = computed<boolean>(() => props.disabled.value);

  const classes = computed(() =>
    cn(buttonVariants({ variant: variant.value, size: size.value }), className.value),
  );

  return html`<button
    data-slot="button"
    data-variant="${computed(() => variant.value ?? 'default')}"
    data-size="${computed(() => size.value ?? 'default')}"
    class="${classes}"
    type="${computed(() => type.value ?? 'button')}"
    disabled="${disabled}"
  >${children()}</button>`;
}, { attrs: buttonAttrs });
```

### 4.2 SKETCH

```ts
// SKETCH — no class strings, no size table, no className, no cn(), no cv()
import { children, component, html, type ComponentAttrs } from '@nisli/core';

export type ButtonProps = {
  role?: 'action' | 'quiet' | 'danger' | 'link';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  children?: string | TemplateResult;
};

const attrs = { role: 'string', type: 'string', disabled: 'boolean' } satisfies ComponentAttrs<ButtonProps>;

export const Button = component<ButtonProps, typeof attrs>('ui-button', (props) => html`
  <button
    appearance="action"
    role=${props.role}
    type=${props.type}
    disabled=${props.disabled}
  >${children()}</button>
`, { attrs });
```

The component declares **what it is**. Size, padding, gap, radius, type scale,
colour, hover, focus ring and disabled treatment are all resolved from
`appearance` × `role` × inherited context. The 54-line variant table is deleted,
not moved — it lives once, in `theme.css`, as a resolution rule instead of 48
transcribed strings.

`transparentHost(host)` also disappears from the component: host transparency
becomes a property of `appearance`, declared once in the theme.

---

## 5. Real-world examples with rationale

### 5.1 The same Save button in four places

```ts
// TODAY — the caller decides size and variant, four times, by looking at a design
Button({ variant: 'default', size: 'sm',      children: 'Save' })   // toolbar
Button({ variant: 'default', size: 'default', children: 'Save' })   // dialog footer
Button({ variant: 'default', size: 'lg',      children: 'Save' })   // mobile sheet
Button({ variant: 'default', size: 'lg', className: 'px-8', children: 'Save' }) // hero
```

```ts
// SKETCH — identical at every callsite; the place decides
Button({ children: 'Save' })
```

**Rationale.** Four eyes-decisions become zero. The mobile sheet is a bigger
target because the sheet declares `density="comfortable"` and touch input, not
because someone remembered `size="lg"`. Change the toolbar's density later and
every control inside it follows — no callsite edits, no grep.

### 5.2 A bespoke component the framework has never seen (the decisive case)

This is user code, not registry code. It is where every component library stops
helping.

```ts
// SKETCH — zero pixel values, zero breakpoints, zero media queries
const MessageRow = component<{ author: string; time: string }>('app-message-row', (props) => html`
  <div layout="row" align="center">
    ${Avatar({ src: props.avatar })}

    <div layout="stack" grow>
      <span text="title">${props.author}</span>
      <span text="meta" priority="3" truncate>${props.time}</span>
    </div>

    <div layout="row" priority="2" collapse="menu">
      ${Button({ role: 'quiet', icon: 'reply' })}
      ${Button({ role: 'quiet', icon: 'star' })}
      ${Button({ role: 'quiet', icon: 'more' })}
    </div>
  </div>
`);
```

What the author declared: structure, alignment, which parts matter least, and
what should happen to them when space runs out. What the author did **not**
declare: any number, and any width at which anything changes.

What the engine then guarantees, at every width rather than at three:

| width / context | result |
|---|---|
| 1200px page | everything visible, comfortable rhythm |
| 640px | timestamp truncates first (`priority="3"`) |
| 380px | action row collapses into an overflow menu (`priority="2"`, `collapse="menu"`) |
| dense list | same markup, tighter rhythm, smaller type, still fits |
| never | overflow — fitting is the engine's job, so the state is unrepresentable |

**Rationale.** This is the whole bet in one fixture, and it is impossible with
Radix Themes, shadcn, Material, or Tailwind today — not because they lack
polish, but because none of them can see the container or reorder your children.
It is possible here only because the framework owns the tree, the render, and
the reactive graph.

### 5.3 Density as one attribute, for a whole table

```ts
// TODAY — the density switch is a class-swap across every cell, header and control
html`<table class="${dense ? 'text-xs [&_td]:py-1' : 'text-sm [&_td]:py-2'}">…`
```

```ts
// SKETCH — one attribute at the root; every descendant re-resolves by inheritance
html`<div data-density=${density}>${Table({ rows })}</div>`
```

**Rationale.** The `[&_td]:py-1` pattern is exactly the "reach through to a
descendant's box" shape that produced our worst defect class. Inherited
resolution does not reach through anything; each element reads its own inherited
unit.

### 5.4 What the agent sees

```
TODAY, for one button:  6 variants × 8 sizes × arbitrary className  → unbounded
SKETCH, for one button: 4 roles (+ inherited context)               → 4
```

**Rationale.** With zero training-data presence, the winning move is to make the
shortest correct program the one the model writes by default. Deleting the
choice beats documenting the choice — and unlike documentation, it cannot drift
from the implementation.

---

## 6. What the framework can then do that no library can

Each of these is unlocked *only* by exclusivity + derivation:

```ts
// SKETCH — 1. provenance, because every value came from the table
explain($0, 'padding-inline');
// { value: '12px', from: 'appearance=action × --ui-unit=3px (density=compact)',
//   rule: 'theme.css:48', context: 'app-toolbar[data-density=compact]' }

// SKETCH — 2. the complete legal vocabulary, enumerable, generated not written
appearanceManifest();
// { layout: ['row','stack','grid','wrap','overlay'],
//   appearance: ['action','surface','field','nav','display'],
//   role: ['action','quiet','danger','link'],
//   text: ['display','title','body','meta','code'],
//   context: ['density','elevated','input'],
//   fit: ['priority','collapse','truncate','grow'] }
// → 12 attributes, one page, the whole styling language
```

```
// SKETCH — 3. checks that need no author, because the engine knows the intent
$ nisli check
app-message-row  fit         settled at 320px: actions→menu, time truncated   ok
app-dashboard    escaped     1 subtree excluded from guarantees (N601)
ui-card          contrast    quiet role on surface-3 resolves to 3.9:1 (<4.5)  fail
```

- **4. Global fit.** Decisions across siblings, which CSS cannot express because
  CSS resolves one element at a time.
- **5. Enforcement.** Off-scale values are a diagnostic rather than a code
  review comment.

Note what happened to the earlier rounds of this brainstorm: the checker is
still there (item 3) — but nobody authors a check, and nobody needs a mandate to
run it, because the intent it verifies was already declared as the only way to
write the UI. That is what "byproduct rather than product" meant.

---

## 7. Feasibility, in three tiers — and the honest costs

| tier | what it decides | cost |
|---|---|---|
| **static** | density, rhythm, type scale, colour, radius, elevation, role treatment | 0 bytes of JS; pure CSS inheritance + container style queries; pre-solved by SSG |
| **intrinsic** | continuous sizing, wrapping, balancing | 0 bytes; the browser's own solvers (flex/grid, `clamp()`, intrinsic sizing, `text-wrap`) |
| **measured** | the finite discrete choices: collapse, truncate, reorder | small: one `ResizeObserver` per fitting container, batched into the existing flush |

```ts
// SKETCH — tier 3 in full. Not a constraint solver: an ordered loop.
function solveFit(container: HTMLElement) {
  const items = candidates(container).sort(byPriorityAscending); // least important first
  let i = 0;
  while (overflows(container) && i < items.length) {
    degrade(items[i++]);          // 'truncate' | 'menu' | 'hide', as declared
  }
  container.dataset.fit = overflows(container) ? 'unsatisfiable' : 'settled';
}
```

`data-fit="unsatisfiable"` is deliberate: it makes an unfittable layout a **DOM
fact**, readable by `nisli check`, Playwright, and any agent — the same pattern
ADR 0030.2 T6 already establishes for contained failures.

**Why this is not Grid Style Sheets (2014, general Cassowary solver, died of
weight).** We do not solve general constraints, and we do not replace browser
layout. Tier 1 is CSS. Tier 2 is the browser. Tier 3 is an ordered list of
declared degradations over a handful of candidates.

**The costs, stated plainly:**

1. Tier 3 is real bytes against a 10KB core ceiling — possibly an opt-in module,
   which weakens the "only channel" argument (scratchpad §7.19).
2. Two-pass measurement can flash; tier 1 must cover the common case so tier 3
   fires rarely.
3. `theme.css` becomes the soul of the product. A resolver delivers consistency;
   **beauty is the authored resolution table**, and that is taste work no engine
   supplies.
4. Art direction must stay expressible — priority as the default, explicit
   context overrides available, without breakpoints returning as the normal path.
5. Migration is a 58-component wave plus a `className` removal codemod. This
   house has done comparable waves (UI-30 was 58 components).

---

## 8. The one-line test

Every future item in this bet is judged by:

> **Does it still work for a component the framework has never seen?**

`role="primary"` on our own button: no — that is a library.
`priority="2" collapse="menu"` on your bespoke row, solved by the engine: yes —
that is a framework.
