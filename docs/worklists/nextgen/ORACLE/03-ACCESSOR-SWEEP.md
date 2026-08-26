# Accessor Sweep — does every rule measure the geometry its claim is about?

**Date**: 2026-08-26 · **Kind**: exhaustive internal audit of shipped code, primary source only
**Slice**: All rules in `packages/intent/src/diagnostics/rules/`, swept for the recurring class recorded as six of ten oracle defects.
**Parent**: [`ORACLE`](./) — checker self-verification

---

## The headline finding, which is not the one the ADR states

The ADR names the recurring class as **"the rule measured a geometry that does not answer the claim it makes."** That is true of six defects and it is what the `Box`/`Bounds` type split closed. Sweeping all sixteen rules says it is an **instance**, not the class.

Six of the sixteen rules are unsound or suspicious. Every one of the six is the same defect at a different address:

| rule | what is missing |
|---|---|
| N670 | the `:last-child` exemption set is built from `declared()`, for a claim about the last **painted** child |
| N713 | an unresolvable discriminator is mapped to a default and the rule continues |
| N740 | no `[data-escaped]` exemption, no `measurable()` arm |
| N620 | a `painted()` selector gating a mutator-written **declaration** |
| N660 | no `measurable()` arm |
| N730 | no `[data-escaped]` exemption |

There are exactly **three cross-cutting obligations** in this checker, and all three are applied **per rule, by hand**:

1. **`measurable()`** — the admission a rule owes when `painted()` silently dropped content it cannot measure.
2. **The `[data-escaped]` subtree exemption** — N601 says an escaped subtree "forfeits the rhythm, fit, contrast and hit-target guarantees", so no rule may claim one.
3. **The `declared()`-versus-`painted()` choice**, including the hybrid case where the *trigger* is a declaration and the *numbers* are a measurement.

Nothing anywhere states which obligations a given rule needs. The result is not partial coverage, it is **arbitrary** coverage: the three newest rules carry all three, the three oldest carry none, and the assignment tracks *when the rule was written* rather than *what it claims*. So the honest generalisation is:

> **A rule's cross-cutting obligations are hand-applied, therefore unevenly applied. Wrong-geometry was one instance; the type split closed that instance and left the mechanism intact.**

**N740 is the proof, and it is brutal.** Its accessor is right, its claim is right, its scope argument is the most carefully reasoned in the set — and it is missing both guards its three siblings carry. `directional-overflow.ts:91-95` names this exact failure *about itself*, one rule earlier:

> "This is the eighth oracle bug in this experiment and the one with the least excuse: N710 was given exactly this exemption an hour earlier, for exactly this reason, and its sibling did not get it. **A fix applied to one rule and not to the rule beside it is its own defect class**, and the reason it is recorded here rather than quietly patched."

The pattern predicted its own next instance, in a header, in this repository, and the next instance happened anyway — in the rule written immediately afterwards. That is the fourth recurrence of "documented did not prevent", after the three the ADR already counts.

---

## Verdict in five bullets

