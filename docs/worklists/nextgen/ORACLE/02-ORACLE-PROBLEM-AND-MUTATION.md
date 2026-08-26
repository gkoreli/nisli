# The oracle problem and mutation — how do you test a thing whose job is to detect defects?

**Date**: 2026-08-26 · **Kind**: prior-art evidence, captured verbatim
**Slice**: The methodology for verifying a checker. Whether there is a systematic alternative to *waiting until somebody notices* — and what each candidate costs.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) · siblings [`01-CHECKER-SELF-VERIFICATION.md`](./01-CHECKER-SELF-VERIFICATION.md), [`03-ACCESSOR-SWEEP.md`](./03-ACCESSOR-SWEEP.md), [`04-INJECTION-HARNESS.md`](./04-INJECTION-HARNESS.md)

> **Count correction, verified rather than assumed.** The brief and the experiment README both say *fifteen* rules. `packages/intent/src/diagnostics/rules/index.ts` exports **sixteen** — N601, N610, N620, N621, N630, N640, N650, N660, N670, N690, N700, N710, N713, N715, N730, N740 — against **seventeen** registry entries, the seventeenth being N680, which is registered with no rule by design because it is how a rule declines. AccessorSweep reached the same count independently. This file uses sixteen throughout.

---

## Verdict in five bullets

1. **The brief's own hypothesis is wrong, and the person best placed to know says so in print.** The premise handed to this file was that `@nisli/intent`'s rules are *derived* oracles over a *specified* substrate — an unusually favourable position. They are not. In Barr, Harman, McMinn, Shahbaz and Yoo's taxonomy a **derived** oracle needs a second artefact to differ against — another implementation, another execution, another version — and a rule like N670 has none: it fires on one rendering of one document. What it actually relies on is *"general, implicit knowledge"* that overlapping siblings are nearly always wrong. That is the **implicit** oracle, category three. This is not interpretation: Phil McMinn, third author of that survey, went on to build the closest possible analogue of this project — ReDeCheck, a responsive-layout failure checker — and classified it in its own conclusion as leveraging *"implicit oracle information"*, citing the survey. The consequence is load-bearing, because the survey states the limitation of the category flatly: **"implicit oracles can only determine the presence of limited categories of bugs"**, and **"Behaviours abnormal for one system in one context may be normal for that system in a different context."** That second sentence, published in 2015, *is* the N690-widening defect — a slack box is abnormal for a paragraph and normal for a control, because the target floor is doing its job. The taxonomy predicted this project's most expensive recurring bug class eleven years before it recurred for the third time.
2. **The one published checker that does what this one does could not measure its own recall, and admitted it.** ReDeCheck (ISSTA 2017) detects element collision, element protrusion, viewport protrusion, small-range layouts and incongruous wrapping — five of our sixteen rules, by different names, over the same DOM geometry. Its authors' closing appraisal: *"Our appraisal of the prototype tool does not include the possibility of false negatives: We do not know if, for the pages studied, ReDeCheck missed failures."* They had no way to manufacture a known defect and confirm the rule caught it. **That is the entire argument for the injection harness in one sentence, made by the people best placed to make it, as an admission rather than a proposal.** Injection is not a decoration on an already-trusted checker; it is the *only* construction that yields ground truth about recall, because it is the only one where you know what is wrong before you look.
3. **The strongest industrial deployment of mutation testing deleted the mutation score, and that is the finding that should decide our design.** Petrovic, Ivankovic, Fraser and Just report Google's system across more than 24,000 developers and more than 1,000 projects, 14,730,562 mutants over six years — and they do not compute the mutant-detection ratio, because *"it is neither concrete nor actionable, and it does not guide testing."* What made it viable was not generation but **suppression**: mutating only changed, covered lines; at most one mutant per line; and more than one hundred hand-curated *arid node* rules. Developers initially classified **85% of reported mutants as unproductive**; suppression took that to **11%**. The number that survives is a *per-mutant* one and it earns its keep: mutants were coupled to **70% of 1,502 high-priority bugs**, meaning mutation testing would have reported a live mutant on the bug-introducing change. Read across: a harness that reports one hand-authored injection per diagnostic code, and refuses to enumerate variants, is not a compromise — it is the shape the largest deployment on earth converged on after six years of developer feedback.
4. **Adoption splits the field cleanly, and not in favour of the clever things.** `@stryker-mutator/core` does **2,275,120 downloads/week**; `axe-core` — a rule-based DOM checker sharing this project's architecture almost line for line — does **67,916,706/week** and ships **86 per-rule HTML fixtures asserting 2,262 individual node verdicts**. Against that: `redecheck/redecheck`, the only academic responsive-layout checker with published effectiveness results, has **17 stars** and last saw a commit in 2023; its companion `viser` has **1 star**. The technique with the best fit to our problem has the worst distribution in the survey; the technique with the least theoretical pedigree — a folder of fixture pages with expected verdicts — is running in tens of millions of installs. **Steal axe-core's packaging and ReDeCheck's ideas, never the reverse.**
5. **This project already invented the technique and stopped one level short of it.** Every proof script in `experiments/c11-appearance/proof/` takes `--self-test`, and the README's headline is *"every path is verified capable of failing before the run is trusted"* — that is fault seeding, correctly implemented, for ten assertion paths. It has already paid: the most expensive recorded defect was **a failed injection**, where a top-layer element's blockification defeated the `overlay/boxless` fixture and *"the harness reported the check as blind when the truth was that the injection had failed."* The literature's answer to precisely that hazard is LAVA's guarantee that seeded bugs are *"always triggerable"* because they sit on a known-feasible path, and Bug-Injector's rule of seeding only where *"the dynamic state satisfies a bug template's preconditions."* So the recommendation is not *adopt mutation testing*. It is: **generalise the `--self-test` you already trust from ten assertion paths to all sixteen rules, and make each injection assert its own precondition.**

---

## Systems and techniques surveyed

