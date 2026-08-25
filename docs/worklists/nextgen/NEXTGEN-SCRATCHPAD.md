# Next-Generation Capability — Brainstorm Scratchpad

**Status**: open scratchpad, iterating · **Started**: 2026-08-25
**Owner**: Goga + fleet · **Not an ADR.** Nothing here is decided. When a
candidate survives, it graduates to an ADR (or amends 0029/0030.x) and this
file keeps the losing branches and the reasoning that killed them.

---

## 0. The initiating prompt (verbatim, 2026-08-25)

> i am actively thinking about the next generation of UI frameworks... nisli is
> the next generation UI framework, this is it, in the future it will have
> millions of downloads per day, and will become a defacto default when building
> UI, this is not the case as of now, but we will get there. However, for now I
> need to figure out what is just one mere thing, that will lead us to that
> future. I am thinking some kinda high level building blocks so that AI can
> reason and build pixel perfect UI much better than any of the existing
> frameworks, like higher level engineering language/framework, so that AI agents
> can iterate and build much faster and better UI, like pretty much what React
> and Typescript did to JQuery, HTML and Javascript back in the day. There is a
> need for a next generation 0 dependency UI framework like nisli, however i need
> 1 mere, really high significance capability, to take over and make all the
> existing UI frameworks redundant. What is that one capability, i am still
> unsure. I need help to brainstorm, lets start a scratchpad, capture this
> initial prompt and lets iterate and brainstorm.

---

## 0.1 The idea in plain language (read this first)

**What jQuery→React actually was.** Before React, you wrote the *changes*:
find this node, change that text, toggle this class, and remember to undo it
later. React let you write the *destination* instead — "for this state, the UI
is this" — and the framework worked out every change. You gave up control over
*how* the DOM got updated and you got predictability in return.

**The part React never fixed.** It made *structure* declarative and left
*appearance* imperative. This is what UI code still looks like everywhere:

```
class="inline-flex items-center gap-2 rounded-md border px-4 py-2
       text-sm font-medium bg-primary hover:bg-primary/90 md:px-6"
```

That is a pile of low-level instructions, order-dependent, aimed at DOM shape,
with every number chosen by hand. You cannot read it and know what it looks
like. You cannot ask why it is 14px. You have to run it and look. **That is the
jQuery shape, one level down** — and every framework on the market still has it.

**The move.** Stop describing pixels. Describe *purpose*, and let the framework
derive the pixels:

```html
<ui-toolbar density="compact">
  <ui-button role="primary">Save</ui-button>
  <ui-button role="quiet">Cancel</ui-button>
</ui-toolbar>
```

No sizes, no padding, no gaps, no colours anywhere. The toolbar says what kind
of place it is; the buttons say what kind of thing they are; the framework
resolves the rest. Put the same unchanged button in a hero and it renders large,
because the surrounding context is different. One sentence: **React made
structure a function of state; nisli makes style a function of meaning.**

**Why this is the one thing, in five consequences:**

1. **An AI has far fewer ways to be wrong.** It chooses from about ten roles
   instead of tens of thousands of utility combinations, and the shortest
   correct answer is the one it writes naturally.
2. **The computer can finally tell you it looks wrong.** The framework knows the
   rule that produced every value, so it can also check the result — text
   clipped, box off-screen, spacing off-scale, contrast too low. Today no
   framework can check any of that. This falls out for free instead of being a
   separate tool nobody remembers to run.
3. **It is consistent by construction** — the same intent always resolves to the
   same pixels. That is what "pixel perfect" means in practice.
4. **Restyling becomes a rule change, not a rewrite.** Same payoff TypeScript
   gave for refactoring, applied to design.
5. **It is small in context.** Three words per element instead of forty tokens
   of classes, and the entire legal vocabulary fits on one page — so an agent
   can hold all of it, and generated UI can be validated against a menu.

**It also deletes our own worst bug.** Our most expensive defect class ever
(10 tickets, ~30 components) was upstream styling like "pull my children 8px
closer" silently doing nothing, because our component wrapper takes up no space.
That bug exists *only* because styling reaches through DOM structure. Declared
intent never names structure, so the bug cannot happen — the same way React's
model made "forgot to update the other place" impossible.

**What we are deliberately not doing, each because someone already tried:**

- *Give the AI a text dump of the page so it can measure instead of squinting at
  a screenshot.* Playwright shipped that in May 2026. Not ours to own.
- *Invent an elegant language for hand-writing layout rules.* Built in 2014
  (Galen), rebuilt properly in 2026, zero users. People will not hand-write
  layout rules — so whatever we ship must require writing nothing.
- *Record exact pixel numbers and compare them later.* Browser vendors did that
  for twenty years and document it as a mistake: numbers differ per machine, the
  files need endless updating, and people end up rubber-stamping whatever the
  machine prints.

**The honest risks.** (1) The vocabulary is the whole product: if it needs
hundreds of entries, or cannot express a real data table, the idea is weaker
than it sounds. (2) The defaults must be genuinely beautiful — this is taste
work, not just engineering. (3) There must be an escape hatch for raw styling,
and the escaped subtree loses the guarantees; that gradualness is exactly what
made TypeScript adoptable, and it has to be designed, not bolted on.

### "Isn't that just a component library?"

Fair, and the vocabulary alone *is*. Radix Themes ships `size` and `variant`
props today. The difference is what happens to the component **you** write
tomorrow, which is 80% of any real app. A library styles the components it
shipped; the moment you write your own message row, pricing table or dashboard
panel, every existing system drops you back to hand-picking pixels.

So the framework-level version of the idea is bigger than a vocabulary:

**An AI cannot see. So list every decision that requires eyes — does this fit,
does it overflow, are these aligned, which breakpoint, what collapses first,
what truncates, is the spacing even — and take all of them away from the author.
The engine makes them.** Someone who never makes an eyes-decision cannot make an
eyes-mistake. Neither can an agent.

That needs the framework, not a library: it needs to see the whole tree, own the
render, and re-decide when things change. A library can't do any of that.

There is precedent for the shape, just not on the web. TeX: you declare a
paragraph, and the engine solves the line breaks better than a human placing
them by hand — nobody calls TeX a document library. Native toolkits do the same
for UI: Mac toolbars collapse into an overflow menu by declared priority, iOS
solves layout from constraint priorities, Figma's auto-layout hugs and fills.
**The web is the only major UI platform where a human still hand-places all of
this**, and plain CSS can't fix it, because CSS decides one element at a time and
never knows what its siblings need.