1. **Adversarial, and it is the reason this file exists: the two fixes here were both found by reading, not by failing, and one of them made a rule that always passes.** N650 read its floor with `px()`, which coerces an unresolvable property to zero, and its next line was `if (!(floor > 0)) continue`. Any failure to resolve `--intent-min-target` therefore made the rule skip every control it selected and report a clean page **forever** — no error, no finding, and no possible fixture, because silence is what a healthy document looks like. Six of the twelve fixtures written for this sweep failed against the shipped rules before either fix landed. **Nothing in the existing suite of one hundred and eighty-eight tests could see either defect**, because both are defects in what a rule reads, and every fixture supplied the reading.
2. **Adversarial: the `Box`/`Bounds` type split did not stop the recurrence, it relocated it.** N690 kept making the class's signature mistake *after* the type split, and the type could not object, because both readings are `Box`: `box.block` minus resolved padding, divided by `line-height`, is an element geometry standing in for a text one. It was live rather than doctrinal — happy-dom resolves `padding-block-start` to the empty string, `px()` coerced it to zero, and a padded single-line heading measured as two lines in this package's own unit environment. That is the rule's recorded first-run defect (every table header reporting "1 word across 2 lines") reopened *through the arithmetic added to close it*. Structural beats documented; **types beat comments but only inside the distinctions the type draws.**
3. **The good news, quantified: the accessor choice itself is now sound in fifteen of sixteen rules, and the port's own vocabulary is what did it.** Every containment claim reads `box()`, every pressability and visual-extent claim reads `bounds()`, every text claim reads `lines()`, `containment()` is asked rather than `overflow` being parsed, and colour is resolved by the adapter rather than by a regex. Only N690 was still reading the wrong geometry, and it is fixed. The `Box`/`Bounds`/`lines()`/`containment()` vocabulary is doing real work — the failures are all in the *obligations around* the accessor, not in the accessor.
4. **One rule would silently pass everything if a property failed to resolve, and a second would go vacuously quiet across a whole document.** N650 (fixed) is the definite case. N713 is the conditional one and is reported rather than rewritten: its discriminator maps an unresolvable `column-count`/`column-width` onto `auto` and continues (`multicolumn.ts:113-115`), so in any engine that does not resolve those properties the rule is silent over every element — which is precisely the shape `crushed.ts` enumerates positively to avoid, in a comment about a different table. There is no cheap fix, because the alternative is N680 on every element in the document.
5. **The answer to "should this be a guard" is no: every geometric rule needs all three obligations, so the fix is to make them unwritable-without.** Of the sixteen rules, eleven read geometry and **all eleven need all three**; the five that need none are the three pure-declaration rules, the document-scope rule, and the colour rule, each for a stated reason. When a concern is needed by every member of a category, a checker that verifies it was remembered is the wrong tool — the right one moves it into the `Lens` or into `rule()`, so a measuring rule cannot be composed without it. This project has three recorded recurrences proving documentation is not a mechanism, and the `Box`/`Bounds` split proving a type is.

---

## The sweep: sixteen rules, one verdict each

Sixteen rules ship, not fifteen. The registry allocates seventeen codes; N680 has no rule by design, because it is the code every rule uses to admit defeat.

`geometry read` is what the rule actually calls. `geometry the claim requires` is derived from the claim sentence and checked against `contracts.ts`, not against the rule's own header.

| code | the claim in one sentence | geometry it reads | geometry the claim requires | verdict |
|---|---|---|---|---|
| **N601** | This subtree declares an escape, so no guarantee this checker makes applies inside it. | none — `declared()` only | none; an escape is a fact about source | **sound** |
| **N610** | This declared attribute value is outside the closed vocabulary for its axis. | none — `declared()` only | none; illegal as written, with no appeal to layout | **sound** |
| **N620** | This container stamped `unsatisfiable`, and here is how far short it fell. | `box()` — `contentInline` against `inline` | padding box; containment, and like-for-like only inside it | **sound, limit named** |
| **N621** | The solver truncated this and what survived is not readable as a value. | `box()` plus surviving text length | padding box; the claim pairs text with the space it was clamped to | **sound** |
| **N630** | The document is wider than the viewport. | `viewport()` — two numbers | those two numbers; the one absolute claim in the set | **sound** |
| **N640** | This text is below the contrast floor **this context declared**, against the nearest painted backdrop. | `colour()`, `backdrop()`, floor via `raw()` and an explicit parse | none — contrast is a colour claim, and the rule asks for neither box | **sound — the reference implementation** |
| **N650** | This control's pressable area is below the minimum target floor its context declared. | `bounds()` (correct) — **floor via `px()` on a custom property** | `bounds()`, and `raw()` for the floor, to keep declared-zero apart from unresolvable | **WRONG → fixed** |
| **N660** | This box did not get the inline space its content needs, so the overflow lands on a neighbour. | `box()` — `contentInline` against `inline` | padding box; a border box would hand every element a free border width of slack | **sound, limit named** |
| **N670** | A crushed non-final in-flow child of a single-line row necessarily paints into the following sibling. | `box()` (correct) — **`final` set built from `declared()`** | padding box, and the last **painted** child, since the claim is about a neighbour that is on screen | **SUSPICIOUS → reported** |
| **N690** | A word was broken inside itself to fit this box. | **`box().block` minus `px(padding-block-*)`, divided by `raw(line-height)`** | `lines()` — a text measurement, because the claim is about text | **WRONG → fixed** |
| **N700** | Two actions in one surface both declare priority, and attention cannot be spent twice. | none — `declared()` only | none; it reads no geometry, which makes it structurally immune to this class | **sound** |
| **N710** | This clipping box destroys meaningful content that nothing scrolls and nothing declared away. | `bounds()`, four edges, rect against rect | border box with origin; a visual-extent claim, and `Bounds` correctly has no `contentInline` | **sound** |
| **N713** | An item lies outside its multicolumn container's own rectangle, where no per-node crush test can reach. | `bounds()` rect against rect — **discriminator via `raw()` with empty mapped to `auto`** | border box with origin; a column box is not an element, so the container's rect is the only real box | **SUSPICIOUS → reported** |
| **N715** | Content paints before its container's start edges, where a scroll extent structurally cannot see it. | `bounds()` origins | border box with origin; scroll extents only grow towards the end edges | **sound** |
| **N730** | A declared truncation was spent and the element did not get any smaller. | `box()` — `contentInline` against `inline` | padding box; "was this clamped" is content-wanted against content-got | **sound, limit named** |
| **N740** | Text reflowed onto multiple line boxes inside a row declared to hold one. | `lines()` | `lines()` — exactly right, and the only rule that had it right from the first commit | **SUSPICIOUS → reported** |

