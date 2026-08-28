# North Star — layout that just works, because it is derived

**Date**: 2026-08-25 · **Status**: north star, pre-ADR · **Owner**: Goga
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) · evidence in
[`PRIOR-ART/`](./PRIOR-ART/) · measured prototype in
[`experiments/c11-appearance`](../../../experiments/c11-appearance/)

## The promise

**The layout just works. No custom pixels, no breakpoints, no CSS mess.**

The author writes what a thing *is* and what it is *for*. The author never
writes:

- a pixel value, a rem, a gap or a padding
- a media query or a breakpoint
- a colour, a shadow or a radius
- a class string
- a decision about what collapses at 320px
- a check that it looks right

And it is correct in every context anyway.

Measured, not aspired: one `MessageRow`, **zero pixel values and zero
breakpoints in its source**, correct in a 1200px page, a 320px sidebar, a 380px
touch phone and a 640px dense list. The engine resolved 36px controls in one
context and 18px in another from a single inherited `--unit`, and degraded in the
exact order declared — timestamp truncated first, Star/Archive to an overflow
menu, Reply never left. **240 of 240 context combinations clean** in real
Chromium across seven independent assertion paths. A guard proves the claim
mechanically: 45 files carry no length, no colour, no media query, no class name
and no size prop.

## The sentence

**React made structure a function of state. This makes appearance a function of
meaning.**

Same shape of move, one layer down — and it is the layer where an AI is blind.

## It is native web, all the way down

Everything the engine derives is expressed in standards the browser already
implements. There is no parallel universe to escape from.

| what the author declares | what it becomes | who executes it |
|---|---|---|
| `data-appearance`, `data-role`, `data-text` | HTML attributes | the parser |
| context axes (`density`, `input`, `theme`) | inherited CSS custom properties | the cascade |
| responsive behaviour | `@container` size and `style()` queries | the browser |
| overlay placement | `anchor()` + `position-try-fallbacks`/`position-try-order` | the browser |
| continuous sizing | `clamp()`, `minmax()`, intrinsic sizing, `text-wrap` | the browser's own solvers |
| components | real custom elements, light DOM | the platform |
| discrete degradation | ~35 lines reading `ResizeObserver`, writing `data-*` | ours, and only this |

Consequences that fall out of being native rather than being claimed:

- **The static tier needs no JavaScript at all.** Density, rhythm, type scale,
  colour, elevation and radius are pure CSS, so they are correct with scripting
  disabled and correct in the SSG's pre-rendered output — the first paint is
  already right, not corrected afterwards.
- **Devtools works.** Inspecting an element shows real cascading CSS with real
  custom properties, not a runtime-generated hash. `explain()` exists to narrate
  the derivation chain, not to compensate for an opaque one.
- **Agents and assistive technology read the same channel.** The declarations are
  `data-*` attributes and ARIA roles — exactly what browser-use's DOM
  serialisation includes and what it excludes `class` in favour of.
- **No virtual DOM, no runtime style injection, no generated class names, no
  shadow-DOM workaround.** `@nisli/core` already ships none of those.

## What this is not

Three misreadings, each describing something smaller and already tried.

**Not "CSS in TypeScript".** CSS is the engine. The resolution table is plain
`.css`. Finding F1, measured: derived values reach through component boundaries
and `display: contents` hosts by inheritance with **no JavaScript
participating**. TypeScript types *intent* — nine unions, about thirty legal
values, one page — not the CSS spec.

**Not a CSS-in-JS successor.** That family exists to make *authoring style
values* safe: scoped, typed, tree-shaken. It gives you a well-typed `padding: 4`.
We delete the `4`. A value never written cannot be mistyped, so the five reasons
CSS-in-JS exists stop applying rather than getting a better answer:

| CSS-in-JS solves | why it stops mattering |
|---|---|
| scoping collisions | components own no style rules; nothing can collide |
| dynamic values | values derive from context by inheritance + container queries |
| property type safety | the vocabulary is typed instead, and it is ~30 values |
| dead style elimination | one authored table, not per-component rules |
| co-location | the *declaration* is on the element; the *resolution* is deliberately not — that is what makes it consistent |