What it looks like: you write a component with no pixel values and no
breakpoints, declaring only what things are and which ones matter most. It is
then correct in a narrow sidebar, on a phone, in a dense list and in a hero —
with the least important action collapsing into a menu and the least important
text truncating first, because you said which was least important, not because
you guessed a width.

Two of the three risks are unchanged (the vocabulary must stay small; the
defaults must be beautiful). The new one is engineering: the fitting decisions
need measurement, which costs runtime bytes against a 10KB budget. That is
§7.18–7.19, and the answer is that most of it resolves statically or by the
browser's own layout, leaving only a handful of genuinely measured choices.

---

## 1. Ground rules inherited from the record (do not relitigate here)

These are already decided and constrain every candidate below:

- **ADR 0029** — ecosystem half: neutral transcript core, MCP Apps single-file
  emit, machine-legible registry manifest, WebMCP on the experiment track.
- **ADR 0030** — framework half: agent-native authoring; author / verify /
  debug loops as the standing review lens; no LLM in the runtime; no
  agent-flavored API sprawl.
- **ADR 0030.1** — the audit: nisli already *is* the substrate the generation
  platforms enforce by prompt (7 of 10 convergent constraints by construction).
  The gap is instrumentation and packaging, not architecture. And the hard
  calibration: **corpus mass, not design, decides today's leaderboard**
  (Web-Bench: React 65% vs Svelte 25%, same model). "Written by agents" is
  earned at inference time; "verified and debugged by agents" is claimable by
  design.
- **ADR 0030.2** — the primitive audit: schema-as-single-truth (T3), parse-once
  + first-parse audit (T4), deterministic scheduler (T5), failure-is-a-DOM-fact
  (T6), `settle()` (T2). Wave 1+2 prototyped, at design gate.

Two invariants that any candidate must respect: **zero runtime dependencies**
and **≤10 KB min+gzip core**. Tooling may be heavy; the runtime may not.

---

## 2. Sharpening the question

The prompt contains two different asks. Separating them is most of the work.

**Ask A — the representation shift.** "What React did to jQuery" was not a
feature; it was *deleting a degree of freedom*: give up arbitrary DOM mutation,
gain a declarative tree you can reason about. "What TypeScript did to JS" was
also not a feature: give up unchecked dynamism (gradually), gain a
machine-checkable contract. Both trades are **expressiveness surrendered for
decidability**. So the honest form of Ask A is:

> Which degree of freedom do we take away, and what becomes decidable?

**Ask B — pixel-perfect.** Note that "pixel perfect" is *undefined without a
referent*. Perfect relative to what? A Figma frame? A sibling component? A
spacing scale? Today the referent lives only in a human's eye, which is exactly
why agents cannot converge on it. Any candidate that claims pixel-perfection
must first name the referent in machine-readable form.

**The premise to push back on.** One capability cannot make incumbents
redundant — distribution and corpus decide adoption, per our own 0030.1
evidence. But one capability *can* make our corpus disadvantage irrelevant:
**corpus supplies priors; a loop supplies convergence.** An agent with a
precise, cheap, mechanical oracle converges in an unfamiliar dialect; an agent
with strong priors and no oracle plateaus at "looks plausible, ships broken."
We cannot buy priors. We can build a loop. So the highest-value single
capability is the **strongest oracle for the thing no framework can currently
check** — and the only wholly unbuilt oracle in the entire UI industry is the
**visual** one.

---

## 3. What agents actually get wrong (the bug classes the oracle must catch)

Evidence-shaped list; needs a real fleet-corpus pass to rank (see §7 open Q4).
Logic bugs are largely closed already by 0030.2's certified list. What remains
is *appearance*, and it is uncovered by every framework, linter, and test
runner in existence:

1. Overflow / clipping — text truncated, box escaping its container.
2. Misalignment — optical and geometric; sibling boxes off by a few px.
3. Off-scale spacing — raw `13px`, `gap-[7px]`, one-off values beside a token
   scale that exists.
4. Contrast and state-color failures — hover/focus/disabled combinations never
   rendered by the author.
5. Responsive breakage — correct at one width, broken at the other three.
6. Stacking/overlay defects — z-index, portal, scroll-container interactions.
7. Invisible focus — the a11y class agents cannot see and reviewers miss.
8. Unrendered states — empty, loading, error, long-content, RTL: the states
   nobody wrote a story for.
