# Capabilities — the named, closed surface of `@nisli/intent`

**Date**: 2026-08-27 · **Status**: design note, pre-ADR · **Owner**: Goga
**Parent**: [north star](../../docs/worklists/nextgen/NORTH-STAR.md) · code in
[`src/`](./src/)

## What this is about

The north star says the author declares *meaning* and the engine derives
*appearance*. That promise only holds if the set of things an author can
declare is **finite, named, and known to every part of the system** — the CSS
that resolves it, the solver that degrades it, the checker that verifies it,
the guard that forbids anything else, and the documentation that teaches it.

Today that set is finite in practice but not by construction. The package pins
its *exports* (`barrel.test.ts` asserts every name on both entry points, in both
directions) and it pins its *values* (`VOCABULARY` and `AXIS_ATTRS` are frozen
tables). What it does not have is the level above both: a single declaration
of **what the package is capable of**, from which the exports, the vocabulary,
the guard and the docs are derived — or at least asserted against.

This note names that level, enumerates it from the code as it stands, records
the two gaps that enumerating it exposed, and sets the rule for how the
surface grows: **one capability at a time, each one named before it is built.**

## The principle

A capability is a thing an author can *do* with the package, stated in the
author's terms. It is not an export and not an attribute — it is the promise
those implement. Three consequences follow from making capabilities the unit:

1. **Closed world, by declaration.** If it is not in the capability list, the
   author cannot do it, the CSS does not resolve it, the checker reports it as
   unknown, and the guard rejects it. There is no unlisted way to affect
   appearance. This is the same exclusivity argument as
   [C11 exclusivity note](../../docs/worklists/nextgen/C11-EXCLUSIVITY-AND-DERIVATION.md)
   — a second styling channel voids derivation, checking, consistency and
   provenance — applied to the package's own growth rather than to `className`.

2. **One source, many consumers.** The barrel test, the vocabulary tables, the
   N610 vocabulary rule, the reachability test, the no-values guard and the
   README table all describe the same surface. Five hand-maintained copies of
   one fact is the shape that has already shipped a vacuous green in this
   repository (two duplicated path lists that agreed with each other while the
   feature was dead — see the module doc in `rules/index.ts`). One
   `CAPABILITIES` table, with each consumer deriving from it or asserting
   equality with it, cannot disagree with itself.

3. **Growth is a decision, not a refactor.** Adding a capability means adding
   one entry and then satisfying every consumer that now fails. Removing one is
   the same in reverse. Neither can happen as a side effect of editing a
   component or a stylesheet.

## The capabilities, enumerated from the code

Read from `contracts.ts`, `index.ts`, `devtools.ts`, `fit/dom.ts` and
`theme/*.css` on 2026-08-27. Tiers are the north star's three: **static** is
pure CSS, **browser** is the platform's own solvers, **measured** is `fit()`.

### Author-facing: what an element can declare

| id | capability | attribute | legal values | tier |
|---|---|---|---|---|
| A1 | compose children | `data-layout` | `row` `stack` `wrap` `grid` | static |
| A2 | align and distribute | `data-align` | `start` `center` `end` `between` | static |
| A3 | be a kind of thing | `data-appearance` | `action` `avatar` `field` `nav-item` `table` `surface` | static |
| A4 | carry emphasis | `data-role` | `primary` `quiet` `danger` `link` | static |
| A5 | be a level of text | `data-text` | `display` `title` `body` `meta` `label` | static |
| A6 | trim its overhang | `data-clip` | `trim` | static |
| A7 | degrade when it will not fit | `data-collapse` **and** `data-priority` | `truncate` `hide` `menu` × `1`–`5` | measured |

A7 is the only capability that needs JavaScript, and it is the only one that
involves two attributes: the strategy says *how* to give way, the priority
says *when*. Neither means anything without the other.

### Context: what changes the answer

| id | capability | attribute | legal values |
|---|---|---|---|
| C1 | density | `data-density` | `comfortable` `compact` `dense` |
| C2 | input mode | `data-input` | `pointer` `touch` |
| C3 | theme | `data-theme` | `light` `dark` |