Meta's StyleX states the opposing position explicitly, which is useful: *"All
styles on an element should be caused by class names on that element itself"*,
with inherited properties called *"the only form of style-at-a-distance that
StyleX allows"*. Style-at-a-distance is exactly the mechanism here, chosen on
purpose, because it is what removes the author's decision.

**Not a layout solver in JavaScript.** That idea is dead and the graves are
marked. Grid Style Sheets shipped Cassowary in the browser in 2014 and is an
archived repository whose own issues asking *"is this dead?"* were never
answered. Flutter's architecture document rejects constraint solving by name —
*"O(N²) or worse (for example, fixed-point iteration in some constraint
domain)"* — and documents its one speculative-measurement widget as *"avoid
using it where possible"*. Three tiers, and tier 3 stays ~35 lines or it becomes
GSS:

| tier | who solves it | scope |
|---|---|---|
| static, zero runtime | CSS custom properties + container queries | density, rhythm, type scale, colour, elevation, radius — SSG pre-solvable |
| the browser's own solvers | flex, grid, `clamp()`, `text-wrap`, `field-sizing`, anchor positioning + `position-try` | it is already a solver; stop fighting it |
| measured, small, bounded | ~35 lines | only discrete choices: what collapses, truncates, moves to a menu |

Tier 2 is *under*-used, not over-used: `position-try-fallbacks` +
`position-try-order` shipped in **all three engines** with a richer model than
our `data-collapse` — ordered fallback list, `most-*` objective, stable sort,
last-successful-option memory, separate `position-visibility`.

## Why determinism is the product

Deleting pixel values is the mechanism. The product is what determinism unlocks.
Once appearance is a pure function of declared meaning and measured context, five
capabilities arrive together, and no incumbent can offer one of them:

1. **Checkable** — you can assert over a derived result. You cannot assert over a
   hand-picked number.
2. **Enumerable** — generate every state × every context and check them all.
   Nobody looks at the empty state; a machine looks at all of them.
3. **Explainable** — `explain()` answers *why is this 36px* with a derivation
   chain rather than a guess.
4. **Portable** — one declaration is correct in a 320px sidebar and in a hero.
5. **Pre-solvable** — the static tier resolves at build time, so first paint is
   already correct.

## The ground is unoccupied

Measured from primary sources, 2026-08-25:

- **v0's published repair pipeline is entirely syntactic** — import rewriting,
  icon-name snapping, missing dependencies, JSX/TS repair. Zero geometric,
  contrast or overflow checks. Its stated goal is "a working website instead of
  an error or blank screen".
- **shadcn's agent-facing `get_audit_checklist` returns six items** — five
  compile-time, one "use the Playwright MCP if available".
- **The industry's only working appearance oracle is human**: UI-Bench's 4,000+
  expert pairwise judgements with TrueSkill. The people with maximum incentive to
  automate "is this UI good" built a human oracle instead.

Nobody checks appearance because nobody *can*. A hand-picked number carries no
claim to check against.

## Attention: killed as a metric, kept as a structure

**Aesthetics is not measurable, and this is settled by evidence rather than
taste.** Best published predictors ceiling at adj. R²≈.48 (Reinecke, CHI 2013)
and 49%/32% (Miniukovich, CHI 2015). Reinecke's Webby-winner reference class —
the canonical "these are good" set — spans means of 4.21–6.57 on a 9-point scale
with average SD 1.69 against an overall mean of 4.73. No consistent label exists,
so "train an oracle on good designs" is foreclosed for everyone. Symmetry and
balance were *pruned* from the model by backward elimination.

