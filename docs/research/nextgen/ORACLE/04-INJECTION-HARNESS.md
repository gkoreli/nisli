# The Injection Harness — what happens when you stop waiting for somebody to look

**Date**: 2026-08-26 · **Kind**: engineering artifact plus measured findings
**Slice**: A systematic fault-seeding sweep over `@nisli/intent`'s diagnostic rules: for every defect class the registry claims to detect, inject that defect and require the owning rule to say so; inject nothing and require silence.
**Ships**: [`packages/intent/src/diagnostics/fault-seeding.test.ts`](../../../../packages/intent/src/diagnostics/fault-seeding.test.ts) — 1,522 lines, 8 blocks, 19 tests, runs inside the normal suite in under 20 ms.
**Siblings**: [`01-CHECKER-SELF-VERIFICATION.md`](01-CHECKER-SELF-VERIFICATION.md) (how other linters verify themselves) · [`02-ORACLE-PROBLEM-AND-MUTATION.md`](02-ORACLE-PROBLEM-AND-MUTATION.md) (the methodology and its citations) · [`03-ACCESSOR-SWEEP.md`](03-ACCESSOR-SWEEP.md) (the per-rule accessor audit)

---

## Verdict in five bullets

1. **Nine of the sixteen shipped rules reported a CLEAN PAGE over a defect that was present in the document — N620, N621, N640, N650, N660, N670, N690, N730, N740 — and none of them does now.** Take the same seeded defect, put it inside content the browser skipped (`content-visibility: auto`), and on the first run only N710, N713 and N715 admitted they could not decide; three more (N601, N610, N700) were immune because their claims are declarative; the remaining nine went silent. That is the false-PASS direction, the one that gets a checker deleted, and it had never been measured across the rule set because a silent rule and a clean document are the same green. **What closed it was not nine hand-applied `measurable()` arms.** `StructuralObligations` made the measuring lens ROUTE rather than filter — unmeasurable content is dropped *and* admitted as N680 — so all twelve geometric rules now admit and the harness's table of known silences is empty. The finding and its repair are both recorded in the file, because the lesson is the recurring one: an obligation that lives in a comment gets omitted, an obligation that lives in the seam cannot be.
2. **N713 is vacuously silent over a whole document whenever `column-count` and `column-width` fail to resolve — proven, not suspected.** The discriminator maps an unresolvable value onto the same branch as "no multicolumn was requested" and `continue`s (`packages/intent/src/diagnostics/rules/multicolumn.ts:113-115`). Seeding the defect and then blanking `column-count` produces silence with the defect still in the document. This is the `px()`-coercion failure mode one level up: not a wrong number, a check that ran and examined nothing. The same axis shows N640 and N650 doing it correctly — both admit N680 when their floor stops resolving — so the correct pattern already exists in the file next door.
3. **The rule set contradicted its own registry about the escape hatch, and that split is now a decision instead of an accident.** N601's rule says an escaped subtree "forfeits the rhythm, fit, contrast and hit-target guarantees" (`packages/intent/src/diagnostics/rules/escaped.ts:26`). On the first run five rules implemented an exemption (N660, N670, N710, N713, N715) and nine reported inside the hatch anyway — including N640 and N650, the two the sentence names. Nobody had decided that; each rule had been written without the one beside it, which is the class N715's own header calls out. The same seam fixed it: the measuring lens drops an escaped subtree, so twelve geometric rules honour the hatch by construction and exactly two report inside it **on purpose** — N610 and N700, because a misspelt attribute and two actions both claiming priority are not geometry, and an escape buys the subtree its own styling rather than a licence to do either.
4. **The prior art says the harness is necessary and the scoring is not.** ReDeCheck (ISSTA 2017) detects five of these sixteen defect classes over the same DOM geometry and its authors close with an admission: *"Our appraisal of the prototype tool does not include the possibility of false negatives: We do not know if, for the pages studied, ReDeCheck missed failures."* They had no way to manufacture a known defect and confirm the check caught it. Meanwhile Google's mutation-testing deployment — 24,000+ developers, 14,730,562 mutants over six years — **deliberately does not compute a mutant-detection ratio**, because *"it is neither concrete nor actionable, and it does not guide testing."* So this harness names rules and refuses to score them; the printed line is codes, not a percentage.
5. **Seeding earned its keep on the first run, and what caught the defect was a discriminative twin — not a principle, and not the type split.** N690 still divided an element box (minus *declared* block padding) by a line height for a claim about text. Any box taller than its text for another reason — a stretched row child, a `min-block-size`, an inline-block in a taller line box — read as extra lines. That is the third recurrence of one mistake in one family, in the rule whose header records the second, and the `Box`/`Bounds` split could not stop it because **both readings are a `Box`**. I identified it by reading the rule and reproduced it as a decoy that fired; `AccessorSweep` reached it independently and migrated the rule to `lines()` (`packages/intent/src/diagnostics/rules/shredded.ts:142`). The quarantine entry is deleted and the decoy is now a hard gate.