| system / technique | what it does | adoption (verified 2026-08-26) | status | relevance here |
|---|---|---|---|---|
| **Barr et al., *The Oracle Problem in Software Testing: A Survey*** (IEEE TSE 41(5), 2015) | The taxonomy: specified · derived · implicit · no-oracle (human) | 1,063+ citations; the field's reference point | canonical | Tells us what kind of oracle each rule is, and what that kind cannot do. |
| **ReDeCheck** (Walsh, Kapfhammer, McMinn — ISSTA 2017) | Cross-checks a page's layout against *itself* across many viewport widths; five responsive-layout failure types, four algorithms | **17★**, last push 2023-03-28; no npm or Maven distribution | **dead as a product, alive as evidence** | The single closest prior art. Same failure vocabulary, same DOM geometry, published true/false/non-observable counts. |
| **VISER** (Althomali, Kapfhammer, McMinn — ICST 2019) | A second, independent, *pixel-based* verifier of ReDeCheck's DOM-based reports; opacity manipulation plus image diff | **1★**, last push 2019-04-17 | dead as a product | Differential testing of a checker by a checker. **Found real defects in ReDeCheck.** Median **0.795 s** per report. |
| **axe-core** (Deque) | 105 rules over the rendered DOM; four verdicts: violation / pass / **incomplete** / inapplicable | **67,916,706 dl/wk**; open-sourced 2015 | alive, industrial, dominant | Our architecture at scale. Its `incomplete` is our `undecidable()`; its rendered-content-only rule is our `painted()`. |
| **axe-core rule integration tests** | One HTML fixture plus one JSON expectation per rule; per-node expected verdict | 86 fixture directories, **97 JSON files, 2,262 node assertions** (740 violation, 1,368 pass, 144 incomplete) | alive | **The injection harness, shipped, at rule-set scale.** Read this before writing ours. |
| **Google Mutation Testing Service** (Petrovic, Ivankovic, Fraser, Just — ICSE-SEIP 2018; TSE 2021; ICSE 2021) | Diff-based mutation during code review; arid-node suppression; one mutant per line; targeted operator selection | **24,000+ developers, 1,000+ projects**, 14.7M mutants over six years, 10 languages | alive, industrial | The economics. Suppression, not generation. **No mutation score computed at all.** |
| **Stryker / StrykerJS** | Mutation testing for JS/TS with an HTML mutation report | **2,275,120 dl/wk** (`@stryker-mutator/core`); 3,050★; pushed 2026-08-26 | alive, mainstream | The only mutation tool in our language with mass adoption. Mutates *our source*, not our subject. |
| **PIT / pitest** | The mature JVM mutation engine; coverage-driven test selection | 1,851★, pushed 2026-08-25, 320 open issues | alive, the reference implementation | Named by Google as sharing their coverage-driven test-selection design. |
| **mutmut** | Python mutation testing | `boxed/mutmut` 1,406★, pushed 2026-08-17; PyPI 3.7.0 | alive, niche | Third ecosystem; nothing structurally new. |
| **cargo-mutants** | Rust mutation testing | 1,273★; **512,679 all-time / 190,025 recent** crates.io downloads; pushed 2026-08-23 | alive, niche | Youngest of the four; same design, same cost problem. |
| **Metamorphic testing** (Chen, Cheung, Yiu — HKUST-CS98-01, 1998; Segura, Fraser, Sánchez, Ruiz-Cortés — IEEE TSE 42, 2016) | Relations that must hold *between* executions, without knowing either answer | Publication growth 1998–2015 fits a quadratic with R² = 0.997 | alive in research; thin in tooling | Directly applicable: same declaration at two widths, same component in two containers, a document and its mirror. |
| **Csmith** (Yang, Chen, Eide, Regehr — PLDI 2011, award paper) | Random C program generation plus differential execution across compilers | **1,231★**, pushed 2026-03-02; **325+ previously unknown compiler bugs** in three years | alive, legendary | The reference result for differential testing. Every compiler tested crashed *and* silently miscompiled valid input. |
| **SQLite's test architecture** | **Four independently developed test harnesses**; SLT runs 7.2M queries against PostgreSQL, MySQL, SQL Server and Oracle and demands agreement | **590× more test code than library code** (92,053.1 KSLOC against 155.8 KSLOC) | alive, the extreme case | Differential testing done properly — plus a published, honest verdict on the cost. |
| **SQLite's mutation testing** | Flips each branch instruction in generated assembly; asserts the suite notices | in-tree, in use | alive | Hit the equivalent-mutant wall and solved it with **source comments that suppress the checker**. That is the annotation debt we would inherit. |
| **Hypothesis** | Property-based and stateful testing; generates inputs and shrinks failures | **8,912★**; **11,812,038 PyPI dl/wk**; pushed 2026-08-25 | alive, mainstream | The mass-adopted form of "assert a relation, not an answer". |
| **fast-check** | Property-based testing for JS/TS | **35,918,716 dl/wk** | alive, mainstream | Same idea, our language. The delivery vehicle if we want metamorphic relations as properties. |
| **jsfunfuzz / funfuzz** (Mozilla) | JS engine fuzzing with differential comparison | `MozillaSecurity/funfuzz` 643★, **last push 2023-02-10** | moribund | Historically enormous yield; the repo is now quiet. Adoption warning for bespoke fuzzers. |
| **LAVA** (Dolan-Gavitt et al., IEEE S&P 2016) | Automated injection of memory-corruption bugs at points on known-feasible paths | research; heavily cited, heavily criticised | superseded | Precedent for *guaranteed-triggerable* injections — and for how injections go wrong. |
| **Bug-Injector** | Template-based injection at trace points where the template's precondition is *dynamically observed* to hold | research | alive as an idea | The exact mechanism our failed `overlay/boxless` fixture needed. |
| **NIST Juliet Test Suite** | 81,000+ synthetic programs, 181 CWEs, each flawed case shipped **beside a near-identical non-flawed twin** | the standard static-analyser benchmark | alive | The discriminative-pair design. Silence on a clean twin is evidence only if the twin differs in one property. |
| **X-PERT / WebDiff** (Choudhary, Prasad, Orso) | Differential rendering across browsers; alignment-graph comparison | research | superseded | Differential testing of *layout* — with a reference browser as the oracle. We have no reference. |
| **Cornipickle** (Hallé et al.) | Declarative layout constraints specified by the tester, checked at runtime | research | alive as an idea | The *specified*-oracle branch for layout. Our declaration guard is the same move. |

---
## 1. The oracle problem, and where this project actually sits

### 1.1 The taxonomy, verbatim

Barr, Harman, McMinn, Shahbaz and Yoo open by naming the problem we have:

> "Given an input for a system, the challenge of distinguishing the corresponding desired, correct behaviour from potentially incorrect behavior is called the 'test oracle problem'. Test oracle automation is important to remove a current bottleneck that inhibits greater overall test automation. **Without test oracle automation, the human has to determine whether observed behaviour is correct.**"
> — *The Oracle Problem in Software Testing: A Survey*, IEEE TSE 41(5), 2015, abstract

The four categories:

> "These four categories comprise approaches to the oracle problem where: test oracles can be **specified** (Section 4); test oracles can be **derived** (Section 5); test oracles can be built from **implicit** information (Section 6); and **no automatable oracle is available**, yet it is still possible to reduce human effort (Section 7)."

And the definitions that decide our classification:

> **Derived.** "A derived test oracle distinguishes a system's correct from incorrect behavior based on information derived from various artefacts (e.g. documentation, system executions) or properties of the system under test, **or other versions of it**."
>
> **Pseudo-oracle** (the strongest derived form). "A pseudo-oracle is an alternative version of the program produced independently, e.g. by a different programming team or written in an entirely different programming language."
>
> **Metamorphic relation.** "For the SUT p that implements the function f, a metamorphic relation is a relation over applications of f that we expect to hold across multiple executions of p."
>
> **Implicit.** "An implicit test oracle is one that relies on general, implicit knowledge to distinguish between a system's correct and incorrect behaviour. This generally true implicit knowledge includes such facts as 'buffer overflows and segfaults are nearly always errors'. **The critical aspect of an implicit test oracle is that it requires neither domain knowledge nor a formal specification to implement, and it applies to nearly all programs.**"

The survey also gives us the vocabulary to be precise about what a rule can be wrong about. Against a conceptual ground-truth oracle `G`:

> "**Definition 2.7 (Soundness).** The test oracle D is sound iff D(a) ⇒ G(a)."
> "**Definition 2.8 (Completeness).** The test oracle D is complete iff …"

A rule that reports a defect that is not one is **unsound** — a false failure, F4's ten of them. A rule that stays quiet on a real defect is **incomplete** — a false pass, N700 shipping dead and reporting a clean page. **The project has recorded both classes, and has systematically measured neither.**

### 1.2 Mapping the sixteen rules onto the four categories, honestly