**Totals**: sound eight · sound with a named limit three · suspicious three · wrong two.
**Would silently pass everything if a property failed to resolve**: **one** definite (N650, fixed) and **one** vacuous-quiet (N713, reported).

---

## The obligations table — the specification for whatever closes this

For each rule: which of the three cross-cutting concerns its claim **needs**, and which it **has**. `needs` is derived from the claim, not from the code. This is the table a structural fix has to satisfy.

`M` = a `measurable()` admission arm. `E` = the `[data-escaped]` subtree exemption. `S` = a correct `declared()`/`painted()` selector for what the claim is about.

| code | needs M | has M | needs E | has E | needs S | has S | gap |
|---|---|---|---|---|---|---|---|
| N601 | no | — | n/a — it **is** the escape accounting | — | `declared` | `declared` | none |
| N610 | no | — | no — the vocabulary is this package's own namespace, not a guarantee an escape can forfeit | — | `declared` | `declared` | none |
| N620 | **yes** | **no** | **yes** — N601 names fit | **no** | hybrid: a declaration triggers, a measurement reports | `painted` | **M, E, S** |
| N621 | **yes** | **no** | **yes** — N601 names fit | **no** | hybrid | `painted` | **M, E, S** |
| N630 | no — document scope, no node geometry | — | no — document scope | — | none | none | none |
| N640 | no — contrast is a colour claim and colours resolve in a skipped subtree | — | **yes** — N601 names contrast | **no** | `painted`, because rendered-ness is a precondition of the claim | `painted` | **E** |
| N650 | **yes** | **no** | **yes** — N601 names hit-target | **no** | `painted` | `painted` | **M, E** |
| N660 | **yes** | **no** | **yes** | **yes** | `painted` | `painted` | **M** |
| N670 | **yes** | **no** | **yes** | **yes** | `painted` for the measurement **and** for the sibling-position set | `declared` for the position set | **M, S** |
| N690 | **yes** | **no** | **yes** | **no** | `painted` | `painted` | **M, E** |
| N700 | no | — | no — it counts declarations about the author's own markup | — | `declared` | `declared` | none |
| N710 | **yes** | **yes** | **yes** | **yes** | `painted` + `declared` for the admission | both | none |
| N713 | **yes** | **yes** | **yes** | **yes** | `painted` + `declared` | both | none |
| N715 | **yes** | **yes** | **yes** | **yes** | `painted` + `declared` | both | none |
| N730 | **yes** | **no** | **yes** — N601 names fit | **no** | hybrid | `painted` | **M, E, S** |
| N740 | **yes** | **no** | **yes** | **no** | `painted` | `painted` | **M, E** |