---

## What shipped

One file, four axes over one seed table, plus two blocks that attack the harness itself.

| block | what it asserts | mechanism | first run | after the routing seam |
|---|---|---|---|---|
| **matrix from the registry** | every code in `CODES` has a seed or a stated reason; every shipped rule is claimed by a seed; no seed names an unregistered code | iterate `CODES` (`packages/intent/src/diagnostics/codes.ts:217`) and `DEFAULT_RULES()` (`runner.ts:42`), never a hand-written list | 17 codes, 17 seeds, 0 unseedable | unchanged |
| **axis 1 — the defect itself** | the owning rule fires on the seeded twin and is silent on the clean twin | differential firing + identity-matched kills + discriminative pairs + an independent witness | 17 classes seeded and witnessed; all 16 shipped rules exercised **by name**; 0 injection faults; 0 false failures on a clean twin; 0 unwhitelisted collateral | unchanged |
| **axis 2 — unmeasurable content** | a rule that cannot measure must **admit** (N680), never pass | same seeds, bearer subtree marked as the browser marks skipped content | admit: N710, N713, N715 · immune by declaration: N601, N610, N700 · **silent false pass: N620, N621, N640, N650, N660, N670, N690, N730, N740** · not about a node: N630 | **silent false pass: none.** admit: N620, N621, N640, N650, N660, N670, N690, N710, N713, N715, N730, N740 · immune by declaration: N601, N610, N640, N700 · not about a node: N630 |
| **axis 3 — the escape hatch** | the `[data-escaped]` exemption is applied consistently, or the split is recorded | same seeds, root node given `data-escaped` | exempt: N660, N670, N710, N713, N715 · report anyway: N610, N620, N621, N640, N650, N690, N700, N730, N740 · no single un-escaped subtree: N601, N630 | exempt: N620, N621, N640, N650, N660, N670, N690, N710, N713, N715, N730, N740 · **report anyway, deliberately: N610, N700** · no single un-escaped subtree: N601, N630 |
| **axis 4 — a dissolved declaration** | a property a rule reads must not be able to silence it | the seeded document with one declaration made unresolvable | N640 **admits** without `--intent-min-contrast` · N650 **admits** without `--intent-min-target` · **N713 PASSES without `column-count`** | unchanged — N713 left open on purpose, see below |
| **decoys** | a rule must be able to decline on the shape most likely to look like its defect | two clean look-alikes with witnesses proving them clean | N690 fired on a clean stretched label (quarantined) | 2 look-alikes, 0 unsound firings, quarantine empty |
| **falsification of the sweep** | removing a rule makes the report name it unexercised; restoring it makes the report quiet | `sweep(DEFAULT_RULES().filter(r => r.code !== 'N660'))` | reports N660 unexercised with 0 injection faults; silent again when restored | unchanged |
| **falsification of the harness** | the sweep names its OWN failure as its own, four ways | four deliberately broken seed tables | "nothing was injected" · "cannot discriminate" · "injection did not take" · "right code, wrong subject" | unchanged |

### The four mechanisms, and whose they are

Three of the four are the literature's, taken over my own design after `OracleTheory`'s research landed. Citations in [`02-ORACLE-PROBLEM-AND-MUTATION.md`](02-ORACLE-PROBLEM-AND-MUTATION.md).