Two rules must therefore never be built: **Hick's law is invalid and inverted**
(CHI 2020 shows it argues for showing *more* items per page), and **APCA is
licence-blocked** (patent pending, commercial use prohibited without a signed
agreement; 82,583 dl/wk against axe-core's 67.6M).

**But declared attention is exactly decidable.** GNOME's HIG ships a normative,
machine-checkable rule — *"Each view should only ever include a single button
using either the suggested or destructive styles"* — stated over **declared**
style classes. It is unenforceable against `class="bg-blue-600"`, because that
string names a colour, not a role. It is a two-line check the moment
`data-role="primary"` exists. That is the existence proof for the whole
declaration-enabled-check thesis, from a shipping platform, in writing.

So attention is in scope as *structure the author declares and the engine
enforces*, and out of scope as *quality the engine judges*.

## The agentic consequence

The industry is converging on this answer from the protocol side and has left the
runtime half empty.

- **Google's A2UI reached v1.0** with a `basic` catalog of exactly 18
  components, 3–6 props each, `additionalProperties: false`, and **zero styling
  properties** — a grep for `color`/`padding`/`width`/`fontSize`/`style`/
  `className` across its 1,346-line schema returns nothing. v1.0 explicitly
  *removed* theming to "defer visual styling entirely to the target framework's
  native theme".
- So there is agreement on **what an agent may emit**. There is nothing that says
  what it renders *to* — correctly, at every width, in every state, provably.
  That runtime is this bet.
- **MCP Apps' host style contract** (Anthropic + OpenAI, 3.1M dl/wk) is 76 keys
  of colour, type, radius and shadow with **no spacing, gap, density or
  hit-target variable at all**. The `--unit` axis is the missing dimension in
  their spec.
- **browser-use (110k stars) excludes `class` from what the model sees** while
  including `role`, `aria-*` and `data-state`. The declaration channel is already
  the channel agents read.

## The honest counter-arguments

Kept here because a north star that hides its counter-evidence is marketing.

**Models disobey styling constraints that oppose their training defaults.** arXiv
2604.07192 (11 models, 830+ invocations): "use CSS Modules" failed 17/21 (81%),
"no inline style" failed 19/21 (90%), and 36 of 47 total failures were CSS
default-bias. Encoding form was irrelevant (Δ 0.3pp) — you cannot prompt your way
out. The counter is that exclusivity here is a **type and gate constraint, not a
prompt constraint**: an agent writing `class="p-4"` gets a compile error or a
failing gate, not a polite instruction. But the failure relocates rather than
vanishing — it moves to the escape hatch, and it threatens the *velocity* claim
specifically. That is a number to measure, not an argument to win.

**Shopify's Polaris Web Components already ship exclusivity and derivation.**
`<s-button>`, released 2025-10-01: *"the CSS can't be altered or overridden"*,
`variant`/`tone` default to `"auto"` meaning "determined by context", headings
derive prominence from nesting depth, and there is no `size` prop. What it lacks
is any way to author a **new** semantic role, any fit solver, and any checker. So
declarative appearance is table stakes with a shipped precedent, and the
differentiator narrows to exactly three things: **author-defined roles, measured
fit, and verification.**

**Adobe tried derive-from-one-unit and abandoned it.** Spectrum declares
`--spectrum-global-dimension-scale-factor: 1`/`1.25` and then never references
it: zero `calc()`, 136 of 169 values hand-typed, two duplicated tables. That is
our F9 — a resolution table can state an impossible constraint — answered by
giving up on derivation. We answer it with a static consistency check on the table
instead, which is why "the framework checks the table" is half the claim.

**Enforcement leaks about 15%, measured on the enforcers.** Primer ships stylelint
rules forbidding raw values and carries 502 checked-in `stylelint-disable` lines
across 203 CSS modules, with 572 raw px against 3,257 token references. A
zero-escape registry is a marketing number; a *reported* escape is an engineering
one.

## The one-line differentiator against the incumbent

Tailwind v4's `@theme` collects custom properties and hoists every block into a
single `:root, :host` rule, deleting the rest. It therefore owns our *mechanism*
and has architecturally forbidden itself our *scope count*. **Nested context axes
are the difference** — and against 126M downloads/week that sentence has to be
said precisely, or the pitch reads as "Tailwind, later".