Context axes are declared anywhere in the tree and inherit. They are the
**only** inputs that change a resolved value; there is deliberately no fourth.

### Engine: what the package does with the declarations

| id | capability | entry | surface |
|---|---|---|---|
| E1 | resolve values from context | `./theme.css` | `tokens.css` `roles.css` `structure.css` `states.css` |
| E2 | measure and degrade | `.` | `fit` `solveAll` `solveFit` `fitContainers` `discoverCandidates` `domMetrics` `domMutator` |
| E3 | expose the vocabulary as data | `.` | `VOCABULARY` `AXIS_ATTRS` `STRATEGIES` |
| E4 | check a rendered tree | `./devtools` | `check` `DEFAULT_RULES` `domInspector` `formatFindings` `summarize` |
| E5 | name every finding | `./devtools` | `CODES` `codeEntry` `DOCS_BASE` — append-only, 16 rules today |
| E6 | author a new check | `./devtools` | `rule` `measuringRule` `observe` `isAdmittedFailure` |
| E7 | explain a derivation | `./devtools` | `explain` |

### Engine-written state: what the author may not write

`data-fit` `data-truncate` `data-hidden` `data-collapsed`
`data-collapsed-count` `data-shown`. The mutator in E2 is the only writer.
These are listed so the closed world is complete, not so an author reaches
for them; `contracts.ts` withholds them from `VOCABULARY` for exactly that
reason, and this note keeps that decision.

## What enumerating exposed

Two gaps, both of the "a word the vocabulary does not contain" class that
`AXIS_ATTRS` exists to prevent — found by writing the table above rather than
by a failing test, which is itself the argument for the table.

**Gap 1 — `data-priority` has no contract.** The solver reads it
(`fit/dom.ts` `readPriority`), the README teaches it, every example uses it,
the `Priority` type exists — and it is in neither `VOCABULARY` nor
`AXIS_ATTRS`. So `data-priority="high"` is invisible to the N610 vocabulary
rule, and no selector on it can be checked for reachability. A7 is half a
capability as far as the checker is concerned.

**Gap 2 — the capability list exists only in prose, and the prose is already
wrong.** Exports are asserted; capabilities are not. Grepping `theme/*.css`
for `data-*` selectors finds **26 attributes**; the tables above (written from
`contracts.ts`) name 16. The ten the stylesheet answers to that no contract
declares:

| attribute | what it appears to do | authorable? |
|---|---|---|
| `data-grow` | lets one child in a row shed inline space (11 rules) | yes |
| `data-overflow`, `data-overflow-menu`, `data-overflow-anchor` | the `menu` strategy's trigger and target | yes |
| `data-flush` | removes a surface's inset | yes |
| `data-table` | table-specific structure | yes |
| `data-scroll-region` | a scroll container | yes |
| `data-component` | component identity hook | yes |
| `data-escaped` | an element that left its fit container | engine |
| `data-nisli-error` | core's error marker | engine |

These are not bugs in the stylesheet; they are capabilities that were never
named. A stray `data-foo` in a component with a matching rule in a stylesheet
is a new, unnamed capability that nothing rejects. The no-values guard forbids
lengths, colours, media queries and class names; it does not forbid a *new
attribute*, because it has no list to check against — and this table is the
proof that the list has already drifted from the prose.

## The proposal

One frozen table in `contracts.ts`, and every existing description of the
surface either derived from it or asserted equal to it:

```ts
export const CAPABILITIES = {
  compose:   { attr: 'data-layout',     values: ['row', 'stack', 'wrap', 'grid'], tier: 'static' },
  align:     { attr: 'data-align',      values: ['start', 'center', 'end', 'between'], tier: 'static' },
  appear:    { attr: 'data-appearance', values: [...], tier: 'static' },
  emphasise: { attr: 'data-role',       values: [...], tier: 'static' },
  text:      { attr: 'data-text',       values: [...], tier: 'static' },
  clip:      { attr: 'data-clip',       values: ['trim'], tier: 'static' },
  degrade:   { attr: 'data-collapse',   values: ['truncate', 'hide', 'menu'], tier: 'measured',
               companion: { attr: 'data-priority', values: ['1', '2', '3', '4', '5'] } },
  density:   { attr: 'data-density',    values: [...], tier: 'context' },
  input:     { attr: 'data-input',      values: [...], tier: 'context' },
  theme:     { attr: 'data-theme',      values: [...], tier: 'context' },
} as const;
```