| our mechanism | Barr category | why | what the category costs us |
|---|---|---|---|
| N601 escape hatch, N610 vocabulary, N700 competing primaries — the `declared()` rules | **specified** | The vocabulary is a closed, written specification; a value outside it is a specification violation, decidable without rendering | Cheapest and safest tier. These cannot be wrong about geometry because they never read any. |
| The declaration guard (`proof/declaration-guard.mjs`) | **specified** | The resolution table *is* the specification; the guard checks the table against itself | The one place we hold a genuine specified oracle over layout — the same move as Cornipickle, which asks the tester to specify layout constraints |
| N620, N621, N630, N650, N660, N670, N690, N710, N713, N715, N730, N740 — every geometric rule | **implicit** | Each encodes "this configuration is nearly always wrong", judged from a single rendering with no reference | **This is the whole exposure.** Limited bug categories; context-dependent correctness; and no way to know what was missed |
| N640 contrast | **implicit**, with a declared floor | The floor comes from the table (specified), the comparison is implicit | The best-behaved rule in the set, and the sweep independently names it the reference implementation — because it splits the specified part out and refuses to guess the rest |
| N680 `undecidable()` | **the fourth category, handled** | The rule declines and hands the case to a human | Barr's Section 7 is about reducing human oracle cost, not eliminating it. `undecidable()` is a correct, principled implementation of category four |
| The `--self-test` flag on the four proof scripts | **fault seeding** (not an oracle at all — an oracle *verifier*) | Injects a known defect, asserts the path notices | Already built. Covers ten assertion paths, zero of the sixteen rules |
| The 240-cell matrix | **not an oracle** | It is a *corpus*, and one on which every rule currently reports clean | A corpus with no known defects cannot distinguish a working checker from a dead one — which is exactly how N700 shipped |

**The uncomfortable reading of that table.** Twelve of the sixteen shipped rules sit in the category the survey warns is the weakest, and the project's only defence so far has been that somebody happened to look. Meanwhile the two techniques that would move rules *up* the taxonomy — metamorphic relations (up to derived) and a second independent measurement (up to pseudo-oracle) — are both absent, and both are cheap here for reasons set out below.

### 1.3 The one place the brief was right

CSS layout *is* a specified substrate, and that matters, but not in the way the brief hoped. It does not make our rules derived; it makes some of them **promotable**. A claim like "content wider than its content box overflows" is not implicit knowledge — it is written in CSS Overflow. A rule that cites the specification clause it enforces has moved from category three to category one, and the survey's warning about context-dependence stops applying, because the spec says what the context is. **N690 is the proof by counter-example: there is no specification clause saying "an element taller than one line height contains a broken word", which is why the rule could be wrong three times. There is a specification concept of a line box, which is why `lines()` fixed it.** The accessor sweep reached the same conclusion from the other end, independently.

---

## 2. Mutation testing — the direct answer, inverted, and its economics

### 2.1 It is not inverted

The brief frames the proposal as "mutation testing, here inverted: inject a defect into a rendered document and assert the corresponding rule fires." That framing understates the case. In mutation analysis the mutated artefact is the **program under test** and the thing being scored is the **test suite**. Here the rendered document *is* the program under test and the rule set *is* the suite. Nothing is inverted; the roles were simply mislabelled. The specialised name for doing this to evaluate an *analyser* rather than a suite is **fault seeding** or **bug injection**, and the artefact it produces is a **bug benchmark**. Its canonical instances are NIST's Juliet Test Suite, LAVA, and Bug-Injector.

Google's definition, which is the one to use:

> "Mutation analysis assesses a test suite's adequacy by measuring its ability to detect small artificial faults, systematically seeded into the tested program. Mutation analysis is considered one of the strongest test-adequacy criteria."
> — *Practical Mutation Testing at Scale: A view from Google*, IEEE TSE 2021, abstract

### 2.2 What made it economically viable, which is the only part that transfers

Google's system exists because the naive form does not work:

> "Faced with the two major challenges in deploying mutation testing — the computational costs of mutation analysis and the fact that **most mutants are unproductive** — we have developed a mutation testing approach that is scalable and usable, based on three central ideas: (1) … *performs mutation testing on code changes* … (2) … *transitive mutant suppression* … (3) … *probabilistic, targeted mutant selection*."

The number that should govern our harness:

> "even when applying sampling techniques to substantially reduce the number of mutants, **developers at Google initially classified 85% of reported mutants as unproductive**. An *unproductive* mutant is either trivially equivalent to the original program or it is detectable, but adding a test for it would not improve the test suite."

and the payoff of suppression:

> "The feedback of more than 20,000 developers on thousands of mutants over six years enabled us to develop heuristics for mutant suppression that **reduce the ratio of unproductive mutants from 85% to 11%**."

They accumulated **more than one hundred arid-node rules** and **fuzzy name suppression rules for more than 200 function families**, and they cap reporting hard:

> "We limit the number of reported mutants to at most 7 times the number of total files in a changelist. This ensures that the cognitive overhead of understanding all reported mutants is not too high, **which might otherwise cause developers to stop using mutation testing**."

**That last clause is this project's most-recorded failure mode named by somebody else.** A harness that emits thousands of uninteresting injections gets muted; a harness that emits one hand-authored injection per code cannot.

### 2.3 Does it reduce escaped defects? The only direct evidence, and it is good

Petrovic et al.'s ICSE 2021 paper is the study the brief asked for, and it answers three separate questions with three separate effect sizes:

- **Quantity.** Spearman's ρ between exposure to mutants and changed test hunks is **0.9 (p < 0.001)** for the mutant dataset. The coverage control group shows a *weak negative* correlation, **ρ = −0.24**. Median test hunks added during review: **1 for mutation, 0 for coverage.**
- **Quality.** Mutant survivability falls as exposure rises, **ρ = −0.50 (p < 0.001)**, and reviewers' "please fix" request rate falls, **ρ = −0.34**. Tests written for mutants improve the suite beyond the mutant they were written for.
- **Escaped defects.** On 1,502 retained high-priority bugs, involving almost 400,000 mutants and **over 33 million test target executions**: *"We found that for 1043 (70%) of the bugs, mutation testing would have reported a fault-coupled mutant in the bug-introducing change. Recall that each bug-introducing change was covered by the existing tests, suggesting that **code coverage had exhausted its usefulness**."*

That last parenthesis is the important one for us: coverage was already satisfied and the bug still shipped. Our analogue of coverage is *the 240-cell matrix reporting clean*, and it has the same property.

The paper is also honest about the ceiling. Of 50 manually inspected non-coupled bugs, 23 had **no applicable mutation operator at all**:

> "we observed a number of non-coupled bugs for which no obvious mutation operator exists. Examples include very subtle, yet valid changes to configurations or environments … **In other words, mutation testing is effective in guiding testing to assess whether an algorithm is correctly implemented but not whether the correct algorithm is implemented.**"

Translated: an injection harness can prove that N670 detects the collision N670 is written to detect. It cannot tell you that N670 was written to detect the wrong thing. **The rule that fired on the opposite condition to its own defect would have passed an injection harness built from the same wrong assumption** — precisely as N700's unit tests passed *"because the fixtures were invented from the same wrong assumption."* This is the harness's hard boundary and it must be stated in its own header.

### 2.4 The equivalent-mutant problem, and SQLite's answer

Equivalent mutants — syntactically different, semantically identical, unkillable by construction — are the reason mutation testing has stayed niche for forty years. Program equivalence is undecidable, so they cannot be detected in general; reported incidence runs **between ten and forty percent** of generated mutants. Their effect on the metric is corrosive: they make the score unreliable, because a surviving mutant might be a testing gap or might be nothing at all.

SQLite's implementation shows exactly what the tax looks like in a real codebase. Its mutation script rewrites branch instructions in generated assembly and asserts the suite notices — and immediately hits the wall:

> "Unfortunately, SQLite contains many branch instructions that help the code run faster without changing the output. **Such branches generate false-positives during mutation testing.**"

Their example is a hash function whose branch, when forced, makes it return a constant. The hash still *works*; the table degenerates to a linked list; the answers stay correct. The fix:

> "To work around this problem, comments of the form `/*OPTIMIZATION-IF-TRUE*/` and `/*OPTIMIZATION-IF-FALSE*/` are inserted into the SQLite source code to tell the mutation testing script to ignore some branch instructions."

**Suppression annotations in the source of the thing being checked.** That is Google's arid nodes, hand-rolled, in a codebase famous for rigour. It is the cost line item nobody puts in the proposal, and it is the reason a harness with a fixed, hand-authored injection per code is strictly cheaper than a generative one: there is nothing to suppress, because nothing was generated.

### 2.5 Killed for the wrong reason

The subtlest trap, and the one InjectionHarness asked about directly. A mutant killed by an uncaught exception or a timeout tells you far less than one killed by an assertion:

> "A mutated program can cause a test failure due to many different reasons, such as assertion violation, uncaught exception, or timeout — all normally marked as a kill. … **different kill reasons may have varying degrees of importance; assertion violations imply that test oracles capture correct program behavior, while uncaught exceptions and timeouts may only show coincidental impacts of the mutation.**"

The mitigation is called **kill-reason filtering**, and restricting to assertion-kills measurably outperforms counting all kills. The related hazard is the **trivial mutant**: *"one that is detected due to an exception by every test case that executes the mutated code location."*

Our version of a coincidental kill is a rule that fires on the injected document for a reason other than the injected defect — the exact shape of N670's first version, which *"fired when children escaped an overflowing row (where nothing collides) and was silent … when children were crushed to fit (the actual collision)."* A code-only assertion would have passed it. Three cheap mechanisms close it, and all three come from the literature rather than from us:

1. **Differential firing.** Score the *set difference* between the clean run's findings and the injected run's, never the injected run alone.
2. **Identity-matched kill.** Require the new finding to carry the owning code *and name the injected subject*. Right code on the wrong subject must fail the harness as loudly as silence does.
3. **Discriminative pairs.** Juliet's structural trick: every flawed case ships beside a near-identical non-flawed twin, *"most include similar, but non-flawed, code to test tool discrimination."* The twin must differ in the single perturbed property only, or silence-on-clean is evidence about the fixture rather than about the rule.

### 2.6 The tooling, and why none of it does our job

`@stryker-mutator/core` at **2,275,120 downloads/week** is the mass-adopted mutation tool in our language, PIT is the mature JVM engine, `mutmut` and `cargo-mutants` cover Python and Rust. All four mutate **the source of the thing under test**. Pointed at `@nisli/intent` they would mutate the rules and ask whether our 176 unit tests notice — a real and useful question, and *not the question this project is asking*. The question here is whether the rules notice a defect in a **document**, and no off-the-shelf tool mutates documents. There is nothing to install; there is a harness to write, and the design to copy is axe-core's.

---

## 3. What axe-core already does, at sixty-eight million downloads a week

This is the most important entry in the file, because it is the boring mechanism with the adoption number, and it is *our architecture*.

**Same precondition, same reason.** axe-core's API documentation lists among its design benefits:

> "**Only checks rendered content to minimize false positives** (that includes visually-hidden content)"

That is `painted()`, stated as a false-positive-minimisation measure, in the most-installed accessibility engine on the web. Our F4 — ten false hit-target failures from measuring unrendered nodes — is the defect that sentence exists to prevent.

**Same admission of defeat.** axe returns four verdicts, and the third is ours:

> "`incomplete`: Also known as 'needs review,' these results were aborted and require further testing. **This can happen either because of technical restrictions to what the rule can test**, or because a JavaScript error occurred."

`Report.undecidable()` and N680 are `incomplete` with a different spelling. The design principle behind it is explicit in axe-core's README — *"It returns zero false positives (bugs notwithstanding)"* — bought by declining to answer roughly forty-three percent of WCAG criteria at all.

**And the harness we are about to build, already shipped.** From `test/integration/rules/README.md`:

> "Rule Integration tests take an HTML snippet file and runs an axe-core rule against it. The results for the run are then compared against the companion JSON file to ensure that every node returns as the expected result (passes, violation, incomplete, inapplicable). … The JSON file should have at least one of the `violations`, `passes`, or `incomplete` arrays. **Inapplicable results are not listed as the test will fail if any node is found in one of the 3 arrays that is not explicitly listed.**"

Measured in the repository at `develop`: **105 rules, 86 fixture directories, 97 JSON expectation files, 2,262 individual node assertions — 740 violation, 1,368 pass, 144 incomplete.** Four observations, each of which should change our harness:

1. **Passes outnumber violations nearly two to one.** The fixture's job is not mainly to prove the rule fires; it is to prove the rule *discriminates*. This is Juliet's good/bad pairing, arrived at independently by a commercial team.
2. **`incomplete` is a first-class expectation.** 144 assertions across 26 of the 86 fixtures pin nodes the rule must decline to judge. **The undecidable boundary is a frozen contract, not a gap.** This matters immediately: AccessorSweep's N650 fix makes a control with no declared target floor yield N680 rather than silence, and that new behaviour is exactly the kind of thing axe pins.
3. **The expectation is per node, by selector, not a count.** That is identity-matched killing, enforced by construction — the same discipline §2.5 derives from the mutation literature.
4. **An unlisted node in any of the three arrays fails the test.** Silence is not permitted to read as success. That is the direct structural answer to *"N700 shipped DEAD … Silence read as success."*

---
## 4. Metamorphic testing — and the fact that somebody already built ours

### 4.1 The idea, and the canonical reference

Chen, Cheung and Yiu, *Metamorphic Testing: A New Approach for Generating Next Test Cases*, Technical Report HKUST-CS98-01, HKUST, 1998, is the origin. The survey of record is Segura, Fraser, Sánchez and Ruiz-Cortés, *A survey on metamorphic testing*, IEEE TSE 42, 2016, pp. 805–824. The definition that matters:

> "A central element of metamorphic testing is a set of **metamorphic relations**, which are necessary properties of the target function or algorithm **in relation to multiple inputs and their expected outputs**."

You never need to know the right answer for any single input. You need to know how two answers must relate.

### 4.2 ReDeCheck is a metamorphic layout checker and nobody calls it that

This is the finding that should reorganise how the project thinks about width sweeps. ReDeCheck's mechanism, in its authors' words:

> "This paper presents an automated failure detection technique that **checks the consistency of a responsive page's layout across a range of viewport widths, obviating the need for an explicit oracle**."

and the relation itself, stated as a heuristic:

> "two web page elements may overlap because of an intended graphical effect, or, because they have 'collided' as horizontal screen space has decreased. Our approach differentiates the two by checking their layout behavior across consecutive viewport widths. **If the elements always overlap, the effect is likely intended** and/or easily noticed by a developer in a manual spotcheck. **If the elements overlap infrequently, however, a subtle RLF is likely to be occurring.**"

That is a metamorphic relation over the width axis, and it does something none of our sixteen rules can do: **it tells intent apart from accident.** A decorative overlap and a collision are geometrically identical in a single frame. They are trivially distinguishable across two frames. Our N670 currently has to guess, which is why its first version guessed backwards.

The same paper contains the taxonomy-relevant admission — this cross-width consistency check is filed by its authors under implicit oracles, citing Barr — and the related-work section that establishes we are not missing a shortcut:

> "One aspect that all prior methods have in common with each other is the modelling of a 'correct' or reference layout with a graph that is then compared to another graph for an alternative version of a page. … there is a reference layout that functions as an 'oracle' for the technique concerned. This is different from this paper's method that does not require an explicit 'oracle'."

X-PERT uses a reference *browser*. Alameer et al.'s layout graph uses a reference *language*. WebSee and FieryEye use a reference *image*. Cornipickle uses a *specification*. **We have none of the four, and the one technique that needs none of them is the cross-width relation.**

### 4.3 What it found, and what it cost

Effectiveness, on 26 randomly selected live production pages:

> "our approach can find failures in 16 web pages, detecting **33 distinct failures in total**."

Against the practice it replaces — manual spotchecking at the widths five popular tools recommend, plus twenty-one random widths:

> "66 to 81% of these failures were revealed by the tools … **The results also show that 19 to 34% of failures identified by our technique would be missed.** Even if all spotchecking tools were used, complemented by a degree of further random spotchecking, five of the distinct RLFs originally identified by our approach would not be found."

And the cost, which is where it gets uncomfortable. ReDeCheck produced **137 distinct viewport ranges** for 33 distinct real failures:

> "a developer would need to view a web page at no more than an average of **4.2 different viewport widths** to find each actual RLF."

Worse in the extreme case: on one subject, **147 small-range reports were all true positives and all corresponded to a single distinct failure** — a grid of icons generating one report per pair. A report-to-defect ratio of one hundred and forty-seven to one, from *true* positives. That is the "thousands of uninteresting injections get the tool muted" problem, arriving through the front door.

### 4.4 The relations available to us, ranked by what they can decide

| relation | statement | decides | precedent |
|---|---|---|---|
| **cross-width consistency** | The same declaration at two adjacent widths must not change containment relations discontinuously | *intent versus accident* — the thing no single frame can answer | ReDeCheck, published, evaluated, 33 real failures |
| **container substitution** | The same component in two containers of different inline size must produce the same *relations*, only different values | whether a rule's verdict depends on something it should not | F9's failure shape exactly: a track that shrank while the floor inside it did not |
| **density / input axis invariance** | Every relation asserted at one density must hold at all three; every one at pointer must hold at touch | whether a floor propagates through every derivation that bounds it | F9 states this as a rule already: *"a floor must propagate through every derivation that bounds it"* |
| **mirrored document** | A document and its writing-direction mirror must yield the same findings with start and end exchanged | whether a rule has silently baked in a physical direction | N715 is about start edges; the mirror is the natural falsifier |
| **content monotonicity** | Adding content to a box must never *reduce* the number of findings about it | whether a rule's inference is monotone where its claim is | the hostile-content corpus, which produced all five state-sweep defects |

The first three are close to free, and that is the decisive fact: **the 240-cell matrix already renders four pages across three densities, two input modes, two themes and five widths.** A cross-width or cross-density relation is a *new assertion over data the run already collects*. The mirror relation is a sixth axis and costs a second matrix pass.

### 4.5 The adversarial note on metamorphic testing

Its research volume is real — publication growth from 1998 to 2015 fits a quadratic with R² = 0.997 — and its tooling adoption is not. There is no metamorphic testing framework with numbers resembling `fast-check`'s **35,918,716 downloads/week** or Hypothesis's **11,812,038/week**. What *has* adoption is the generic property-based harness, into which metamorphic relations are one kind of property among many. **The lesson is packaging, not principle: ship the relations as ordinary tests in the existing gate, never as a new methodology with a name.**

---

## 5. Differential testing — the technique with the best record and the highest entry cost

### 5.1 Why it works

Barr's formalism gives the mechanism precisely: a **pseudo-oracle** accepts `f₁(x)o₁ f₂(x)o₂ : [f₁ ≠ f₂ ∧ o₁ = o₂]` — two independently produced implementations, same input, outputs required to agree. Disagreement is a defect in one of them, and you do not need to know which in order to know that one exists. The related N-version form generalises to k implementations with a majority vote.

The empirical record is the strongest in this entire file. Csmith:

> "we created Csmith, a randomized test-case generation tool, and spent three years using it to find compiler bugs. During this period **we reported more than 325 previously unknown bugs** to compiler developers. **Every compiler we tested was found to crash and also to silently generate wrong code when presented with valid input.**"

SQLite's SQL Logic Test harness is the same idea against four independent implementations of the same specification:

> "The SQL Logic Test or SLT test harness is used to run huge numbers of SQL statements against both SQLite and several other SQL database engines and **verify that they all get the same answers**. SLT currently compares SQLite against PostgreSQL, MySQL, Microsoft SQL Server, and Oracle 10g. SLT runs 7.2 million queries comprising 1.12GB of test data."

And SQLite's headline architectural decision is independence for its own sake: **"Four independently developed test harnesses"**, each *"designed, maintained, and managed separately from the others."* This is a project with **590 times as much test code as library code** treating independence, not volume, as the structural guarantee.

### 5.2 The precedent that is exactly ours: VISER

VISER is differential testing of a layout checker by a second, independent layout checker — DOM geometry against rendered pixels — and it is the single most transferable result in this file, because it did the thing we are proposing and reported what it found.

Mechanism: for each ReDeCheck report, drive the browser to the reported width, manipulate the opacity of the elements involved, snapshot each layer, and diff. Notably it manipulates opacity rather than removing elements, *"because removing elements can impact the layout of the remaining HTML elements on the page, thus potentially interfering with the classification"* — an injection-fidelity concern identical to our blockified `display: contents` failure.

**What it found in the checker.** Three separate defect sites, each reported as a bug in ReDeCheck rather than in VISER:

> "While running this experiment, VISER led us to the discovery of a **defect in REDECHECK**. For 35 viewport protrusion RLFs, REDECHECK incorrectly reported the upper bound of the viewport range for the failure."

> "The final three element protrusion RLFs were *misclassified* by REDECHECK. VISER found that these were FPs, since there was no protrusion at the DOM level. … We judge the root cause of this to be **a bug in REDECHECK's collection of DOM information when constructing the RLG**."

> "This was because REDECHECK did not report the most specific elements involved in the failure. … **This difference is really a bug in REDECHECK, rather than a problem with VISER.**"

A second independent measurement of the same claim found three classes of defect in the first, including a systematic one affecting thirty-five reports. **This project has already reproduced that result by accident** — three agents measured the same collision, two disagreed, and the disagreement located a stale build. VISER is what the systematic version looks like, and it is cheap to run: **median 0.795 s, mean 0.91 s per report**, excluding page load and resize.

### 5.3 What differential testing needs that we do not have

A second implementation. `Csmith` compares clang against gcc; SLT compares five database engines; VISER compares DOM geometry against pixels. Our sixteen rules all read the same `Inspector`, so running them twice proves nothing. Three candidate second implementations, in increasing order of honesty and cost:

1. **A second engine.** Run the matrix in Firefox and WebKit and require the findings to agree. The experiment README lists *"Chromium only. No Firefox or WebKit run."* under what it does not prove. Cost: one browser install per engine plus matrix time; yield: unknown, and genuinely might be zero if the rules only touch well-interoperable geometry.
2. **A second measurement of the same claim.** VISER's exact move: for each `bounds()`-based collision finding, take the pixel-level evidence. This is the only option that directly attacks our recorded defect class, because a padding-box-versus-border-box confusion is invisible to a second engine and glaring to a pixel diff.
3. **A second inference.** Two rules deriving the same claim from different accessors — the accidental version that already worked here. Cheapest to build, weakest guarantee, since the two inferences share the adapter.

---