9. The Potemkin interface — a misspelled tag or attribute renders as inert
   nothing (0030.1 A4; partially closed by T4's first-parse audit).

Note the shape: **every one of these is a relation between rendered boxes,
tokens, and states — not an absolute pixel value.** That is the tractability
insight in §5.

---

## 4. Candidate capabilities

Each: mechanism → why it could be *the* one → why it might not be → whether an
incumbent can copy it cheaply.

### C1. A visual type system (declared appearance contract + static checker)

**Mechanism.** Appearance intent becomes a declaration on the component, in the
same schema T3 already introduces for props: layout role, containment
guarantees, token-only surfaces, state matrix. A checker resolves the rendered
box tree headlessly and reports violations as coded diagnostics with fixes —
the N-code taxonomy of 0030.2 extended to N6xx *visual*.

**Why it could be the one.** It is the literal TypeScript analogy: the UI bug
class nothing checks becomes compile-time. Gradual by design (unannotated =
unchecked, the `any` of appearance), which is *why* TS won and Flow/Dart
didn't.

**Why it might not be.** A "type system" needs a sound resolver; CSS resolution
is a browser engine. Either we (a) use a real engine as the oracle (heavy
tooling, but tooling is allowed) or (b) close the styling vocabulary to a
computable subset — which is the real expressiveness trade of Ask A and a much
bigger bet.

**Copyable?** The checker, yes-ish. The *closed vocabulary + build-time render
+ schema-declared props + light DOM* substrate that makes it decidable — no.
React's appearance is arbitrary CSS resolved at runtime in a browser; ours can
be resolved at build time from a closed token layer.

### C2. Relational layout assertions (the tractable core of C1)

**Mechanism.** Drop absolute pixels. Assert *relations*: `contains`,
`aligned`, `same-size`, `gap ∈ scale`, `no-overlap`, `visible-focus-ring`,
`contrast ≥ 4.5`, `stable-across-widths`. Robust to font metrics, browser
version, and platform — the three things that make screenshot diffing rot.

**Why it could be the one.** It is what humans *mean* by pixel-perfect, and it
is checkable today with an engine we already drive in CI (Playwright, www
guard). Highest value per unit of work in the whole list.

**Why it might not be.** It is a *checker*, not a language — an increment on
0030.1 B4 rather than the generational shift the prompt is reaching for. Might
be the wedge rather than the identity.

### C3. Layout snapshots — `ariaSnapshot` for appearance

**Mechanism.** A deterministic, diffable, token-efficient **text** rendering of
the resolved visual tree: box tree with token-normalized geometry, spacing
expressed in scale steps, colors as token names, states enumerated. Commits to
git. Reviews in PRs. Fits in a context window.

**Why it could be the one.** It gives agents *eyes that read*. Vision models
cannot measure 2 px; they can read `gap: 3 (12px) ≠ 4 (16px)` perfectly. And
it makes visual regression a **text diff**, which is the single most
agent-legible artifact format that exists. Playwright's ariaSnapshot is already
the format agents consume for semantics (0030.1 B4) — this is the missing
sibling plane.

**Why it might not be.** Format design is the whole risk: too coarse and it
misses bugs, too fine and every innocuous change churns the snapshot. Needs a
normalization discipline as good as the aria tree's.

**Copyable?** Format could be. But normalized-to-tokens output presumes a
closed token layer and a build-time renderer.

### C4. Auto-enumerated state space (Storybook with no stories)

**Mechanism.** T3's value-level schema already declares every prop, kind, and
variant. So the framework can *enumerate its own state space* — the cartesian
product of variants × interaction states × content extremes (empty, overflow,
RTL) — render all of it headlessly, and hand C2/C3 the fixtures. Zero authoring.

**Why it could be the one.** It closes bug class #8, the most common agent
failure ("built the happy path"), for free, and it turns the oracle from
opt-in-per-assertion into exhaustive-by-default. Nobody has this because nobody
else has a value-level prop schema *plus* a browserless renderer.

**Why it might not be.** Combinatorics; needs sampling policy. Pairwise +
declared-interesting-combinations is the standard answer.

### C5. The design contract (naming the referent)

**Mechanism.** Pixel-perfection needs a target. Make the target a first-class,
machine-readable artifact: a design contract (tokens + component spec +
per-state geometry relations), authored by a human/designer or extracted from
Figma, that the checker verifies the implementation against. "Pixel perfect"
becomes `nisli verify --against design.json`.

**Why it could be the one.** It is the only candidate that makes the phrase in
the prompt *literally decidable*, and it addresses the real market pain
(design→code fidelity, a multi-billion-dollar manual QA loop).

**Why it might not be.** Requires a design-side artifact most teams don't have;
Figma integration is an ecosystem project, not a framework capability; risks
making nisli a design-ops product.

### C6. UI-as-data, rendered from a trusted catalog

**Mechanism.** The agent never writes styling code. It emits data (markup or
JSON) against the 0029 §4 manifest; the framework renders it from pre-verified
components. Appearance correctness is a property of the catalog, not of the
generated artifact. (0029 §6 A2UI, 0030 §4 UI-as-data, Thesys's argument.)

**Why it could be the one.** Strictly the largest degree-of-freedom deletion
available: you cannot write a visual bug you cannot express. Streamable,
patchable, runtime-safe, sandboxable.

**Why it might not be.** Caps the ceiling at whatever the catalog can express —
and "make all existing frameworks redundant" requires a ceiling *above* them,
not below. Generative-UI-only is a niche, not a default.

### C7. Intent-level building blocks (`Page`, `Section`, `Field`, `Stack`)

**Mechanism.** Raise the primitive level so there are fewer decisions per unit
of UI. Degrees-of-freedom reduction is the mechanism behind shadcn's agent
success.

**Why it might not be the one.** It is a component library, not a capability;
Chakra/Tamagui/Panda/Radix Themes all occupy it; and it loses to corpus.
**Keep as a consequence of C1/C2, not as the bet.**

### C8. The self-explaining runtime (`explain()`, provenance)

Already in the record (0030 §3) and already demoted by evidence (0030.1 B6:
React/Vue devtools protocols saw ~zero agent uptake). Not the one. Listed so it
stays killed.

### C9. Sidestep instead of check (the house lineage's own answer)

**Mechanism.** Don't build an oracle for a defect class — delete the class.
ADR 0015 deleted `batch()`; 0023 made move-disconnect bugs unrepresentable;
`resource()` made stale-async overwrites impossible. The appearance analogue,
already landed in this repo (`bd90728`, BET08): **container style queries** cross
a `display: contents` host by name, so the #1 recorded defect class (dead
direct-child selectors through a boxless host) stops existing rather than
becoming detectable.

**Why it could be the one.** It is the only candidate with a proven in-house
track record, and it produces zero ongoing oracle-maintenance cost. If the
closed-vocabulary form of C1 is adopted, most of §3 becomes unrepresentable and
the checker shrinks to a small residue.

**Why it might not be.** Sidesteps are per-class artisanal work; they do not
compose into a *capability* you can name on a README, and they cannot cover
defects whose cause is external (content extremes, host theming, viewport).

**Standing tension to resolve (§7.7):** check vs sidestep is the real strategic
fork, and this house has always chosen sidestep.

### C10. Declarative appearance — style as a function of meaning

**The observation that produces it.** React declarativised *structure* and left
*appearance* imperative. `class="inline-flex items-center gap-2 rounded-md
border px-4 py-2 text-sm md:px-6"` is a pile of low-level, order-dependent,
context-blind instructions aimed at DOM shape — which is **exactly the jQuery
shape, one level down**. You cannot read it and know what it looks like; you
cannot ask why it is 14px; you have to run it and look. Every framework on the
market shares this hole.

**Mechanism.** Appearance is declared as *what a thing is*, and the values are
**derived**:

1. **A closed vocabulary of intents**, declared in the same schema that already
   declares props (0030.2 T3): roles (`action`, `action.quiet`, `surface`,
   `field`, `nav.item`), relationships (`stack`, `row`, `grid`, `overlay`),
   and state modifiers the component already knows (`disabled`, `invalid`,
   `selected`, `busy`). No sizes, no spacing, no colours at the callsite.
2. **Context propagation — the mechanic the prior art lacks.** A container
   declares density/scale/emphasis once; descendants derive padding, gap, type
   size, hit target, radius from it. The *same* button is compact in a toolbar
   and large in a hero with no per-callsite change. Implementation is native
   and cheap: intent → attributes, context → cascading custom properties,
   resolution → theme CSS, with container **style** queries (already adopted at
   `bd90728`) for by-name context. Zero runtime JS, works under SSG, stays
   zero-dependency.
3. **Raw values only through a marked escape.** `style`/arbitrary utilities
   still work, but the subtree is flagged unverified — the `any` of appearance.
   Gradual, exactly the property that made TypeScript adoptable.

**Why it could be the one — five consequences, not one.**

- **Fewer ways to be wrong.** The agent picks from ~10 roles instead of 10⁴
  utility combinations, and the shortest correct program becomes the one it
  naturally writes.
- **Checking becomes almost free.** The framework knows the rule that produced
  every value, so "what should this look like" is derivable — C1–C4 stop being
  a separate product and become a *byproduct*. This answers round 3's fatal
  objection to the checker (nobody authors checks; nobody is compelled to run
  one): the declaration is mandatory because it is the only channel, so the
  check needs no author and no regime.
- **Consistency by construction** — the same intent always resolves to the same
  pixels. That is what "pixel perfect" actually means in practice.
- **Restyling is a rule change, not a rewrite** — the TypeScript
  "refactor blind" payoff, for design. The human-side value that keeps the bet
  honest if the author mix shifts slower than expected.
- **Context economics.** Three words per component instead of forty tokens of
  classes, and the complete legal vocabulary is enumerable — so generated UI
  can be closed-vocabulary and validated against a menu.

**It also dissolves our own #1 defect class.** The transparent-host disaster
(10 tickets, ~30 surfaces) exists *because* styling is coupled to DOM shape:
`-space-x-2` means "reach through to my direct child's box". Intent-declared
appearance never names structure, so the class cannot occur — the same way
React's model made "forgot to update the other place" impossible. The dead-CSS
diagnostic (§5.1) is therefore a symptom-catcher for a disease this candidate
cures; it stays useful only for the escape hatch and for ported code.

**Why it might not be.** (1) The idea has neighbours — Radix Themes, Chakra/
Panda recipes, Tamagui, Spectrum, Material component tokens, Figma variables —
so the vocabulary alone is not novel. What none of them have is **exclusivity**
(React always leaves `className` open, so no guarantee holds), **derivation**
(they map a token to hand-written classes rather than resolving from context),
or **a closed enumerable surface**. The moat is therefore exclusivity and
smallness, not invention — honest, and only available to a framework that can
make the intent channel the only channel and survive it. (2) It is as much a
*design* bet as an engineering one: the resolution rules must produce genuinely
beautiful defaults or nothing else matters, and that is taste work, not code.
(3) Expressiveness ceiling and the escape-hatch design are the whole risk
surface.

### C11. The appearance resolver — the framework makes every decision that needs eyes

**The objection that produces it (maintainer, round 5, verbatim in spirit):**
*"C10 is a component library. Radix Themes ships that today."* Correct, and the
correction matters: `role="primary" density="compact"` **is** library-grade
vocabulary. A library styles the components **it** shipped. The framework-level
question is what happens to the component **you** write tomorrow — and there,
every existing system drops you straight back to hand-picked pixels.

**The thesis, stated once.** An AI cannot see. So enumerate the authoring
decisions that *require eyes* — does this fit; does it overflow; are these
aligned; which breakpoint; what collapses first; what truncates; is this
readable; is the rhythm even — and **move all of them out of the author and into
the engine.** Every one is computable from declared semantics plus measurement.
An author who never makes an eyes-decision cannot make an eyes-mistake, and
neither can an agent. That is a framework capability by definition: it requires
owning the render path, the tree, and the reactive graph. No library can own any
of those.

**The precedent that proves the shape is real.** TeX: you declare a paragraph;
the engine solves line breaks *globally*, better than a human would place them
by hand. Nobody calls TeX a document library. Native toolkits do the same for
UI — AppKit toolbars collapse into overflow menus by declared priority, iOS
Auto Layout solves constraint priorities (Cassowary), Android ConstraintLayout,
Figma auto-layout's hug/fill. **The web is the only major UI platform where the
author still hand-places this**, and CSS cannot fix it alone because CSS
resolution is *local* — an element cannot know about its siblings' needs.
A framework that owns the tree can decide globally.

**Mechanism (the primitive set — this is the "higher-level engineering
language" of the initiating prompt).** Author declares semantics and
*priority*; the engine derives geometry:

```ts
const MessageRow = component('app-message-row', { author: p.string(), time: p.string() }, (props) => html`
  <div layout="row" align="center">
    ${Avatar({})}
    <div layout="stack" grow>
      <span text="title">${props.author}</span>
      <span text="meta" priority="3" truncate>${props.time}</span>
    </div>
    <div layout="row" priority="2" collapse="menu">
      ${Button({ role: 'quiet', icon: 'reply' })}
      ${Button({ role: 'quiet', icon: 'more' })}
    </div>
  </div>
`);
```

No pixel, no gap, no breakpoint, and **this is user code, not registry code**.
The engine resolves: spacing and type scale from context density (C10's
cascade), then the *fit* decisions — who grows, who truncates, who collapses to
an overflow menu, in declared priority order — from measurement of the actual
container. Consequence: **responsive without breakpoints.** Breakpoints are the
hand-picked magic numbers of layout; declared priority is the destination
description that replaces them.

**What this deletes from our own corpus, by construction rather than by check:**
overflow/clipping and responsive breakage (rank 6 — the solver fits or collapses,
so overflow is unrepresentable), misalignment and zero-gap (rank 9 — rhythm is
derived, never typed), plus C10's ranks 1 and 3. **Four of our top six defect
classes, deleted.**

**Why it is a framework capability and not a library:**

| | component library | appearance resolver |
|---|---|---|
| Covers | the components it shipped | every component you author |
| Knows | its own internals | the whole tree, live |
| Decides | locally, at author time | globally, at render time |
| Enforces | nothing on your code | raw values become a diagnostic |
| Explains | nothing | "why is this 12px" is a runtime query |
| Needs | npm install | the render path, the reactive graph, the build |

**Feasibility, honestly — and why this is not GSS.** Grid Style Sheets (2014)
put a general Cassowary constraint solver in the browser and died of weight and
slowness. The difference is scope: we do **not** solve general constraints and
we do **not** replace browser layout. Three tiers: (1) *static* — density,
rhythm, type scale, colour resolve to cascading custom properties and container
style queries, zero runtime, pre-solved at SSG time; (2) *intrinsic* — the
browser's own solvers (flex/grid/`clamp()`/intrinsic sizing/`text-wrap`)
do the continuous work; (3) *discrete* — only the finitely-many fit decisions
(collapse / truncate / reflow order) need measurement, and only for containers
that declare them, driven by `ResizeObserver` + fine-grained signals so a
re-solve touches one subtree. Tier 3 is a small bounded loop over a declared
priority list, not a solver over arbitrary equations.

**Why it might not be.** (1) Budget: tier 3 is real runtime code against a 10KB
core ceiling — it may have to be an opt-in module, which weakens the
exclusivity/enforcement argument that makes C10 work. (2) Art direction:
designers *want* a specific look at a specific width; priority lists must not
forbid explicit context overrides. (3) The rule set is the soul — a solver
delivers consistency, never beauty; beauty is the authored resolution table, and
that is taste work we cannot delegate to an engine. (4) Two-pass measurement
risks visible reflow; the static tier must cover the common case so tier 3 fires
rarely.

---

## 5. Current lead — round 5

**The one capability: the framework makes every appearance decision that
requires eyes, so the author never makes one (C10 + C11).**

*React solved what to render. Nisli solves how it should look.* The author
declares meaning and priority; the engine derives every value and resolves
every fit.

Round 4 stopped at C10 (declare intent, derive values) and the maintainer's
objection was right: **that alone is a component library** — Radix Themes ships
that vocabulary today. C11 is the framework half, and the distinction is not
cosmetic: a library styles the components it shipped; a resolver governs the
component *you* write tomorrow, because it owns the tree, the render path, and
the reactive graph. The one-line test for every future proposal in this bet:
**does it still work for a component the framework has never seen?** If not, it
is library work.

### 5.5 Round-4 position (retained) — declarative appearance

**Appearance becomes declarative (C10).** *React made structure a function of
state. Nisli makes style a function of meaning.* You state what a thing **is**;
the framework derives how it **looks**. Necessary, not sufficient: it supplies
the vocabulary the C11 resolver resolves.

This is the round-4 position and it superseded rounds 1–3's headline. The
checker is not abandoned — it is **relocated**: it becomes the byproduct of a
declaration rather than a product needing an author and a mandate. Rounds 1–3
are preserved below because their evidence is precisely what forces this move:

- Round 3 killed the checker *as the headline* on three grounds: nobody authors
  visual predicates (`galen-ts`: 0 downloads), the snapshot format is
  commoditizable by Playwright in one release, and no regime compels anyone to
  run an appearance check. A declaration-first design answers all three at once
  — there is nothing to author (values derive), nothing to commoditize (the
  moat is exclusivity of the channel, not a file format), and no regime needed
  (you cannot write UI without going through the channel).
- Round 2's #1 defect class is dissolved rather than detected: it exists only
  because styling reaches through DOM structure.
- The "check vs sidestep" fork (§7.7) resolves as **sidestep**, at the level of
  the whole category rather than one bug class at a time — consistent with the
  house lineage (0015 deleted `batch()`; 0023 made move bugs unrepresentable).

### 5.0 Why this is the jQuery→React-shaped move

| | jQuery → React | CSS/utilities → nisli |
|---|---|---|
| What you wrote before | the *transitions*: find a node, mutate it | the *pixels*: 40 tokens of utilities aimed at DOM shape |
| What you write after | the *destination*: UI for this state | the *purpose*: what this element is, in what context |
| Who derives the rest | the framework computes the mutations | the framework computes the values |
| Degree of freedom deleted | arbitrary DOM mutation order | arbitrary values and context-blind styling |
| What becomes decidable | given state, the DOM is predictable | given intent + context, the appearance is predictable — hence checkable |

Both moves have the same signature: **surrender expressiveness, gain
decidability.** Both look like a restriction and pay off as an enabler.

### 5.R (historical) Round-1 lead — appearance as a machine-checkable contract

*Superseded as headline by §5 round 4; retained because the §5.1 and §5.2
evidence rulings below still bind the checking layer.*

**The one capability (round 1): appearance becomes a machine-checkable
contract.** One sentence for the README: *nisli is the framework where
"does it look right?" is answered by a compiler, not a human eye.*

Composition, in dependency order — note that each layer is independently
shippable and useful, which is how a "one thing" bet stays fundable:

1. **C3 layout snapshot** — the artifact. Deterministic, textual,
   token-normalized, diffable. Agents get readable eyes.
2. **C2 relational assertions** — the checker. Coded N6xx diagnostics with
   fixes, on top of the snapshot. Font-metric-robust by refusing absolute
   pixels.
3. **C4 state enumeration** — exhaustiveness, free from T3's schema.
4. **C1 declared visual contract** — the language layer: intent declared once,
   beside props, gradually adopted.
5. **C5 design contract** — optional external referent, later.

**Why this is the defensible one, in five substrate facts nisli holds and the
React stack cannot assemble:** closed token layer (0022) · light DOM, so
geometry and semantics project from *one* representation (0019) · build-time
renderer with no browser assumption (SSG/`renderToString`) · value-level prop
schema for enumeration (0030.2 T3) · zero-dep single artifact, so a snapshot is
reproducible byte-for-byte. Each is load-bearing; each already exists or is
landing.

**The engineering insight that makes it tractable:** assert **relations, not
pixels**. Font metrics, engine versions, and subpixel rounding destroy absolute
geometry assertions — that is why screenshot diffing never became a loop. Every
bug class in §3 is relational.

**The strategic argument:** it converts the corpus deficit from fatal to
irrelevant. Priors get you a plausible first draft; the loop gets you a correct
final artifact. Every incumbent has the priors and no loop. This is the one
axis where being small, closed, and standards-aligned is an *advantage* rather
than a handicap.

### 5.1 Round-2 amendments (forced by the corpus evidence)

Evidence: [`ROUND2-EVIDENCE-defect-corpus.md`](./ROUND2-EVIDENCE-defect-corpus.md).
Appearance-family is **≈65% of 48 UI-layer product defects** (54% strictly
appearance) — kill criterion #1 is **not** met, the lead survives. But the
corpus adds three non-optional components and one correction:

- **Add: selector reachability (dead-CSS diagnostic).** The #1 recorded class
  (10 tickets / ~30 surfaces) is upstream selectors that are DEAD through a
  `display: contents` host. Half of it has *zero geometric signature* — a
  layout snapshot cannot see it. The catch is static: for every selector in a
  class list, resolve whether it can match a node that paints a box. This is
  the closest thing in the whole corpus to a **compile error for CSS**, and it
  may be a stronger headline than the snapshot.
- **Add: gesture-sequenced enumeration.** The largest logic cluster
  (7 tickets, several product-P0) is interaction/gesture/timing, and a layout
  snapshot inherits a screenshot's exact blind spot — the repo's own words
  (`2f43da1`): *"a static preview screenshots identically to a hydrated one…
  Screenshots prove paint; only interaction proves the component."* C4 must
  enumerate **sequences** (tap, hover-then-click, drag, scroll), not states.
- **Correct: relations need at least one absolute anchor.** UI-68 is the
  counter-example to §5's own insight: a purely *relative* fit check passed at
  704 ≤ 704 on a 390 px viewport. Viewport fit must be absolute.
- **Add: oracle credibility is a first-class engineering problem.** Five
  recorded instances of this repo's headless geometric guard being wrong
  (three false PASS, two disputed FAIL). A guard that has lied is a guard that
  gets muted. Every assertion ships with a **proof-of-detection fixture**: it
  must fail against a deliberately broken input before it is trusted.

**Honest external-validity limit.** The corpus is a *port* corpus, not a
green-field authoring corpus: raw-pixel invention (0), invisible focus (0), and
contrast failure (0) have no instances because the fleet was transcribing a
pinned design byte-verbatim. It sizes the oracle's value **to our own fleet**,
not to the market. A green-field agent-authoring corpus is the missing evidence
(→ §7.8).

### 5.2 Round-3 revision (forced by the prior-art evidence) — the lead changes shape

Evidence:
[`ROUND2-EVIDENCE-visual-oracle-prior-art.md`](./ROUND2-EVIDENCE-visual-oracle-prior-art.md).
This pass was adversarial and it landed. The *direction* survives; the
*staging and the headline do not*. Five rulings:

**R1 — The snapshot is not the product; demote C3 from headline to plumbing.**
Playwright already emits geometry: `ariaSnapshot({ boxes: true })` →
`[box=x,y,width,height]`, shipped v1.60 (2026-05-11), release note *"useful for
AI consumption"*, exposed as `--snapshot-boxes` in the MCP CLI. Its matcher
(`matchesNode()`) compares role/name/state and **ignores the box** — so
geometry is emitted-but-unenforced. `CDP DOMSnapshot.captureSnapshot` has
carried layout trees, computed styles, inline text boxes and DOM rects for
~8 years and nobody built a loop on it. "Agents get eyes that read" was a
commodity as of 2026-05. **The uncommoditized part is normalization,
assertion semantics, and tolerance policy.** Worse: Microsoft can add box
comparison to `matchesNode()` in one minor release, *framework-agnostically* —
which does not copy us, it deletes the differentiator while handing React the
same oracle.

**R2 — An authored relational DSL is falsified, not unbuilt.** Galen
Framework's `.gspec` had the entire vocabulary (`inside`, `near`, `aligned`,
`centered`, per-spec px error rates, `@on mobile` sections) and died at
29 downloads/week. Then the natural experiment ran *this year*: `galen-ts`
(2026-04) reimplemented the whole language on Playwright + TypeScript, 491
tests, fixing every stated excuse — Java, Selenium, staleness. Result four
months later: **2 stars, 0 downloads/week.** Revealed preference over a decade
is brutal and consistent: Chromatic 8.8M/wk, pixelmatch 9.5M/wk,
jest-image-snapshot 942k/wk versus Galen's 29/wk. **Teams will approve a
picture; they will not author a predicate.** So kill criterion #4 is the one
with the most historical support, and C2-as-a-DSL is dead in that form.

**R3 — Therefore zero-authoring is the adoption gate, and C4 moves first.**
The one geometric relational oracle that *won* is `axe-core` (66.5M/wk): it
computes bounding rects, `hasVisualOverlap`, `getLargestUnobscuredArea`,
`splitRects` for WCAG 2.2 target-size — and requires **zero per-component
authoring**, riding a *conformance regime* rather than a visual-testing value
prop. Consequence for us: assertions must be **derived**, never written. This
is where nisli's substrate is genuinely uncopyable — a component that declares
its own schema/manifest (0030.2 T3) can *generate its own expectations*, so
the enumeration (C4) and the checks are one artifact with no author. Sequence
becomes **C4 → derived checks → format**, not format → checks → enumeration.
Corollary: integrate axe-core for contrast/target-size/overlap rather than
rebuilding it (that also retires §3 classes 4 and 7 from our scope).

**R4 — Store verdicts, not numbers; and prefer a second rendering to a stored
baseline.** WebKit's own baselines for byte-identical markup disagree across
platforms (`784x185`/`784x184`, `96x18`/`93x18`, x-origin 97/95). Chromium
ranks layout-tree text dumps **last** of four test types, requires a removal
bug for every new one, and documents the exact kill criterion we wrote
independently: *"many cases where the layout tree output is misstated (i.e.
wrong), because people didn't want to have to update existing baselines."*
Baseline rot is the recorded outcome for this artifact type at Google scale
with a dedicated rebaselining toolchain. The technique that won inside the
standards process instead **deletes the stored artifact**: WPT reftests compare
a render against a *reference render* (`<link rel=match>`) with an explicit
fuzz budget. Design consequences, all sourced: tolerance lives in the
comparator, never in the file; verdicts are **three-valued** (pass / fail /
**incomplete**, per axe-core's `undefined` + `messageKey`), so the N6xx
taxonomy needs an `incomplete` severity on day one; the artifact is a
*distillation with a stability contract* and partial-match-by-default, per
Playwright's `ariaSnapshotDistiller` visitor chain and `containerMode:
'contain'`.

**R5 — Text is the leak, and settle() is a prerequisite.** Token
normalization normalizes only what tokens control; every text-derived number
(line box, wrap point, intrinsic width, ellipsis, optical baseline) is a
font-metric function — which is why the Ahem font exists and why Chromium
exempts text/font testing from it. Our two top appearance classes (overflow/
clipping, misalignment) are the two most text-dependent. So text geometry gets
**containment and invariance** assertions (does not overflow, does not clip,
fits the viewport), never size equality. And the flakiness list Chromatic
needs a human for — animations mid-frame, late font loading, image
recompression, `Date.now()`, RNG, offscreen iframes — is inherited in full by
*any* unattended oracle: quiescence (`settle()`, 0030.2 T2) is a **prerequisite
of this bet**, not an adjacent nicety.

**What survives all of it — and it is a different, sharper headline.** Two
items came through both evidence passes intact, and neither is the snapshot:

1. **Dead-CSS / selector reachability.** Our #1 recorded defect class
   (10 tickets, ~30 surfaces), *static*, zero authoring, and the prior-art
   pass found the category **empty**: "no evidence found of a mainstream
   linter that asserts over resolved layout geometry." It needs exactly what
   only we have — a closed registry, a manifest, and a known host-transparency
   rule. Candidate headline: **the framework where a style that can never
   paint is a compile error.**
2. **Derived, zero-authoring conformance over an enumerated state space**
   (C4 + R3). The axe-core shape, applied to appearance, made possible by
   schema-declaring components.

**The open strategic gap the evidence exposes.** axe-core won because WCAG
*compelled* it. A visual oracle with no regime behind it is a tool nobody is
required to run. Naming the regime is now a first-class question (§7.10) —
design-system conformance, an agent-verifiable-UI gate, the MCP Apps size/
theming budget (0029 §3 already build-failing), or our own registry CI as the
proof-of-concept regime.

---

## 6. Kill criteria (what would make me abandon the lead)

- ~~A fleet-corpus pass shows agent UI failures are overwhelmingly *logic and
  wiring*, not appearance.~~ **Tested round 2, not met.** Appearance-family is
  ≈65% of 48 UI-layer product defects; the pure-logic 53% figure only appears
  when the 20 core-framework issues from a 2026-07-16 architect sweep are added
  to the denominator, which answers a different question. Evidence:
  `ROUND2-EVIDENCE-defect-corpus.md` §2.
- **Vision-model risk — measured round 3, currently low.** GUI *localization*
  improved hugely (ScreenSpot-Pro ~2% → 87.9%), but *metrology* did not:
  BlindTest puts frontier VLMs at ~58% on "are these two shapes touching",
  recovering only as separation grows — i.e. failure is concentrated exactly in
  the few-pixel regime; UI-Lens (CVPR 2026) reports ~20% F1 on UI text-layout
  tasks. A textual geometry oracle stays valuable, but *because of assertion
  semantics*, not because it exposes numbers.
- ~~The snapshot format cannot be normalized enough to avoid churn.~~
  **Confirmed as the recorded outcome, round 3** — Chromium documents
  "misstated" layout baselines nobody wanted to rebaseline, and ranks the
  artifact type last of four. Mitigation is now structural (R4): no stored
  numbers, reference-render comparison, tolerance in the comparator.
- ~~Relational assertions need per-component authoring.~~ **Falsified as a
  product, round 3** — Galen (29 dl/wk) and its 2026 Playwright rewrite
  `galen-ts` (0 dl/wk after fixing every excuse). Authored predicates have no
  demand. Zero-authoring derivation (R3) is now a *requirement*, not a
  preference.
- **NEW — no regime, no adoption.** axe-core won on WCAG compulsion. If §7.10
  cannot name a regime that makes running the oracle non-optional, the bet is a
  tool nobody runs, regardless of quality.
- **NEW — Playwright ships box comparison.** If `matchesNode()` learns to
  compare `[box=…]` (a handful of lines against fields that already exist), the
  format half is commoditized framework-agnostically. Watch the Playwright
  changelog; treat the format as plumbing, never as the moat.

---

## 7. Open questions for the next iteration

1. **Language or checker?** Is the identity the *declaration* (C1, a visual type
   system with syntax) or the *oracle* (C2/C3, a checker over existing code)?
   TypeScript was both, but it shipped as a checker over JS first.
2. **How closed does the styling vocabulary get?** Tailwind-with-token-lint
   (adoptable, weaker guarantees) vs a closed layout algebra (strong
   decidability, adoption cliff, escape-hatch design becomes critical).
3. **Where does the engine live?** Real browser as oracle (accurate, heavy
   tooling) vs an in-house resolver over the closed subset (browserless,
   deterministic, huge build). Hybrid: browserless for the algebra, browser for
   the `--live` tier?
4. ~~**Corpus pass.**~~ **Done, round 2** —
   [`ROUND2-EVIDENCE-defect-corpus.md`](./ROUND2-EVIDENCE-defect-corpus.md).
   Rankings and the appearance/logic split live there; the rulings it forced are
   in §5.1.
5. **What does the snapshot look like?** Draft two formats on a real registry
   component and diff them against an intentional 2 px regression.
6. **Naming.** `nisli look` / visual contracts / layout types / appearance
   types. Naming decides how the thesis is understood; defer until §7.7 and
   §7.1 settle.
7. **Check or sidestep? (now the top fork, ahead of §7.1.)** C9: the house
   lineage deletes defect classes rather than detecting them, and it already did
   so for the #1 recorded class via container style queries (`bd90728`). Does
   the bet become "the framework where visual defects are *unrepresentable*"
   instead of "…where they are *checked*"? A checker is nameable and marketable;
   a sidestep is cheaper and truer to form. Plausible synthesis: sidestep the
   classes a closed vocabulary can delete, check the irreducible residue
   (content extremes, viewport fit, host theming) — and market the residue
   checker, because that is the part users can see working.
8. **Green-field corpus.** The round-2 corpus is a *port* corpus, so three
   predicted bug classes scored zero. Run the same ranking against a green-field
   agent-authoring sample (N components built from a prose brief, no upstream
   referent) before sizing the market.
9. **Proof-of-detection discipline.** Design the rule that every assertion must
   fail on a deliberately broken fixture before shipping — five recorded
   wrong-oracle instances say this is the difference between a loop and noise.
10. **What is the regime?** (New, top-3.) axe-core's 66.5M/wk came from WCAG
    2.2 compelling it. Candidate regimes for an appearance oracle: design-system
    conformance (token adherence, auditable), an "agent-verifiable UI" CI gate,
    the MCP Apps size/theming budget (0029 §3, already build-failing), or our own
    registry CI as the demonstrator. Without one, §5's lead is a tool nobody is
    required to run.
11. **Reference-render oracle design.** (New.) Per R4/WPT: what is the second
    rendering we compare against — the pinned upstream reference, the same
    component at another viewport/state (invariance), or the previous commit?
    Each has a different maintenance profile; the drift hazard is already
    recorded in-house (the shadcn baseline moved mid-audit).
12. **Why did Galen actually die?** (New, largest single unknown.) No archive
    notice, no post-mortem, no maintainer statement exists. Our story for why
    relational assertions failed is currently *unsourced inference*. Until it is
    sourced, assume the cause is demand, not tooling — and note that R3's
    zero-authoring derivation is the only mechanism we have that changes demand.
13. **(Round 4, now the top question.) What is the intent vocabulary?** Draft
    the complete list of roles, containers, and context axes on paper, then test
    it against the hardest real surfaces we own (nisli.dev docs nav, the ACP
    transcript, a data table, a marketing hero). If the list needs more than
    ~30 entries, or if any of those four surfaces cannot be expressed without
    the escape hatch, C10's decidability claim is weaker than advertised.
14. **(Round 4.) How much can context resolution do natively?** Cascading
    custom properties + container style queries, or does derivation need JS?
    Prototype: one button, unchanged at the callsite, rendering correctly in a
    compact toolbar and a hero. If it needs runtime JS, the size and SSG stories
    both take damage.
15. **(Round 4.) The escape hatch's semantics.** Raw `style`/utilities must stay
    possible, but a subtree that uses them is unverified. Is that a warning, a
    build flag, a manifest field, or all three? This is the `any` decision, and
    TypeScript's gradualness was the reason it won.
16. **(Round 4.) Who authors the resolution rules?** The bet is as much design
    taste as engineering: defaults must be genuinely beautiful or the vocabulary
    is worthless. Is that Goga, a designer, or derived from an existing system
    (Radix Themes / Spectrum / Material as the starting rule set)?
17. **(Round 5, now THE question.) Does the resolver survive a component the
    framework has never seen?** Build one bespoke surface — a message row with
    avatar, name, timestamp and two actions — in user code, containing **zero**
    pixel values and **zero** breakpoints, and require it to be correct in a
    320px sidebar, a 1200px page, dense mode, and a hero, with the actions
    collapsing to an overflow menu and the timestamp truncating in declared
    priority order. This is the whole bet in one fixture: it is impossible with
    any component library today, and if we cannot make it work, C11 is dead and
    we are back to a library.
18. **(Round 5.) Which decisions genuinely need measurement?** Enumerate the
    eyes-decisions and sort them into: resolvable statically (density, rhythm,
    type scale, colour), resolvable by the browser's own solvers (flex/grid,
    `clamp()`, intrinsic sizing, `text-wrap`), and needing a measured pass
    (collapse, truncate, reflow order). Only the third tier costs runtime bytes;
    if that list is longer than ~4 decisions, the budget argument fails.
19. **(Round 5.) Budget and packaging of tier 3.** A measured fit pass against a
    10KB core ceiling: in core (protects exclusivity, costs bytes) or opt-in
    module (cheap, weakens the "only channel" guarantee)? This is the one place
    where the C10 enforcement story and the C11 capability story pull apart.
20. **(Round 5.) Art direction.** Priority lists must not forbid "at this width
    it looks like *this*". Design the explicit context override so declared
    priority stays the default and art direction stays possible — without
    reintroducing breakpoints as the normal path.

---

## 8. Iteration log

- **2026-08-25 · round 1** — Prompt captured. Question split into representation
  shift (Ask A) vs pixel-perfection referent (Ask B). Eight candidates drafted;
  C7 and C8 killed. Lead: appearance as a machine-checkable contract, staged
  C3 → C2 → C4 → C1 → C5, on the relations-not-pixels insight. Next action: the
  §7.4 corpus pass.
- **2026-08-25 · round 2** — Two evidence passes commissioned. Corpus pass
  landed (`ROUND2-EVIDENCE-defect-corpus.md`): kill criterion #1 tested and not
  met; lead survives. Forced amendments in §5.1 — add selector-reachability
  (dead-CSS) diagnostic, gesture-*sequenced* enumeration, one absolute viewport
  anchor, and proof-of-detection fixtures. New candidate C9 (sidestep instead of
  check) is now the top open fork (§7.7). Prior-art pass (relational-assertion
  DSLs, textual layout baselines, vision-model geometry) still in flight.
- **2026-08-25 · round 3** — Prior-art pass landed
  (`ROUND2-EVIDENCE-visual-oracle-prior-art.md`) and forced a reshape, recorded
  in §5.2: snapshot demoted to plumbing (Playwright already emits `[box=…]`,
  matcher ignores it); authored relational DSL falsified by the `galen-ts`
  natural experiment; zero-authoring derivation promoted to an adoption gate
  with C4 sequenced first; store verdicts not numbers, three-valued severity,
  reference-render comparison instead of stored baselines; text geometry limited
  to containment/invariance; `settle()` reclassified as a prerequisite. Two
  items survived both passes: the **dead-CSS / selector-reachability
  diagnostic** (category empty in the prior art, #1 in our own corpus) and
  **derived conformance over an enumerated state space**. New top questions:
  the regime (§7.10) and the reference-render design (§7.11).
- **2026-08-25 · round 4** — Maintainer pushback: the dead-CSS diagnostic is
  narrow, and self-checking components — while interesting — are not the
  jQuery→React-shaped move he asked for. Correct on both counts, and the
  reconciliation is C10 (§4, new): **declarative appearance**. React
  declarativised structure and left appearance imperative; utility class strings
  are jQuery-for-pixels. Declare intent + context, derive the values. The lead
  moves to C10 (§5 round 4, with §5.0 stating the shift in jQuery→React terms);
  the checker relocates from *product* to *byproduct*, which is what answers
  round 3's three fatal objections (no authoring, no format moat, no regime);
  round 2's #1 defect class is dissolved rather than detected, since it exists
  only because styling reaches through DOM structure. The §7.7 check-vs-sidestep
  fork resolves as **sidestep, at category level**. New top questions: the
  vocabulary itself (§7.13) and whether context resolution is native
  (§7.14).
- **2026-08-25 · round 5** — Maintainer objection, and it lands: C10 alone is a
  component library (`role="primary" density="compact"` is Radix Themes-grade
  vocabulary), so it cannot be the framework-level bet. Answer recorded as C11
  (§4): the **appearance resolver** — enumerate every authoring decision that
  requires *eyes* (fit, overflow, alignment, breakpoint, collapse order,
  truncation, rhythm) and move all of them from the author into the engine.
  Framework-level by definition: it needs the tree, the render path, and the
  reactive graph, none of which a library owns. Precedent for the shape is TeX's
  global line-breaking and native toolkits' priority-driven collapse; the web is
  the only major UI platform where the author still hand-places this, because CSS
  resolves locally. Deletes four of our own top-six defect classes by
  construction. Lead becomes §5 round 5 = C10 (vocabulary) + C11 (resolver),
  with the standing test: *does it still work for a component the framework has
  never seen?* Not-GSS argument recorded (bounded discrete fit decisions, three
  tiers, browser keeps doing continuous layout). New decisive question: §7.17,
  the bespoke message-row fixture.
