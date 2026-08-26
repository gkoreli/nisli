# @nisli/intent

**Appearance derived from declared meaning and context.** A component says what
a thing *is*, how it *composes*, and what matters *least*; the engine derives
every value from one inherited unit plus the context the element sits in, and
then checks the result.

The promise, in the author's terms: **no pixel values, no breakpoints, no class
names — and it is correct in every context anyway.** Not correct because someone
picked good numbers, but correct because a machine measured it and can say so.

> `@nisli/core` stays the minimal reactive runtime with no CSS. This is its
> permanent peer — the framework half. Decision record:
> [ADR 0032](https://github.com/gkoreli/nisli/blob/main/docs/adr/0032-derived-appearance-package.md).

## The smallest honest example

Import the resolution table once, at the entry stylesheet:

```css
@import '@nisli/intent/theme.css';
```

Declare a context anywhere in the tree — the axes nest and inherit like any
other context, so a dense panel inside a comfortable page just works:

```html
<body data-theme="dark" data-density="compact" data-input="touch">
```

Then a component declares only meaning, and registers the measured pass in one
line:

```ts
import { component, html } from '@nisli/core';
import { fit } from '@nisli/intent';

export const MessageRow = component<{ author: string; time: string }>(
  'app-message-row',
  (props, host) => {
    fit(host); // the measured tier, attached in one line

    return html`<div data-fit data-layout="row" data-align="center">
      <span data-text="title" data-collapse="truncate" data-priority="3">
        ${props.author}
      </span>
      <span data-text="meta" data-collapse="hide" data-priority="5">
        ${props.time}
      </span>
      <button data-appearance="action" data-role="primary">Reply</button>
    </div>`;
  },
);
```

That is the whole authoring surface. `data-fit` marks the container the measured
pass owns — it is also a query container, so everything inside resolves against
the space it was actually given rather than against the viewport. There is no
`size` prop and no class-name prop to reach for: the exclusivity is not
tidiness, it is what makes derivation, checking, consistency and provenance
possible at all.

| declaration | meaning |
|---|---|
| `data-appearance` / `data-role` / `data-text` | what this **is** |
| `data-layout` / `data-grow` / `data-align` / `data-clip` | how it **composes** |
| `data-priority` / `data-collapse` | what matters **least**, and what to do when space runs out |

When the row stops fitting, the least important declaration is spent first: the
timestamp hides, the title truncates, secondary actions move to an overflow
menu. Reply is never lost, because nothing ever declared it least.

## Three tiers, and the third one stays small

| tier | who solves it | scope |
|---|---|---|
| **static, zero runtime** | custom properties + container queries | density, rhythm, type scale, colour, elevation, radius |
| **the browser's own solvers** | flex, grid, `clamp()`, `text-wrap`, `field-sizing`, anchor positioning + `position-try` | it is already a solver; stop fighting it |
| **measured, bounded** | about thirty-five lines | discrete choices only: what collapses, truncates, moves to a menu |

**This is not a layout solver in JavaScript, and the graves are marked.** Grid
Style Sheets shipped Cassowary in the browser in 2014 and is an archived
repository whose own issues asking *"is this dead?"* were never answered.
Flutter's architecture document rejects constraint solving by name — *"O(N²) or
worse (for example, fixed-point iteration in some constraint domain)"* — and
documents its one speculative-measurement widget as *"avoid using it where
possible"*. Tier three is a bounded loop over a declared priority list: it spends
degradations in the author's order until the container fits, and stops. If it
ever grows into a constraint system, it has become the thing that already failed.

Everything resolves to native output: `data-*` attributes, custom properties,
`@container`, real custom elements. No virtual DOM, no runtime style injection,
no generated class names. The static tier needs no JavaScript at all, so it is
correct with scripting disabled and correct in pre-rendered output.

## The measured evidence

Every number here comes from the C11 prototype
([`experiments/c11-appearance`](https://github.com/gkoreli/nisli/tree/main/experiments/c11-appearance))
or from the coverage audits behind ADR 0032. Nothing is a projection.

- **240 of 240 context combinations clean** in real Chromium — four pages, three
  densities, two input modes, two themes, five widths — across **ten independent
  assertion paths**, including one that opens every overlay on the page and
  measures inside it. The proof self-tests: each path is shown *capable of
  failing* before the run is trusted.
- **79.1% of 278 audited CSS capabilities** are derived automatically or authored
  once in the table (47.8% derived, 31.3% authored once). The remaining 20.9% is
  named per capability in the audits rather than rounded away.
- **Contrast held above the WCAG floor on 4,913 of 4,913 swept surfaces**,
  minimum 4.585:1, zero below 4.5:1 — matching the closed form at the tie point.
  The defect class is deleted rather than checked.
- **One inherited unit produces every value.** Comfortable, compact and dense
  each derive their own control height, padding and type scale from the same
  component source; a touch context scales the unit and the axes compose. Dense
  plus touch lands on the authored floor rather than below it.
- **The measured tier is genuinely small** — solving plus lifecycle is about
  thirty-five lines, and registering it in a component is one line.
- **141 tests** run behind a type gate with no browser, against fakes that
  throw on anything they cannot model rather than matching nothing.

The honest headline from building it: **eight of the fourteen defects found were
in the oracle, not the page.** An appearance checker is easy to write and hard to
make truthful. One rule shipped dead — its selector spelled a word the vocabulary
does not contain, so it matched nothing, reported a clean page, and every gate
agreed. **Silence read as success.** That is why a rule earns build authority
only by shipping a fixture proving it can fail, why containment claims and
pressability claims are separate types so confusing them is a compile error, and
why every rule has a way to report *undecidable* instead of passing.

The table is checked too. A resolution table can state an impossible constraint —
a grid track derived its minimum from the unit so it shrank with density while
the content floors inside it did not, and dense, the context whose whole job is
fitting more in less, was the only one that overflowed. It can also state a
*silently rejected* one, where the value looks derived, no literal exists to
catch, and the declaration does nothing. So "the framework checks the UI" has a
second half: **the framework checks the table.**

## The `./devtools` split

```ts
import { fit } from '@nisli/intent';            // runtime: contracts + the measured pass
import { check, explain } from '@nisli/intent/devtools'; // diagnostics: dev-only bytes
```

The two entries are separate because the diagnostics are **dev-only weight and
must be droppable in production entirely**. The runtime entry never imports from
`./devtools`, so a production bundle that only calls `fit()` carries no rule
engine, no reporters and no provenance strings. Anything both halves need lives
in the contracts the runtime entry owns.

`explain()` answers *why is this element this size* by naming the declarations
and the context that produced it — which is the debugging story for a system
where no value was typed by a human.

## Limits

A README that hides its counter-evidence is marketing. These are the things this
package does **not** yet prove — and, last, two defects that are already fixed.
They stay in this section rather than in the changelog alone because the evidence
they carry is about how the package was *verified*, not about a version: every
gate was green while both shipped.

- **No SSG pre-solve.** The static tier *should* resolve at build time; it is
  untested. Measured consequence: the flash of unfit is zero composited frames
  when client-rendered, but nine to ten frames — 69 to 87 milliseconds — against
  a 100-millisecond hydration budget.
- **No byte budget.** The measured tier has never been weighed minified and
  gzipped against core's ceiling.
- **Chromium only.** No Firefox or WebKit run exists.
- **Small surface.** Four pages exercised the vocabulary. That is not a product.
- **Nothing about beauty.** Derivation produces *consistency*; beauty is
  authored. The prototype's own first run resolved an avatar to a size both
  perfectly consistent and visually wrong, and a table can be internally
  contradictory while every value in it looks reasonable.
- **One deferred case.** Bare markup inside a flush surface, with no wrapper
  element to promote, is still clipped. Fixing it needs the mutator to insert an
  element. It is no longer *silent* — a rule reports it — which is the actual
  change so far: the loss became loud, and one shape of it became derivable.
- **Enforcement leaks, by measurement.** The escape hatch for raw CSS exists and
  **reports itself** rather than being forbidden, because the industry's
  strictest enforcers carry hundreds of checked-in suppressions. A zero-escape
  claim is a marketing number; a reported escape is an engineering one.
- **Fixed, and it is the strongest argument in this file: the package used to
  write into a consumer's global namespace.** Every custom property it declares
  is now `--intent-` prefixed. Before that, `tokens.css` declared bare
  `--radius` on the universal selector, so wiring `theme.css` into a real
  Tailwind + shadcn application shadowed the site's own `--radius: 0.625rem` on
  **every element** and collapsed its entire derived ramp — `--radius-sm` 6→4,
  `md` 8→6, `lg` 10→8, `xl` 14→12. Measured: **5,762 changed computed
  properties across 9 pages and 3,584 elements, with zero bounding-box
  changes** — which is why nothing screenshot-shaped would have caught it. Six
  properties were on `*` (`--unit`, `--text`, `--text-meta`, `--text-title`,
  `--text-display`, `--radius`) and twenty-five more on `:root` and the context
  scopes, where a consumer declaring `--accent` wins or loses on document
  order. `--radius` was simply the name this site happened to own; the defect
  was the missing namespace, not the collision. **It was found only by putting
  the package in a real application** — 240 of 240 context combinations were
  clean at the same time, because every one of them measured the package alone.
  A library cannot see its consumers, so anything it declares into a shared
  namespace is a collision it has merely not met yet.
- **Fixed, and it is the same defect in the other shared namespace: the package
  used to match a bare `[data-align]` attribute.** A theme writes into two
  namespaces its consumer also owns, and a prefix closes only one of them. An
  attribute selector is a claim about somebody else's *markup* rather than about
  a name this package owns, so no prefix could have reached this one.
  `structure.css` painted `[data-align='start'|'center'|'end'|'between']` in the
  `structure` layer; `@nisli/ui` writes those same values as a pure animation
  and variant hook at twenty-two call sites, across its bubble, message,
  input-group and floating-layer parts, and never writes `data-layout`. Intent's
  rule reached those elements and **won** — cascade layers beat specificity and
  layer order is fixed by first declaration, so with the application's layers
  declared first and intent's after them the rule outranked the utility that
  would otherwise have decided the property, with no specificity warning
  anywhere. Swept over ninety-two built pages with scripting disabled: **eleven
  changed properties across eight elements on three pages, and zero changed
  bounding boxes** — every one of them `align-items` moving from `normal` to
  `flex-start` or `flex-end`. Zero boxes is the same signature the property
  collision above had, and it carries the same warning: nothing
  screenshot-shaped would ever have found this. Attributed by removal rather
  than by elimination — stripping only these four declarations from the merged
  bundle and re-measuring gives zero and zero, so they are the sole and complete
  cause. The strip has to name them exactly, because the bundle carries six
  `[data-align]` rules and two are the *consumer's* own: the attribute is
  contested by two libraries painting different properties off the same word,
  which is the strongest form of the argument for compounding.
- **The fix for it is a correction rather than a guard, and that distinction is
  the finding.** `data-align` says how a container lines its children up. It
  resolves only into `align-items` and `justify-content`, and both are inert
  outside a flex or grid box — so an alignment declared with no layout container
  beside it has never done anything in any document, and requiring the
  container, `[data-layout][data-align='…']`, removes no capability that ever
  existed. The bad state stops being expressible instead of being watched for,
  which is the same trade this project made when it deleted the batching API and
  made move-disconnect impossible. Measured in both directions on a live
  document, because a rule that silently stops applying is this package's
  most-recorded defect class: all four collisions gone, all five of intent's own
  alignment combinations unmoved, and the only rule still reaching a consumer's
  element is the one that declares custom properties — every one of them
  prefixed. **The reusable rule: a library shipping global CSS that matches a
  bare `[data-*]` attribute will collide with a consumer eventually and cannot
  see the consumer it will collide with; the defence is a selector that
  expresses the declaration's actual scope.** The table had already set that
  precedent without noticing — `data-role` is the only other attribute name a
  consumer was measured to share, every rule keyed on it is compound with
  `[data-appearance='action']`, and it collided with nothing.
- **Still open, and it is a type rather than a selector.** The component
  vocabulary accepts `layout` and `align` as independently optional props, so
  the *type* admits a combination the table gives no meaning to. Nothing
  exercises it — every call site in the prototype declares a container beside
  its alignment — but an `align` that only type-checks on a container would make
  the compound selector's premise checkable at the authoring seam instead of
  resting on the table alone.

## The resolution table

`./theme.css` is the table, and it is about forty percent of the whole idea. It
ships as four files with a load-bearing cascade order:

| file | layer | what it does |
|---|---|---|
| `tokens.css` | `tokens` | the context axes — density, input, theme. Declares values, paints nothing. |
| `structure.css` | `structure` | declared composition becomes geometry. Knows nothing about colour or role. |
| `roles.css` | `roles` | declared meaning becomes appearance. The only layer that paints a component. |
| `states.css` | **unlayered** | what the engine writes, never an author. |

`states.css` is deliberately **outside** every layer. The earlier design relied
on source order, and that was false in the silent direction: source order decides
only *ties*, so it protected engine decisions from role rules of equal
specificity and from nothing else — which is approximately never the interesting
case, since a role rule is normally the more specific one. Measured consequence:
one role-layer typography rule silently cancelled the engine's truncation
decision from three files later in the source order, and three independent
mechanisms all reported success. Unlayered styles beat every layered style
regardless of specificity, so an engine decision now outranks any role rule that
will ever be written — including ones that do not exist yet.

**This directory is the only place in the package where a number, a colour or a
radius may appear.** Every comment in it is a recorded measurement; read them
before changing a value.

**Every custom property the table declares is `--intent-` prefixed**, all
thirty-one of them, and a test fails the build if a new one is not. Nothing
here is a consumer integration point, so the namespace is total rather than
partial: an author never writes these names, they declare meaning
(`data-appearance`, `data-role`, `data-density`) and the table resolves it. The
verbosity is free for exactly that reason — see *Limits* for what it cost when
the prefix was missing.

## Requirements

- `@nisli/core` >= 0.55 as a peer. **Zero runtime dependencies** otherwise.
- A browser with container queries, container *style* queries and `@layer`. The
  table uses them structurally, not progressively — there is no media-query
  fallback, because a viewport width is not a design intent and a breakpoint is
  a guess about one.

## Publishing

**This package is `private: true` today, on purpose.** The name is free to change
until first publish and impossible after, since npm cannot rename, so the flag is
what keeps the API settling reversible. Removing it is the irreversible step —
not creating the directory.

Four things must happen, in this order, before it publishes:

1. **Resolve the diagnostic-code range debt** recorded in
   [ADR 0032 §7](https://github.com/gkoreli/nisli/blob/main/docs/adr/0032-derived-appearance-package.md).
   The prototype's codes sit inside a range core reserved for another owner, one
   of them is a number core explicitly retired with *"the number is not
   reused"*, and another range is claimed with no entry in core's table. The peer
   range must be allocated in core's registry and the codes renumbered. Codes are
   append-only; squatting one is held to the same standard as recycling one.
2. **Remove `private` from `package.json`.**
3. **Add the matrix entry to `.github/workflows/auto-tag.yml`** — name
   `@nisli/intent`, dir `packages/intent`, tag prefix `intent` (so releases tag
   as `intent-vX.Y.Z`), and `trusted-publisher` set true. Deliberately *not*
   added yet: while the package is private, a matrix entry would create a publish
   job for something that cannot publish.
4. **Configure the npm Trusted Publisher** for `@nisli/intent` to name the
   `auto-tag.yml` workflow, so the release publishes with provenance over OIDC
   rather than a token.

Note the coupling this buys, recorded rather than discovered later: each matrix
job runs a repository-wide build and test before publishing, so a slow suite here
delays core's, router's, ssg's and ui's releases too.

## Design

- [ADR 0032](https://github.com/gkoreli/nisli/blob/main/docs/adr/0032-derived-appearance-package.md)
  — the decision, the invariants, the counter-evidence and the open questions.
- [`experiments/c11-appearance`](https://github.com/gkoreli/nisli/tree/main/experiments/c11-appearance)
  — the prototype this package is ported from, kept as the committed evidence:
  the proof scripts, the findings by number, and the visual record.