## 6. The economics — what each costs, what it false-positives, and whether anyone ran it twice

Baselines from this repository, so the estimates are anchored: **sixteen shipped rules across 1,766 lines in `packages/intent/src/diagnostics/rules/`; seventeen registered codes; 176 tests behind `tsc`, no browser; the 240-cell geometry matrix at 40.6 s with the overlay pass adding 0.3 s; the state sweep at 100 cells in 3.4 s.**

| technique | cost per run | authoring cost | false-positive behaviour | evidence it survives a real team | verdict here |
|---|---|---|---|---|---|
| **Injection harness over fakes** (one injection per code) | Sub-second. It is roughly thirty-four executions of a sixteen-rule set over a small fake document, inside the existing no-browser gate that already runs 176 tests | One fixture per code, on axe-core's evidence perhaps twenty to forty lines each; **seventeen codes, not thousands** | **Structurally near-zero.** A hand-authored injection either fires the right rule on the right subject or the harness fails. There is no generation, therefore no equivalent mutants, therefore no suppression annotations | **Strongest in the file.** axe-core at 67,916,706 dl/wk ships 86 of these. Google's 24,000 developers / 1,000 projects / 70% fault coupling. Stryker at 2,275,120 dl/wk | **Build it. Rank 1.** |
| **Metamorphic relations over the existing matrix** (width, density, container) | **Near zero marginal.** The matrix already renders those cells; the relation is a new assertion over collected data | One relation per axis, a handful of them | Moderate and known — ReDeCheck's own cost was 137 reported ranges for 33 real failures, and one case of 147 reports for one defect. Requires per-relation report conflation from day one | ReDeCheck: 33 real failures in 16 of 26 live production sites, beating manual spotchecking by 19–34%. But **17 stars** — the mechanism is proven, the packaging never shipped | **Build the width and density relations. Rank 2.** |
| **Metamorphic: mirrored document** | One additional matrix pass, so roughly +40 s | One axis in the harness plus a mirrored context | Low; the relation is exact rather than heuristic | none specific to layout mirroring found; the general MT record stands | **Rank 4.** Cheap, but no rule currently claims direction, so the yield is speculative. |
| **Differential: second measurement of the same claim** (VISER's move) | **0.795 s median per finding**, so at the current zero findings on 240 cells the cost is zero and scales only with defects — the right shape | Substantial: a pixel-evidence path the port does not expose today | Very low, and it *reduces* other techniques' false positives by construction — this is what VISER was built to do | VISER found three defect classes in ReDeCheck, including one affecting 35 reports. **1 star.** Nobody ran it twice | **Rank 3, and the highest-yield rank-3 in the file.** Right idea, real engineering, no adoption. |
| **Differential: second browser engine** | One full matrix per engine, so roughly +40 s each | Browser installs and CI capacity | Unknown; risks a stream of engine-difference noise that is not our defect | X-PERT and WebDiff are the research line; SQLite's SLT is the industrial proof at 7.2M queries against four engines | **Rank 5.** Do it for the product claim, not for oracle verification. |
| **Generative mutation over documents** (enumerate perturbations) | Unbounded by construction | Low to write, then unbounded to curate | **The known killer.** Ten to forty percent equivalent mutants; 85% unproductive before suppression; SQLite needed source-comment suppression annotations | Google made it work with 100+ arid rules, 200+ suppressed function families and a hard report cap. **That is the cost of admission** | **Do not build.** The suppression machinery costs more than sixteen hand-written fixtures. |
| **Stryker over `@nisli/intent`'s own source** | Minutes; a real mutation run over 1,766 lines | Near zero — it is a package install | Ordinary mutation-testing false positives, i.e. equivalent mutants against 176 tests | 2,275,120 dl/wk | **Optional, and a different question.** It scores our *unit tests*, not our *rules*. Worth one exploratory run; not worth a gate. |

### Recommendation, ranked by evidence rather than elegance

1. **The injection harness.** Best-evidenced, cheapest, fastest, and it is the only technique in the file that measures **recall** — the quantity ReDeCheck's authors said outright they could not measure. It is also the only one that would have caught N700, which shipped dead and passed every gate.
2. **Cross-width and cross-density metamorphic relations over the existing matrix.** Near-zero marginal cost against an already-paid-for corpus, published effectiveness on live sites, and the only technique that can distinguish *intended* overlap from *accidental* collision — the discrimination N670's first version got exactly backwards.
3. **A second, independent measurement of a geometric claim.** Highest yield per unit of prior art and the only technique that directly attacks the box-confusion defect class, but it requires a capability the port does not have. Defer until the first two are running.
4. **Mirror relation.** Cheap, speculative.
5. **Second engine.** Valuable for the product claim; weak as an oracle verifier.

**Do not build a generative mutation engine.** Every practitioner report in this file converges on the same conclusion: the cost is not in generating mutants, it is in suppressing them, and suppression is a permanent maintenance obligation on the *subject's* source.

---
## Ideas worth stealing

1. **The four-verdict result object, with `incomplete` as a pinned contract.** axe-core's `violation / pass / incomplete / inapplicable` is our `finding / silence / undecidable / no-match`, and their integration fixtures assert **144 expected-incomplete nodes across 26 of 86 rules**. We already have `undecidable()`; what we do not have is any test that pins *where* the boundary lies. Freeze it. AccessorSweep's N650 fix makes that immediately concrete: after it, a control with no declared target floor must yield N680, and that is a contract worth a fixture.
2. **"An unlisted node fails the test."** axe-core's fixtures fail if any node appears in a verdict array without being declared. This is the structural cure for *silence read as success* — the sentence the project wrote about N700 — and it costs nothing beyond writing the expectation as a set rather than a count.
3. **Passes outnumbering violations two to one.** 1,368 pass assertions against 740 violation assertions. The fixture's real job is discrimination, which is Juliet's *"similar, but non-flawed, code to test tool discrimination"*. Every injection needs a twin differing in exactly one property.
4. **Injection preconditions, dynamically observed.** Bug-Injector seeds only where a trace shows the template's precondition holding; LAVA guarantees seeded bugs sit on a known-feasible path. The `overlay/boxless` fixture failed because nothing asserted the injection took. Every injection must assert its own precondition, and *"could not build the defect"* must be a distinct outcome from *"rule is blind"*.
5. **Kill-reason filtering, adapted.** Score the *difference* between clean and injected findings; require the code **and** the subject to match. A right-code-wrong-subject kill is the N670-v1 shape and must fail loudly.
6. **Suppression before generation.** Google's economics in one line: one mutant per line, only on changed covered lines, over a hundred arid-node rules, at most seven reports per file. Our analogue: one hand-authored injection per code, and a standing refusal to enumerate variants.
7. **Report conflation from day one.** ReDeCheck's 147-reports-for-one-defect case and its 137-ranges-for-33-failures ratio are what happens without it. Their own framing is the useful one: the developer's cost is *"not a function of the number of reports produced … but instead the number of unique viewport ranges reported."* Whatever we report, report the *distinct situations*, not the pairs.
8. **The cross-width relation as the intent discriminator.** "Always overlapping" means intended; "overlapping infrequently" means broken. This is free information sitting in a matrix we already run, and it answers the one question a single frame structurally cannot.
9. **Independence as an architectural commitment, not a volume target.** SQLite's four harnesses are *"designed, maintained, and managed separately from the others."* The value came from independence; the 590× ratio is a consequence, not the goal.
10. **Opacity, not removal, when perturbing a document.** VISER manipulates opacity *"because removing elements can impact the layout of the remaining HTML elements on the page."* An injection that changes the layout it is measuring is not an injection.

---

## Where the prior art says we are wrong

### 1. We have the taxonomy backwards, and the correct classification is the weaker one

The brief proposed that our rules are derived oracles over a specified substrate. They are implicit oracles, by the definition and by the classification its own co-author applied to the nearest analogue. That is not a pedantic relabel; it imports two published limits. *"Implicit oracles can only determine the presence of limited categories of bugs."* And *"Behaviours abnormal for one system in one context may be normal for that system in a different context."* The second sentence describes, in advance and in general, the specific defect where widening N690 to control labels fired on a clean icon button. **We did not discover a novel confusion. We rediscovered a category limit that was documented in 2015.**

### 2. Documenting a principle failed here, and the literature says types are not sufficient either

The project's own record is unambiguous: the principle was written in a comment after N650, N690 repeated it, it was recorded again, widening N690 repeated it a third time, and only separating `Box` from `Bounds` stopped it. That is a real result and the file should keep it. But the accessor sweep has now found that `px()`'s `|| 0` coercion **reopens the same class through a different door**: an unresolvable custom property coerces to zero, and N650 reports a clean page forever. The types made the *box* confusion unrepresentable and left the *resolution* confusion wide open. **A type stopped one instance of the class, not the class.** The general answer in the literature is not a stronger type; it is Barr's own closing recommendation, which is that this is a measurement problem: *"Work has already begun on using test oracle as the measure of how well the program has been tested (a kind of test oracle coverage) … More work is needed. 'Oracle metrics' is a challenge to, and an opportunity for, the 'software metrics' community."* Which leads directly to the next point.

### 3. "Every code has an injection" is a coverage metric wearing a mutation-testing costume

This is the sharpest form of the "metrics that look like rigour" criticism, and it lands on the exact artefact this workstream is building.

Google built their entire system *because coverage lies in this specific way*:

> "Code coverage is also easily fooled, as it **only determines whether code has been executed, regardless of how well its behavior has been checked**."

and

> "Quantifying code quality based on code coverage alone leads to questionable estimates, whose general utility and actionability are a matter of controversy in the research community. Coverage-adequate test suites, which satisfy all test goals, are not the norm nor should they be. … **adequate thresholds for code coverage ratios are inherently arbitrary and a matter of much debate**."

An injection harness that reports "seventeen of seventeen codes have an injection and all seventeen fire" is a coverage number. It says each rule *can* fire in one hand-built world. It does not say the rule fires in the deployed one. **AccessorSweep has just handed us the proof by construction: N650's silent-forever failure and N713's vacuous silence are both cases where the rule's inference is fine and the accessor does not resolve.** An injection built on a fake inspector constructs a world where the property resolves, the rule fires, the harness goes green, and the deployed checker reports a clean page. The harness would have been *actively misleading*.

The mutation-score criticism proper says the same thing in its own vocabulary:

> "The majority of the mutants generated by existing mutation operators are equivalent, trivial, and redundant, which reduces the efficacy of the mutation score. **If a class has a high mutation score while most mutants generated are trivial and redundant, the high mutation score does not promise high test effectiveness.**"

and on the metric's basic unreliability:

> "The problem with equivalent mutants is that they make the final mutation score unreliable. That is, we do not know for sure if the live mutants remaining are actually killable or not."

**The strongest available evidence that the number is not worth having is that the largest, most successful, most carefully measured deployment of mutation testing in the world does not compute it.** Google reports individual mutants as concrete test goals during review and nothing else, because the ratio *"is neither concrete nor actionable, and it does not guide testing."* If we ship a percentage, we will have shipped the one artefact the field's best practitioners deliberately declined to ship.

**The consequence for this workstream, stated as a constraint rather than a worry:** the harness must report *which rule is blind*, never *what fraction of rules are sighted*. And it must be run against the real adapter as well as the fake, or it certifies the wrong world.

### 4. A geometry-based layout checker's reports are mostly not user-visible, and we have never been in the regime where that bites

ReDeCheck's manually classified results, as tabulated in the VISER paper: across element collision, element protrusion and viewport protrusion, **34 of 117 reports were human-observable true positives and 83 were non-observable issues** — geometric collisions and protrusions at the DOM level with no visible effect, because *"the extent to which elements had 'collided' was often significant in the DOM, due to high degrees of invisible padding in the page's CSS"*, and because protrusions were frequently hidden by declared clipping. Roughly seven in ten reports from a DOM-geometry layout checker are invisible to a human by construction.

Our checker currently reports zero findings on 240 cells, which means **it has never been in the regime where this tax applies.** A systematic sweep is likely to put us there, and the honest expectation is that the first broad run produces a large majority of true-but-invisible findings. The two published mitigations are: VISER's pixel-level confirmation pass, and ReDeCheck's own conflation of reports into distinct situations. Budget for both before the first sweep, not after.

### 5. The gold-plated method's own authors say it is not worth it for most projects

SQLite maintains 100% MC/DC coverage, four independent harnesses, and 590× more test code than library code — and publishes this verdict:

> "Maintaining 100% MC/DC is laborious and time-consuming. **The level of effort needed to maintain full-coverage testing is probably not cost effective for a typical application.** However, we think that full-coverage testing is justified for a very widely deployed infrastructure library like SQLite."

`@nisli/intent` is not a widely deployed infrastructure library. It is a sixteen-rule checker at version 0.0.0 with 1,766 lines of rules. The proportionate answer is the cheap technique with the best evidence, run in the existing gate — not a verification programme.

### 6. And the boundary nothing in this file crosses

Google, on the 23 of 50 non-coupled bugs with no applicable operator: *"mutation testing is effective in guiding testing to assess whether an algorithm is correctly implemented but not whether the correct algorithm is implemented."* An injection harness proves N670 detects what N670 was written to detect. **It cannot tell you N670 was written to detect the wrong thing** — which is exactly what N670's first version did, and exactly why N700's unit tests passed *"because the fixtures were invented from the same wrong assumption."* The harness's own header must say this. Nothing surveyed here closes it except a second, independent implementation, which is why differential testing keeps its rank-3 slot despite having no adoption at all.

---

## Open questions

1. **Does the harness run against the real adapter, or only the fake?** Fakes prove the inference; only a real engine proves the accessor resolves. Bug-Injector's dynamically-observed precondition is the design pattern, and running injections in Chromium as well as against `FakeInspector` is the concrete form. This is the single highest-value open decision in the workstream and it belongs to InjectionHarness.
2. **What is the expected non-observable rate for our sixteen rules on a corpus that contains real defects?** ReDeCheck's is roughly seven in ten. Ours is unmeasured because our corpus is clean. Until a sweep produces findings, every cost estimate in §6 for the metamorphic tier is a projection.
3. **Is there a second measurement of a geometric claim that does not cost a new port capability?** VISER's answer was pixels. Ours might be scroll extents, or the fit solver's own recorded shortfall, which is already measured for N620. Cheapest wins.
4. **Does the cross-width relation survive our declared collapse?** ReDeCheck's relation assumes layout changes are continuous in width. `data-collapse` makes them deliberately discontinuous. The relation may need to be stated over *declared* strategy transitions rather than raw widths — which would be a genuine improvement on the prior art, since our discontinuities are declared and theirs had to be inferred.
5. **What does the harness do about a code with no injectable defect?** Some codes may be structurally un-injectable through a fake. Google's answer to unproductive mutants was an explicit suppression rule with a stated reason; axe-core's is an unlisted node failing the test. The union — explicit declaration with a written reason, enforced exhaustively — is what InjectionHarness has already proposed, and it is right.
6. **`[UNVERIFIED]` — why did ReDeCheck and VISER die?** No maintainer post-mortem exists. Both are academic prototypes with no distribution, so the null hypothesis is simply that neither was ever packaged. But if there is an unrecorded reason a cross-width layout checker does not survive contact with a real codebase, it is the most valuable missing fact in this file.

---

## Sources

**Oracle theory**
- Barr, Harman, McMinn, Shahbaz, Yoo. *The Oracle Problem in Software Testing: A Survey.* IEEE TSE 41(5), May 2015. DOI 10.1109/TSE.2014.2372785. Open access: <https://coinse.github.io/publications/pdfs/Barr2015qd.pdf> · <https://discovery.ucl.ac.uk/1471263/>
- Chen, Cheung, Yiu. *Metamorphic Testing: A New Approach for Generating Next Test Cases.* Technical Report HKUST-CS98-01, HKUST, 1998.
- Segura, Fraser, Sánchez, Ruiz-Cortés. *A survey on metamorphic testing.* IEEE TSE 42, 2016, pp. 805–824.
- Segura, Towey, Zhou (eds). *Metamorphic Testing: A Review of Challenges and Opportunities.* ACM Computing Surveys 51(1), 2018. DOI 10.1145/3143561

**Layout checking — the direct prior art**
- Walsh, Kapfhammer, McMinn. *Automated Layout Failure Detection for Responsive Web Pages without an Explicit Oracle.* ISSTA 2017, pp. 192–202. DOI 10.1145/3092703.3092712. <https://eprints.whiterose.ac.uk/id/eprint/116989/10/c50-3.pdf>
- Althomali, Kapfhammer, McMinn. *Automatic Visual Verification of Layout Failures in Responsively Designed Web Pages.* ICST 2019. <https://philmcminn.com/publications/althomali2019.pdf>
- `redecheck/redecheck` — 17★, last push 2023-03-28. `redecheck/viser` — 1★, last push 2019-04-17.
- Choudhary, Prasad, Orso. *X-PERT: Accurate identification of cross-browser issues in web applications.* ICSE 2013; and *WEBDIFF*, ICSM 2010.
- Hallé et al. *Declarative layout constraints for testing web applications.* J. Logical and Algebraic Methods in Programming 85, 2016.

**Mutation testing at scale**
- Petrović, Ivanković. *State of Mutation Testing at Google.* ICSE-SEIP 2018. DOI 10.1145/3183519.3183521. <https://research.google.com/pubs/archive/46584.pdf>
- Petrovic, Ivankovic, Fraser, Just. *Practical Mutation Testing at Scale: A view from Google.* IEEE TSE 2021. DOI 10.1109/TSE.2021.3107634. <https://homes.cs.washington.edu/~rjust/publ/practical_mutation_testing_tse_2021.pdf>
- Petrovic, Ivankovic, Fraser, Just. *Does mutation testing improve testing practices?* ICSE 2021. <https://homes.cs.washington.edu/~rjust/publ/mutation_testing_practices_icse_2021.pdf>
- Just, Jalali, Inozemtseva, Ernst, Holmes, Fraser. *Are Mutants a Valid Substitute for Real Faults in Software Testing?* FSE 2014. <https://homes.cs.washington.edu/~mernst/pubs/mutation-effectiveness-fse2014.pdf>
- Kaufman, Just et al. *Prioritizing Mutants to Guide Mutation Testing.* ICSE 2022 — trivial mutants. <https://homes.cs.washington.edu/~rjust/publ/prioritizing_mutants_tcap_icse_2022.pdf>
- *Learning Test-Mutant Relationship for Accurate Fault Localisation* — kill-reason filtering. <https://arxiv.org/pdf/2306.02319>
- Chekam et al. / Vera-Pérez et al. *How to kill them all: … the impact of code observability on mutation testing.* JSS, 2021 — mutation-score criticism.
- *Mutation Analysis: Answering the Fuzzing Challenge* — equivalent-mutant incidence. <https://arxiv.org/pdf/2201.11303>

**Mutation tooling, quantified 2026-08-26**
- `@stryker-mutator/core` — 2,275,120 dl/wk; `stryker-mutator/stryker-js` 3,050★, pushed 2026-08-26.
- `hcoles/pitest` — 1,851★, pushed 2026-08-25, 320 open issues.
- `boxed/mutmut` — 1,406★, pushed 2026-08-17; PyPI 3.7.0.
- `sourcefrog/cargo-mutants` — 1,273★, pushed 2026-08-23; crates.io 512,679 all-time / 190,025 recent.

**Fault seeding and bug benchmarks**
- NIST. *The Juliet 1.1 C/C++ and Java Test Suite.* <https://www.nist.gov/publications/juliet-11-cc-and-java-test-suite>
- Dolan-Gavitt et al. *LAVA: Large-scale Automated Vulnerability Addition.* IEEE S&P 2016. <https://seclab.nu/static/publications/sp2016lava.pdf>
- Kashyap et al. *Automated Customized Bug-Benchmark Generation* (Bug-Injector). SCAM 2019. <https://arxiv.org/pdf/1901.02819>
- Bundt et al. *Evaluating Synthetic Bugs.* AsiaCCS 2022 — LAVA's known weaknesses. <https://arxiv.org/pdf/2208.11088>

**Differential testing**
- Yang, Chen, Eide, Regehr. *Finding and Understanding Bugs in C Compilers.* PLDI 2011, pp. 283–294 (award paper). DOI 10.1145/1993498.1993532. <https://users.cs.utah.edu/~regehr/papers/pldi11-preprint.pdf> · `csmith-project/csmith` 1,231★, pushed 2026-03-02.
- *How SQLite Is Tested.* <https://www.sqlite.org/testing.html> — four harnesses, SLT, mutation testing §7.6, full-coverage verdict §7.7.
- `MozillaSecurity/funfuzz` — 643★, last push 2023-02-10.

**Checker architecture with adoption**
- `dequelabs/axe-core` — 67,916,706 dl/wk; 105 rules. API docs: <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md> (rendered-content-only; `incomplete` definition). Integration-fixture contract: `test/integration/rules/README.md`. Measured at `develop` on 2026-08-26: 86 fixture directories, 97 JSON files, 2,262 node assertions (740 violation, 1,368 pass, 144 incomplete).
- `HypothesisWorks/hypothesis` — 8,912★, 11,812,038 PyPI dl/wk, pushed 2026-08-25. `fast-check` — 35,918,716 dl/wk.

**This repository**
- `packages/intent/src/contracts.ts` — `Box`, `Bounds`, `Inspector.lines()`, and the header comments recording the five-defect origin of the split.
- `packages/intent/src/diagnostics/observe.ts` — the `Lens`, `painted()`/`declared()`, and the `measurable()` note recording the `content-visibility` false PASS.
- `packages/intent/src/diagnostics/rule.ts` — `rule()` and `Report.undecidable()`; the header records that *"three of the four silent oracle bugs in the first run were a rule quietly returning nothing."*
- `packages/intent/src/diagnostics/rules/` — 15 files, 1,766 lines; `codes.ts` — 17 registered codes.
- `experiments/c11-appearance/README.md` — the measured record: F1–F13, the eight oracle bugs, the 240-cell matrix at 40.6 s, the state sweep at 100 cells in 3.4 s, and the four `--self-test` proof scripts. **Committed evidence; not modified.**
- AccessorSweep, sibling agent, 2026-08-26 — the sixteen-rule verdict table, and the N650 / N713 silent-pass findings cited in *Where the prior art says we are wrong* §3.