**Reading the table.**

- **Eleven rules read geometry. Three have the `measurable()` arm.** Eight measuring rules can still be handed a `content-visibility: auto` subtree, find nothing, and report clean. `observe.ts:24-32` states the obligation — "`declared()` is now also the only route to a node the checker CANNOT measure… The rule then owes an `out.undecidable()`, never a `continue`" — and eight rules do not discharge it.
- **Twelve rules make a claim N601 forfeits. Five carry the exemption.** Seven can report a defect inside a subtree that declared it styles itself.
- **Four rules are declaration-triggered but selected through `painted()`** (N620, N621, N730, and N670's position set). For the first three the *trigger* is an attribute the mutator wrote; a skipped subtree hides the trigger along with the numbers, so a container that admitted defeat can go unreported. That is the F4 precondition applied one layer too early: the correct shape is `declared()` for the trigger, then `measurable()` deciding between numbers and an admission.

**Does any rule legitimately need none of the three? Yes — five, and each for a reason worth keeping.** N601, N610 and N700 read no geometry at all, which is what makes them structurally immune to this entire class (`competing-primaries.ts:23-28` argues exactly that, and it is the strongest single design decision in the set). N630's subject is the document, so there is no node to be unmeasurable and no subtree to have escaped. N640's claim is about colour, which resolves in a skipped subtree, so `measurable()` would be a category error — though it still needs `E`, and does not have it.

**Therefore the recommendation is not a guard.** Eleven of eleven geometric rules need all three obligations, and the two categories are cleanly separable by whether the rule touches geometry — which the `Lens` already knows, because `painted()` is the only route to a measurement. A concern that every member of a category needs belongs in the constructor for that category, not in a checklist over it. Concretely, the two shapes available:

- **`rule()` grows a measuring variant.** `measuringRule(code, body)` resolves the escaped set and the unmeasurable set once, hands the body only nodes it may judge, and emits the admission itself. A rule then cannot be written without them because there is nowhere to put the omission.
- **`Lens.painted()` returns the obligations with the nodes**, so a rule that wants raw access has to ask for it by a name that says what it is giving up.

Either is a decision about where this lives, which is explicitly not this sweep's to take. What the sweep asserts is the strength of the claim: **this is the fourth recurrence, three of the previous three were answered with prose and recurred, and the one answered with a type did not.**

---

## The two fixes

Both are one rule per change, both have fixtures that **fail against the shipped rule**, and both are recorded in the rule's own header.

### N650 — the floor read (`hit-target.ts:110-127`, fixtures `hit-target.test.ts`)

The rectangle was never the problem. The other side of the comparison was.

```
const floor = el.px('--intent-min-target');
if (!(floor > 0)) continue; // no floor declared: this context makes no promise
```

`Observation.px()` is `Number.parseFloat(style) || 0` (`observe.ts:125`), and its own doc comment says the coercion is deliberate and that **"a rule that needs to distinguish 'zero' from 'unresolvable' asks `raw()` and decides for itself"** (`observe.ts:80-88`). N650 needed exactly that distinction and did not ask. Three separate ways to reach it:

- **A consumer document with no resolution table.** The token resolves to the empty string on every node. This is the fourth case `contrast.ts` enumerates and refuses at length — "NO FLOOR DECLARED — the theme that owns the threshold is not loaded" — and N650 is the rule beside it that did not refuse.
- **A renamed token.** `namespace.test.ts:46-53` records this in prose and guards it by asserting the string `--intent-min-target` is declared somewhere in `theme/`. That is a fact about **this repository** and it says nothing about a consumer's document. The prose is exactly right and the guard cannot reach the case it describes.
- **A floor derived rather than authored.** An unregistered custom property computes to its **substituted token stream**, not to a resolved length, so a floor derived from the inherited unit the way every other value in `theme/roles.css` is derived computes to a `calc(…)` expression that no parse reads as a number. The shipped table declares this one token as a plain length — `theme/tokens.css:51,191,197` — which is the only reason the deployed rule ever worked.

In every case: zero floor, `continue` on every control, **a clean page forever**. This is the worst shape a rule in this set can take, and the experiment's own tally is why: three of its four oracle bugs were silent rather than noisy, and a rule that always passes is the limit of silence.

**The fix is `raw()` and a three-way split**, not "treat zero as undecidable" — because a declared zero is a real and different answer. The table declares this floor twice: zero in the pointer context, a length in the touch context. So:

- unparseable → `out.undecidable()`, naming the property and what it resolved to;
- an explicit zero → `continue`, a context declining to promise;
- positive → measure `bounds()` against it, unchanged.

That is the same three-valued shape `contrast.ts` ships, and — per `OracleTheory`'s independent finding — the same violation / pass / incomplete split that the most widely deployed accessibility checker on the web ships, where incomplete results are defined as those that "were aborted and require further testing… because of technical restrictions to what the rule can test."

**Fixtures.** Two failed before the fix: N680 for an unresolvable floor, and N680 for a `calc(…)` floor. Two pin the sides the fix must not disturb: silence on a declared zero, and a verdict on a real floor — the latter being the falsification that the admission arm did not swallow the class.

### N690 — the line count (`shredded.ts:130-152`, fixtures `shredded.test.ts`)

The derivation was `(box.block - padding-block) / line-height`. Every term failed somewhere, and the sweep measured all three:

- **The padding subtraction was `px()`.** happy-dom resolves `padding-block-start` to the empty string, so the subtraction was zero and a padded single-line heading measured as two lines — a false failure, **live in this package's own unit environment**, not a hypothetical. It is the rule's recorded first-run defect reopened *through the arithmetic added to close it*.
- **Padding is not the only reason a box is taller than its text.** A stretched row child, a `min-block-size`, an inline-block sharing a taller line box: none are padding and no padding read subtracts them. The sharpest case is already in the file — a control's box is a hit **target** whose slack is the floor doing its job, which is why widening this rule to control labels fired on a clean icon button. `InjectionHarness` reached the same three mechanisms independently and carried the case as a named decoy.
- **The divisor needed `line-height` to be a length**, so `normal` cost a verdict that was in fact available and produced N680 instead. That admission was an artefact of the arithmetic and was therefore never an honest admission.

`Inspector.lines()` counts the line boxes the browser produced, from `Range.getClientRects()` (`dom.ts:95-116`). No divisor, no padding term, no element geometry. `contracts.ts:500-515` states the relationship and predicted this exact cleanup — "N690's arithmetic, its padding subtraction and its undecidable arm all become deletable the day that rule is moved onto this member" — and deferred it pending a falsification. The fixtures supply it.

**What the move costs, named rather than discovered later.** `lines()` counts a node's own text runs while `text()` returns the whole subtree's text (`dom.ts:227-229`), so a `[data-text]` node whose words live inside a nested element reports zero lines against a positive word count and is not measured. That is an **honest zero**, not an unresolvable one — the distinction `raw()` exists for, applied to a count — so it is a `continue` and not an admission. It under-reports and never invents a defect, the same bounded residue N710 accepts on a border width and N713 on a column gap. The old derivation did not cover that case correctly either; it measured the wrapper's box against the subtree's words.

**What is deliberately NOT done.** The recorded hole — a control's label is not `[data-text]`, so no rule measures line breaking on any label in the system — is now **unblocked**: the reason the widening failed was the divisor, and that same clean icon button reports one line box against one word. It is still not shipped, because widening the selector is a new claim over a shape nobody has measured with this accessor, and three correct measurements in this experiment have already produced three wrong explanations. Reported, with the evidence, in the rule's header.

---

## The three suspicious rules — reported, not rewritten

Each of these looks wrong and has a plausible story. A confident rewrite on a plausible causal story is this project's own recorded defect class, so each gets an argument and a falsification test, not a patch.

### N670 — the `:last-child` exemption is built from `declared()`

`overlap.ts:77`:

```
const final = new Set(lens.declared('[data-layout="row"] > *:last-child').map((el) => el.node));
```

The claim is *"in a single-line row the next sibling's box begins where this one's box ends, so a child whose content exceeds its own box paints into the following sibling"* — and `:last-child` is exempt because "its overflow lands on the row's padding, not on a neighbour."

`:last-child` is a **DOM position**. When the real last child is `display: none`, the last **painted** child is not `:last-child`, is therefore not in the exempt set, and its overflow — which lands on the row's padding, exactly as the exemption describes — is reported as a collision with a neighbour that is not on screen. The claim is about paint; the exemption is about markup.

**Why it is not fixed here.** The correct set is not simply `painted()` over the same selector — that yields the painted nodes *matching* `:last-child`, which is the same set, not the last painted child of each row. Computing "last painted child" needs either sibling order per container (the port deliberately exposes no sibling traversal, and `overlap.ts` argues that widening `contracts.ts` is now a versioned decision) or a per-container `painted('> *')` scan and an index. The second is available and cheap. It is a real change to a real inference and it wants its own falsification: a row whose last child is collapsed, with the previous child crushed, asserted silent. **Recommended, scoped, not taken.**

### N713 — an unresolvable discriminator mapped to a default

`multicolumn.ts:113-115`:

```
const count = container.raw('column-count');
const width = container.raw('column-width');
if ((count === 'auto' || count === '') && (width === 'auto' || width === '')) continue;
```

The empty string is mapped onto `auto`, so an engine that does not resolve these properties makes this rule silent over **every element in the document**. That is precisely the shape `crushed.ts` enumerates positively to avoid, in its `EXEMPT_CONTAINMENT` note:

> "it ENUMERATED what is exempt rather than testing `overflow-x !== 'visible'`, because happy-dom does not expand the `overflow` shorthand and does not default the longhand, so the negative spelling would exempt every element and this rule would go vacuously quiet in unit tests while still working in Chromium."

And the same file's own `display` read makes the *opposite* choice for the same reason class, eleven lines below: "Enumerated positively so an unknown or unresolved value lands in N680 rather than being waved through… **Loud beats vacuous.**"

**Why it is not fixed here, and this is the interesting one.** There is no cheap fix. The `display` read can be loud because it fires only after a positive multicol signal; the discriminator has no such gate, so refusing to default it means N680 on every element on the page — catastrophic noise, and a worse failure than the silence. The honest options are a positive whole-document capability probe (does *any* element resolve `column-width`? if not, the rule is inoperable in this engine and should say so **once**), or leaving it as a named limit. The first is a new mechanism and belongs with whatever closes the obligations table. **Reported as the second silent-pass shape in the set, and the only one with no local fix.**

### N740 — right accessor, both guards missing

`reflowed.ts:120-133` has no `[data-escaped]` exemption and no `measurable()` arm, while N710, N713 and N715 — written in the same slice, about the same family of defects — have both. Consequences: it can report a reflow inside a subtree that declared it styles itself, and a `[data-fit][data-layout="row"]` containing skipped content reports clean rather than admitting it cannot see.

**Why it is not fixed here.** Because the fix is three lines and that is exactly the problem. Patching N740 alone reproduces the mechanism one more time: it would leave N620, N621, N650, N660, N670, N690 and N730 with the same gaps and no reason recorded for why N740 got the treatment and they did not. This rule is the **evidence for the headline finding**, and spending it on a local patch buys one rule and loses the argument. It belongs in the batch that closes the obligations table.

---

## Named limits in the three "sound, limit named" rules

- **N620 and N730** are triggered by attributes the mutator wrote — `data-fit="unsatisfiable"`, `data-truncate` — but selected through `painted()` (`fit-state.ts:26`, `spent-for-nothing.ts:67`). A `content-visibility: auto` subtree hides the declaration along with the geometry, so a container that **admitted defeat** goes unreported. The F4 precondition is right and is applied one layer too early.
- **N660** iterates `painted('*')` across the whole document (`crushed.ts:108`) with no `measurable()` arm, which is the broadest instance of the eight. It is *partially* covered by accident: N710 admits for any clipper, N715 for any `[data-layout]`/`[data-fit]` container, N713 for any multicol box. It is worth stating that this coverage is genuinely accidental — `content-visibility: auto` does **not** make `containment()` return `clip`, because the adapter tests the computed `contain` property (`dom.ts:311-325`) and `content-visibility` is a separate property that does not change it. So a skipped subtree under a plain element with no layout attribute and no clip is admitted by nobody.
- **N730** additionally cannot distinguish *why* nothing was bought: "`nowrap` made min-content equal the whole token" and "there was simply nothing to remove" produce identical geometry. The rule's claim is the tautology — the strategy was spent and the element is the same size — which is sound, and the diagnosis is the reader's.

---

## Ideas worth stealing from the rules that are right

1. **`competing-primaries.ts:23-28` — the strongest design decision in the set, and it is a negative one.** "WHY IT CANNOT PRODUCE A FALSE FAILURE. It reads no geometry at all… a rule that measures nothing is structurally immune to that entire class." Three of the sixteen rules are immune by construction. When a claim can be made from declarations, making it from declarations is not a weaker rule, it is an unfalsifiable-by-this-class rule.
2. **`contrast.ts:142-186` is the pattern for every threshold read**, and it should be the template rather than the exception: `raw()`, an explicit parse, an explicit refusal of both the empty string **and** an explicit zero ("a floor no ratio can fail is not a check"), and thirty lines arguing why the fallback to the standard's constant is refused. Every future floor read in this package should be a copy of those five lines.
3. **`Report.undecidable()` stamping the asking rule's code into an N680** means one admission channel and no rule inventing its own way to shrug. It is what makes the obligations table above *checkable at all* — you can count admissions per rule.
4. **Enumerating what is exempt rather than testing the negation** (`crushed.ts` `EXEMPT_CONTAINMENT`, `multicolumn.ts` `BLOCK_CONTAINER`) is the general defence against the whole silent-pass family: an unknown value must fail **into** the check. N713's discriminator is the one place the discipline was not applied.
5. **Rule headers that record deleted inferences.** N670's removed container-level test and N690's reverted selector widening are both recorded as *attempts with evidence*, which is what stopped this sweep from re-adding either. It is the only mechanism in the repository that has demonstrably prevented a recurrence rather than merely predicted one.

---

## Where the evidence says this project is wrong

1. **The ADR's statement of the recurring class is too narrow, and the narrow statement is what let it recur.** Framing it as "wrong geometry" produced a fix — the type split — that is correct and closes exactly that instance. The mechanism (hand-applied cross-cutting obligations) was untouched, and it produced three more instances in the same slice, one of them in a rule whose header names the mechanism.
2. **"A type stopped it" is half true and is being over-claimed.** The `Box`/`Bounds` split stopped confusion *between those two types*. N690 kept measuring an element for a text claim afterwards, using only `Box`, and no type could object. What actually closes a category is a type only when the category is a type distinction; for the obligations it is a **constructor**, not a type.
3. **The namespace guard is cited as protection it does not provide.** `namespace.test.ts` correctly describes N650's silent-pass hazard and then guards a different proposition — that the name exists in `theme/`. A guard whose prose describes a failure mode it cannot reach is worse than no guard, because it reads as coverage. This is the same "reads as coverage" defect the codebase already names twice, about the `overlay` entry that sat in two tables while being provably unreachable.
4. **Sixteen rules, not fifteen.** Repeated in commit messages, the ADR and reports. Worth fixing because the count is load-bearing in the ten-defects-to-six framing.

---

## Open questions

1. **Where do the three obligations live?** `rule()` growing a measuring variant, or `Lens.painted()` returning obligations with its nodes. This is a change to the package's own seam and wants its own decision record.
2. **Can `measurable()` be made unforgettable rather than checked?** If `painted()` returned both the measurable nodes and the count it dropped, the admission could be emitted by the composition and a rule could not omit it. That may be the whole fix.
3. **N713's engine-capability problem.** Is a once-per-run "this engine does not resolve multicol properties, so N713 is inoperable here" admission worth a new mechanism? It generalises to every property-gated selector.
4. **Should N690's selector now be widened to control labels?** The blocker is removed and the recorded defect it would catch is real and measured. It needs one browser measurement, not an argument.
5. **Does N640 need the escaped exemption?** It is the only non-geometric rule with a genuine `E` gap, and contrast inside an escaped subtree is arguably still worth reporting to the reader even though the guarantee was forfeited. This is a product decision, not a correctness one.
6. **N670's "last painted child".** Cheap to compute, needs a fixture, and would close the last accessor-adjacent unsoundness in the set.

---

## Verification

- `pnpm --filter @nisli/intent test` — **fifteen files, two hundred and four tests, all passing.** Baseline before this round was one hundred and seventy-six; `InjectionHarness` added sixteen and this sweep added twelve.
- `pnpm --filter @nisli/intent typecheck` — clean.
- **Both fixes were confirmed to fail first.** Against the shipped rules, six of the twelve new fixtures failed: two N650 (silent pass on an unresolvable floor, silent pass on a `calc()` floor) and four N690 (false failure on a padded box, false failure on a stretched box, N680 where a verdict was available, false failure on a node whose words belong to a descendant).
- No file under `experiments/c11-appearance/` or `packages/www/` was touched.

---

## Sources

All primary, all in this repository at the commit this file was written against.

- `packages/intent/src/contracts.ts` — `Box` 154-158, `Bounds` 213-220 and the type-split argument 160-211, `Containment` 250, `Metrics` 302-349, `Inspector.measurable()` 432-470, `Inspector.lines()` 475-517 including the N690 prediction at 500-515.
- `packages/intent/src/diagnostics/observe.ts` — the `painted()`/`declared()` split 10-32, `px()` versus `raw()` 78-88, the `px()` implementation 125.
- `packages/intent/src/diagnostics/rule.ts` — `Report.undecidable()` 38-45 and its N680 stamping 75-83.
- `packages/intent/src/diagnostics/dom.ts` — `lineCount()` 79-116, `text()` 227-229, `rendered()` 235-256, `measurable()` 258-274, `box()` 276-282, `bounds()` 284-305, `containment()` 311-326.
- All sixteen rule files in `packages/intent/src/diagnostics/rules/`, read in full. Load-bearing headers: `hit-target.ts` (the two recorded defects and now the third), `crushed.ts` `EXEMPT_CONTAINMENT`, `overlap.ts` (the deleted container inference), `shredded.ts` (the reverted widening), `directional-overflow.ts:91-95` (the fix-not-applied-to-the-sibling class), `clipped-loss.ts` (four blindnesses, four edges), `multicolumn.ts` (a column box is not an element), `reflowed.ts` (why a line count and not a height), `competing-primaries.ts:23-28` (immunity by measuring nothing), `contrast.ts:142-186` (the threshold-read template).
- `packages/intent/src/diagnostics/codes.ts` — the registry and its append-only rules.
- `packages/intent/src/namespace.test.ts:29-58` — the N650 hazard in prose, and the guard that does not reach it. `:316` — the assertion it makes instead.
- `packages/intent/src/testing.ts` — `lines` default 421-433, `bounds` default 716-733.
- `packages/intent/theme/tokens.css:51,191,197` — `--intent-min-target` declared as a plain length, zero in pointer, a length in touch. `theme/roles.css` — every other value in the table derived through `calc()` from the inherited unit. `theme/states.css:49-52` — the truncate strategy. `theme/structure.css:575` — the one `contain: inline-size` site.
- `packages/intent/src/diagnostics/measurement-truth.test.ts:1-20` — the three measured false-PASS shapes this package exists to close.
- Peer findings, corroborating and independently reached: `InjectionHarness` on N690's derivation and its three mechanisms; `OracleTheory` on N650 and N713 as the class an injection harness built on fakes is structurally weakest against, and on the three-valued violation/pass/incomplete precedent.