Consumers, in the order they should be wired:

| consumer | relationship to `CAPABILITIES` |
|---|---|
| `VOCABULARY`, `AXIS_ATTRS` | derived — they become projections, not siblings |
| N610 vocabulary rule | reads the derived tables; gains `data-priority` for free |
| reachability test | asserts every rule selector names a listed attribute and value |
| no-values guard | gains a rule: no `data-*` attribute outside the listed set, engine-written set excepted |
| `theme/*.css` | a test asserts every `[data-…]` selector in the stylesheets is listed, and every listed value has at least one rule |
| README vocabulary table | generated or asserted equal, so it cannot drift |
| `barrel.test.ts` | unchanged — it pins exports, which are E-level, and stays the second lock |

The engine-level capabilities (E1–E7) are already pinned by the barrel test
and the entry-point split; they do not need a second table. What they need is
the same *naming*: this note is where E1–E7 get their names, and an ADR is
where those names become permanent.

## The rule for growth

**One capability at a time.** A capability is proposed by name, with its tier,
its attribute, its legal values, and the finding codes that will police it.
It lands only when every consumer above knows it. Nothing else about the
surface changes in the same landing.

This is deliberately slower than adding an attribute and a stylesheet rule.
The north star's claim is *correct in every context, and a machine can say
so*; every unnamed capability is a place where the machine cannot say so.

## The first iteration

**A7 — degrade.** Chosen because it is the only measured capability, the only
one with an unpinned half (`data-priority`), and the one where "explicitly
limited" carries the most weight: the solver stays a bounded loop over a
declared priority list, and the closed list of what it may write is the line
between tier 3 and a layout engine.

Scope of the iteration, in order:

1. Add `CAPABILITIES` with A7 as the first fully-specified entry; derive
   `VOCABULARY` and `AXIS_ATTRS`; `priority` appears in both.
2. Confirm N610 now rejects an illegal `data-priority`, with a fixture that
   fails before and passes after.
3. Pin the engine-written set as data and have the guard reject any other
   `data-*` write from the mutator.
4. Fill in A1–A6 and C1–C3 as entries — mechanical, since their values
   already exist — and wire the stylesheet and README assertions.

Step 4 is not a second capability; it is moving the existing ones under the
new lock. The next *new* capability is a separate decision, made by name.

## What building an app on it found

`packages/recipes` was built on 2026-08-27 from this document and the README
alone. Its [`GAPS.md`](../recipes/GAPS.md) is the input to the next iteration;
the three that bear on the table above:

- **G1** — the `menu` strategy has no shipped implementation. The solver and
  theme do their halves; the panel that makes a collapsed action reachable is
  ~200 lines every consumer must carry. Either an E8 capability or `menu` is a
  promise the package does not keep.
- **G3** — `link` as an emphasis of `action` is wrong for prose that navigates;
  it crushed six cards before the title was rendered as `data-text` on an
  anchor, which works and is uncontracted.
- **G2, again** — the app's own guard had to hand-list nine themed-but-
  uncontracted attributes to pass. That list is the `CAPABILITIES` table,
  written in the wrong place.

## Open questions

- Should `CAPABILITIES` be on the `.` entry (so a consumer can enumerate
  what the package can do, the way `VOCABULARY` is enumerable today), or
  internal with `VOCABULARY`/`AXIS_ATTRS` as the only public projections?
  Leaning public: it is the self-description an agent wants.
- Does a capability carry its finding codes (`degrade → N621, N6xx…`) so the
  checker's coverage of each capability is itself asserted? Probably yes, and
  probably as a later iteration — it turns "which rules police this" from a
  grep into a fact.
- `devtools.ts` says "fifteen rules" in three places; `rules/index.ts` exports
  sixteen. Small, but it is the exact drift this note is about.