1. **Differential firing.** A kill is scored on the *set difference* between the clean run and the seeded run. One seed depends on this outright: the N730 pair carries `data-fit="unsatisfiable"` in **both** twins, so N620 speaks in both and only the difference is about N730.
2. **Identity-matched kills.** A kill must carry the owning code **and** name the seeded subject. The recorded reason: the first N670 fired reliably, on the opposite condition to its own defect. A code-only assertion calls that a pass. Proven to fail here by a broken seed that names a node no rule ever mentions.
3. **Discriminative pairs (Juliet).** Each seed is one builder called twice, so clean and seeded differ only in the perturbed state. Silence on the clean twin is then evidence about the *rule*, not about a second fixture somebody wrote on a different day.
4. **An independent witness (LAVA / Bug-Injector).** Each seed states its defect a second time as a predicate over the document, in the vocabulary of the **claim** rather than of the rule, and it must be **false on the clean twin and true on the seeded one** before any rule runs. This is the mechanism that separates "I could not build the defect" from "the rule cannot see the defect" — the distinction that cost this project its most expensive recorded defect, where `overlay/boxless` stopped being injectable and the harness blamed the check.

Witnesses are deliberately written in the claim's own accessor: N650's witness reads `bounds()` because pressability is a border-box question; N660's reads `box()` because containment is a padding-box question; N690's reads `lines()` because a text claim is a text measurement; N710/N713/N715's compare rectangles. Where the standard is the standard, the witness restates it — the contrast witness is WCAG's relative-luminance ratio, computed independently, with the floor still read off the element so the theme keeps owning it.

---

## The seed matrix, as measured

One injection per class, aimed at a node the rule can reach. No generation, therefore nothing to suppress — which is the cheaper end of the trade Google's deployment documents (85% of generated mutants called unproductive; suppression took that to 11%).

| code | defect seeded | subject | perturbed state | verdict |
|---|---|---|---|---|
| N601 | a subtree declaring itself outside the resolution table | `panel` | presence of the escape declaration | fires |
| N610 | a declared value no rule resolves | `odd` | the value on the layout axis | fires |
| N620 | a container that promised to fit and gave up | `row` | the stamped fit state | fires |
| N621 | a truncated value clamped past meaning | `stamp` | inline space left to the timestamp | fires |
| N630 | a document wider than its window | `document` | the document width | fires |
| N640 | text below its context's contrast floor | `greeting` | the painted text colour | fires |
| N650 | a control below its context's target floor | `reply` | the control's inline extent | fires |
| N660 | an element given less inline space than its content needs | `label` | the space the content wants | fires |
| N670 | a row child painting into its neighbour | `first` | the first child's content width | fires (+N660, whitelisted) |
| N680 | a text colour the adapter cannot resolve | `derived` | whether the compositor returned a colour | fires, **reported by N640** |
| N690 | a single word broken inside itself | `shredded` | line boxes occupied, and the text height that follows | fires |
| N700 | two actions in one surface both claiming priority | `card` | the second action's emphasis | fires |
| N710 | a clipping box destroying content nobody called expendable | `strip` (bearer `chip`) | where the chip sits inline | fires |
| N713 | content lying outside its multicolumn container | `item` | where the item sits inline | fires |
| N715 | content painted above its container's block-start edge | `stray` | where the badge sits in the block axis | fires |
| N730 | a degradation spent that bought no space | `stamp` | whether truncation made it narrower | fires |
| N740 | text reflowed inside a container declared as a row | `sentence` | line boxes occupied, and the block extent that follows | fires |

**Rules NOT exercised: none.** **Rules that fired for a reason other than the injected defect: none.** One collateral finding is whitelisted at its seed: injecting N670's collision also wakes N660, because a crush and the collision it causes are one physical fact and the rule set says so itself (`packages/intent/src/diagnostics/rules/overlap.ts` hint, via `codes.ts:127`). Every other new finding in a seeded run fails the sweep.

**The one class no rule owns is still seeded.** N680 has no rule (by design — `codes.ts:129-136`), so its seed declares `by: 'N640'`: the injection is an unresolvable colour, and the kill is N640 admitting. That is the only place the harness separates "the code that must appear" from "the rule that must speak", and it is why the exercise report is scored against *declared owners* rather than against the array of rules passed in — a rule dropped from `DEFAULT_RULES` must appear in the report, not vanish from it.

---

## Ideas worth stealing (not yet done)

- **axe-core's closed-world assertion, at the run level.** Its integration README: *"Inapplicable results are not listed as the test will fail if any node is found in one of the 3 arrays that is not explicitly listed"* (see `01-CHECKER-SELF-VERIFICATION.md`). This harness has that per seed (unwhitelisted collateral fails) but not per document: a run over the shared clean fixture in `diagnostics.test.ts` still only asserts `toEqual([])`, which is the same thing by luck rather than by construction.
- **Machine-readable admission reasons.** axe-core's `target-size` returns `undefined` from five branches, each tagged (`contentOverflow`, `tooManyRects`, `partiallyObscured`, …). `Report.undecidable()` takes prose (`packages/intent/src/diagnostics/rule.ts:45`). Axis 2 and axis 4 both currently assert "some N680 arrived"; with reason keys they could assert **which** admission, which is the difference between "it admitted" and "it admitted for the right reason" — the same identity-matching this file already applies to findings.
- **A second, independent verifier (VISER's move).** VISER re-checked ReDeCheck's reports pixel-wise and *found real defects in ReDeCheck*. The analogue here is the browser-side proof scripts checking the fake's geometry claims, which exists for the adapter but not as a cross-check of these seeds.
- **Per-node expected verdicts, as data.** axe-core asserts 2,262 individual node verdicts across 86 fixture directories. This file asserts one subject per seed. Widening to "every node in the fixture, with its expected verdict" is the boring extension with the adoption number behind it.

---

## Where the prior art says we are wrong

- **A mutation score would be a regression, not a metric.** My first instinct was "16 of 16 rules exercised" — a ratio. Google's deployment refuses exactly that number, in print, and the reason applies verbatim: the only actionable fact in a percentage is *which* rule the remainder is. The printed output now names codes; the counts that remain exist to catch a harness that has quietly stopped injecting.
- **Documenting a principle does not prevent its recurrence, and neither did the type.** The `Box`/`Bounds` split turned one instance of the mistake into a compile error and N690 then made the same mistake with two `Box` readings. What caught it was a **discriminative fixture** — a clean look-alike with an independent witness. That is an argument for fixtures over doctrine, and it is the same conclusion the adoption numbers reach from the other end (axe-core's 86 fixture directories at ~67.9M downloads/week versus ReDeCheck's 17 stars).
- **"Derived oracle" was the wrong self-description.** Per `02`, a derived oracle needs a second artefact to differ against; these rules have none. This harness does not fix that — it does not give the rules an oracle, it gives the *rule set* one. Worth saying plainly so nobody reads the green suite as evidence that the rules are right about a browser.

---

## Findings, and what happened to them

Rules belong to `AccessorSweep`/`StructuralObligations` this round, so every finding here was reported rather than fixed. Each lives as a recorded table in the harness; each prints a `DELETE these repaired entries` line naming the code once it is closed, and the assertion polarity is subset — a **new** silence fails the file, a repaired one only asks to be deleted, so a sibling's fix never turns the sweep red. Three of the five were closed inside the round; the tables have been emptied and the history kept in the file headers.

1. **CLOSED — nine rules had no `measurable()` arm**: N620, N621, N640, N650, N660, N670, N690, N730, N740, against three siblings (N710, N713, N715) that did. `AccessorSweep` supplied the fact that kills the assumed escape route: `content-visibility` does not change the computed `contain` property, so a skipped subtree under a plain element is not a clipper and `containment()` never routes it to N710. `StructuralObligations` then closed all nine at once by making `painted()` route rather than filter — unmeasurable is dropped *and* admitted as N680, and a rule opts into `measuringRule()` instead of restating the precondition. Axis 2 now reports no silent false pass.
2. **OPEN, deliberately — N713's discriminator makes unresolvable indistinguishable from absent** (`multicolumn.ts:113-115`), so the rule is vacuously silent document-wide in a port that under-resolves. Not fixed, and the reason is good: unlike N640's and N650's custom-property floors — which genuinely resolve to nothing on a document that ships no theme — the computed value of a standard longhand is always `auto` or an integer in a browser, so making this arm loud would emit N680 on every element of every fixture here, because the fake answers the empty string for every undeclared property. **The honest close is in the fake**: `FakeInspector` resolving standard longhands the way a browser does (`packages/intent/src/testing.ts`), which is nobody's file this round. Axis 4 keeps the row.
3. **CLOSED — the `[data-escaped]` split was accidental**: five rules exempted, nine reported, including the two N601's own text names. The same seam decided it once instead of nine times: the measuring lens drops an escaped subtree, so twelve geometric rules honour the hatch by construction, and N610 and N700 report inside it on purpose because their claims are not geometric.
4. **OPEN — a finding about the fake, as requested.** `FakeInspector.measurable()` is ancestor-aware while `rendered()` is per node (`packages/intent/src/testing.ts:680-693`). In a browser both are inherited by a skipped subtree, so a faithful fixture must spell `rendered: false` on **every** node and `measurable: false` once on the subtree root — which is what the recorded fixtures do (`measurement-truth.test.ts:148-176`) and what this harness's shroud transform does. A fixture that forgets the per-node `rendered` describes a document the browser cannot produce, and nothing catches it. Making `rendered()` inherited would delete that whole class of unfaithful fixture.
5. **OPEN — what the fake genuinely cannot model, named rather than implied.** It has no layout: it cannot *produce* an intra-word break, a column fragmentation or a reflow, only state the geometry that results. Every seed here is therefore a claim about geometry the browser is trusted to produce, and the browser-side proofs are what check that trust. No defect class turned out to be un-*statable*, which is why `UNSEEDABLE` is empty; the honest caveat is that "statable in the fake" is weaker than "producible in Chromium".

---

## Falsification record

Every claim above about the harness failing was observed, not designed.

| what was broken | what the harness said |
|---|---|
| N660 removed from the rule set | `N660: no rule in this set carries this code — the check is not running at all` (0 injection faults, 17 classes still injected) |
| N660 restored | `rules NOT exercised: none` |
| a seed whose builder ignores its `seeded` flag | `N660: the seeded document equals its twin — nothing was injected`, `injected: 0` |
| a seed whose clean twin also carries the defect | `N660: the CLEAN twin already carries … so the pair cannot discriminate — fix the fixture, not the rule` |
| a seed that perturbs block extent instead of inline space | `N660: injection did not take — … is absent from the seeded document, so this says NOTHING about the rule`, and **no** blindness reported against N660 |
| a seed whose subject is a node nobody names | `N660 fired but named label rather than nobody — right code, wrong subject` |
| axis 2 with N670 missing from the recorded table | failed with `expected [ 'N670' ] to deeply equal []` before N670 was recorded — i.e. the inventory assertion is live, not decorative |
| axis 3 with N610 missing from the recorded table | failed with `expected [ 'N610' ] to deeply equal []` |

Verification, run at the time of writing: this harness is **19 tests, all passing**, and `pnpm --filter @nisli/intent typecheck` is clean. The package as a whole reports **220 tests with 3 failures, all three inside `src/diagnostics/obligations.test.ts`** — `StructuralObligations`' own in-flight file, reported to them over `hub` and deliberately not touched here. Every other file is green, including all sixteen rules through this sweep, so the routing seam measures correct from this side. The package stood at 176 tests before this round. No root gates run, no rule edited, no file under `experiments/c11-appearance/**` touched.

---

## Open questions

- **Is silence inside `[data-escaped]` the right policy for a contrast or hit-target claim?** Now decided in the seam — geometric claims exempt the subtree — but decided by construction rather than by argument, and N601's own text is the only stated justification. The counter-argument stands: an escape hatch is about *derivation*, not about accessibility floors, and a checker that goes quiet over a third of a page because of one attribute is the muting failure mode arriving by invitation. The harness now pins whichever answer is in force, so the question can be reopened without the split drifting back.
- **~~Should a rule with no `measurable()` arm be a compile error rather than a table entry?~~ ANSWERED, inside the round, and the answer was yes.** The `Box`/`Bounds` lesson said the type is what stops recurrence; `StructuralObligations` applied it one level up, so a rule now opts into measuring and the lens owns the admission. Axis 2's table is empty as a result. What remains open is the smaller version: an admission carries prose, not a reason key, so the axis can assert that a rule admitted but not that it admitted for the right reason.
- **How many of these seventeen seeds survive a real browser?** Each is a claim about geometry Chromium is trusted to produce. The browser-side proofs cover the adapter; nothing yet re-runs *these* documents through it.
- **Reason keys for `undecidable()`?** Without them, axes 2 and 4 can only assert that an admission happened, not that it was the right admission.

---

## Sources

**Primary — this repository** (every path relative to the repo root):

- `packages/intent/src/diagnostics/fault-seeding.test.ts` — the harness (this artifact's subject).
- `packages/intent/src/diagnostics/codes.ts:217` — `CODES`, the append-only registry the matrix is derived from; `:129-136` — N680, the code with no rule; `:127` — N670's hint, the whitelisted N660 collateral.
- `packages/intent/src/diagnostics/runner.ts:42` — `DEFAULT_RULES()`, one rule per code.
- `packages/intent/src/diagnostics/rule.ts:45` — `Report.undecidable()`, prose-only.
- `packages/intent/src/diagnostics/observe.ts:107-110` — `painted()` versus `declared()`.
- `packages/intent/src/diagnostics/rules/multicolumn.ts:113-115` — the discriminator that maps unresolvable onto absent.
- `packages/intent/src/diagnostics/rules/crushed.ts:89-93` — the positively-enumerated exemption table, and its stated reason.
- `packages/intent/src/diagnostics/rules/escaped.ts:26` — "forfeits the rhythm, fit, contrast and hit-target guarantees".
- `packages/intent/src/diagnostics/rules/shredded.ts:142` — N690 after migration to `lines()`.
- `packages/intent/src/diagnostics/rules/hit-target.ts:116-127` — N650's `raw()` plus three-way split.
- `packages/intent/src/testing.ts:680-693` — `rendered()` per node, `measurable()` ancestor-aware.
- `packages/intent/src/diagnostics/measurement-truth.test.ts:148-176` — how a skipped subtree is spelled.

**Secondary — captured by sibling agents, cited here rather than re-verified** (`[UNVERIFIED HERE]`; each is quoted with its own primary source in the sibling artifact):

- ReDeCheck's false-negative admission, its five failure types, and its 17 stars / last commit 2023-03-28 — `02-ORACLE-PROBLEM-AND-MUTATION.md:14,26`.
- Google's mutation-testing deployment: 24,000+ developers, 1,000+ projects, 14,730,562 mutants, no mutation score computed, 85%→11% via suppression, 100+ arid-node rules — `02-ORACLE-PROBLEM-AND-MUTATION.md:15,30,124-127`.
- axe-core: 67,916,706 downloads/week, 86 fixture directories, 2,262 node assertions, the closed-world README sentence, `incomplete` with reason keys — `02-ORACLE-PROBLEM-AND-MUTATION.md:28-29,180-197` and `01-CHECKER-SELF-VERIFICATION.md:14,29,137-141`.
- NIST Juliet's discriminative twins (81,000+ programs, 181 CWEs) — `02-ORACLE-PROBLEM-AND-MUTATION.md:44`.
- LAVA's guaranteed-triggerable injections and Bug-Injector's dynamically-observed preconditions — `02-ORACLE-PROBLEM-AND-MUTATION.md:42-43`.
- VISER re-verifying ReDeCheck and finding real defects in it — `02-ORACLE-PROBLEM-AND-MUTATION.md:27`.
- Kill-reason filtering (assertion-kills outperform exception/timeout kills) and the trivial/equivalent-mutant hazards — `02-ORACLE-PROBLEM-AND-MUTATION.md:160-172`.
