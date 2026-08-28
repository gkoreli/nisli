# 0033. Oracle Soundness — How the Checker Earns the Right to Be Believed

**Date**: 2026-08-26
**Status**: Proposed
**Depends on**: [0032-derived-appearance-package](./0032-derived-appearance-package.md)
**Evidence**: [`docs/worklists/nextgen/ORACLE/`](../worklists/nextgen/ORACLE/) —
prior art on checker self-verification, the test-oracle literature, an accessor
sweep of all sixteen rules, and a systematic injection harness

## Context

ADR 0032 bet that appearance derived from declared meaning is **checkable**, and
that the check is the differentiator. That bet has a dependency nobody stated:
the checker has to be right. This ADR is about the one number that measures
whether it is, and about the fact that number was being reported in a way that
flattered the project.

### Correction, on evidence, to two claims this ADR made in its first draft

**It is sixteen rules, not fifteen.** Sixteen ship
(N601/610/620/621/630/640/650/660/670/690/700/710/713/715/730/740); N680 is
registered with no rule by design, because it is how any rule admits it could
not decide.

**And the oracle taxonomy claim was wrong.** The first draft asserted that these
rules are *derived* oracles over a *specified* substrate, and called that an
unusually favourable position. They are not. In Barr, Harman, McMinn, Shahbaz
and Yoo's survey a **derived** oracle needs a second artefact to differ
against — another implementation, another execution, another version — and a
rule like N670 has none: it fires on one rendering of one document. What it
actually relies on is *"general, implicit knowledge"* that overlapping siblings
are nearly always wrong. That is the **implicit** oracle, the survey's third
category, and it is the weakest of the three.

This matters because it changes what can be claimed. An implicit oracle cannot
be argued into soundness from its substrate; its only evidence is that it fires
on defects somebody manufactured on purpose. So the injection harness in §3 is
not a nice-to-have that raises confidence — **it is the only evidence this
checker can ever have**, and every guarantee in ADR 0032 rests on it.

The precedent is exact and it is a warning. **ReDeCheck** (ISSTA 2017) is a
published responsive-layout checker detecting element collision, element
protrusion, viewport protrusion, small-range layouts and incongruous wrapping —
five of these sixteen rules under different names, over the same DOM geometry.
Its authors' own closing appraisal: *"Our appraisal of the prototype tool does
not include the possibility of false negatives: We do not know if, for the pages
studied, ReDeCheck missed failures."* They had no way to manufacture a known
defect and confirm the rule caught it. That is the argument for §3, made by the
people best placed to make it, as an admission rather than a proposal.

### The number, and why the framing was wrong

Across the prototype's development and the package's port, **ten defects were
found in the checker against six in the pages it checks.**

That was repeatedly described in commit messages as "the honest cost signal" —
as though a defect count were a virtue because it was disclosed. It is not a
virtue, and the phrase was doing rhetorical work. Decomposed by root cause, the
ten are not ten problems:

| root cause | count | instances |
|---|---|---|
| **the rule measured a geometry that does not answer its claim** | **6** | F4 (unrendered nodes as 0×0); F8 (container overflow cannot see a child crush); N670 v1 (container measurement for a child-collision claim); N650 (padding box against a hit-target floor); N690 (padded height divided by a line height); the N690 widening (control box treated as a text box) |
| instrument error | 2 | a self-test whose injection silently failed and was reported as the check being blind; a stale build paired with fresh CSS, producing a retracted measurement |
| dead reference | 1 | N700's selector naming a vocabulary word that does not exist |
| inverted inference | 1 | N670's first version firing on the opposite condition to its own defect |

**Six of ten are one bug in six costumes.**

### The part that indicts the method

After N650 cost 710 false findings, the principle was written into a comment: *a
check must measure the box its claim is about.* It was a good sentence, placed
where the next author would read it.

**N690 then made the identical mistake, in the rule written to prevent it.** The
comment was strengthened. **Widening N690 made it a third time**, firing on a
clean forty-four-pixel icon button because a control's box is a hit target whose
slack is the floor doing its job.

Three recurrences of a documented principle. What stopped it was not a better
comment:

- `Box` and `Bounds` became **separate types** — padding box for containment
  claims, border box plus origin for pressability and extent claims — so
  confusing them is a compile error rather than a judgement call.
- `lines()` was added so a claim about text measures **text** (line boxes over
  direct text children) rather than an element's height divided by something.
- `Lens.painted()` became the **only** route to geometry, so measuring an
  unpainted node is unreachable rather than discouraged.

The lesson is narrow and unflattering: **documentation did not enforce the
principle; a type did.** The correct reading of this project's history is not
"we are honest about our bugs" but "we should have reached for the type system
two bugs earlier."

### What the ratio actually measures

Not code quality. **Instrument coverage.** Ten were found because ten
instruments were built; a project with no instruments reports zero and ships all
of them. Stated that way the number is unfalsifiable — which is the property
this repository criticises in other people's claims, and it should not survive
in its own.

Two numbers were available and were not reported, and they are falsifiable:

- **Who caught it.** F4 and F8 were caught by a human noticing that a screenshot
  looked wrong. N700, the N690 widening, N715, the failed boxless injection and
  the retracted measurement were all caught by machines within minutes — and
  three of those by guards built in direct response to an earlier bug in the
  same family.
- **How long it lived.** F8 reported `settled` on visibly overlapping buttons
  for a full working session. N715 lived under an hour. The retraction was
  caught by a peer before it reached a commit message.

Those two trends are the argument. "Ten versus six" is not.

### The hole this exposes

All six geometry defects were found **because somebody happened to look**. The
fifteen shipped rules have never been systematically swept for the class. The
type-level fixes make the mistake harder to write, not impossible — `lines()` is
a third accessor, and **nothing yet asserts that a rule uses the accessor its
claim requires.**

## Decision

### 1. The tally is retired as a metric

"N oracle bugs against M page bugs" stops appearing in commit messages, READMEs
and reports. It invites a reading it cannot support — fifteen rules with ten
historical defects says nothing about whether rule sixteen is sound — and its
denominator is arbitrary.

**Replaced by two recorded properties per defect**: whether a machine or a human
caught it, and how long it lived between introduction and detection. Both are
checkable against the git history, and both get worse if the project gets
sloppier, which is what a metric is for.

### 2. A claim's geometry is a type obligation, not a comment

The accessors are distinct because the claims are distinct, and the distinction
is enforced where it cannot be ignored:

| accessor | answers | claim family |
|---|---|---|
| `box()` | padding box, plus what the content wanted | containment |
| `bounds()` | border box plus origin | pressability, visual extent |
| `lines()` | line-box count over direct text children | text reflow |
| `containment()` | `visible \| scroll \| clip`, including paint containment | clipping |
| `measurable()` | whether measurement is possible at all | precondition |
| `colour()` / `backdrop()` | resolved sRGB | contrast |
| `raw()` vs `px()` | preserves versus coerces "unresolvable" | any threshold read |

No new accessor is added without stating, in its type comment, what question it
answers **and what question it does not**. This is the mechanism that ended the
three-time recurrence and it is the mechanism the project relies on going
forward.

### 3. Detection is systematic, not opportunistic

For every defect class the rule set claims to detect, a harness injects that
defect and asserts the corresponding rule fires; then injects nothing and
asserts silence. Requirements, each derived from a recorded failure:

- **The matrix is derived from the registry**, not hand-written. Two duplicated
  hard-coded lists that agreed with each other already produced a vacuous green
  in this repository — a new page made both say false, the test passed, and the
  feature shipped dead. A new rule with no injection is a **failure**, not a
  silence.
- **"Could not inject" and "could not detect" are different results.** Conflating
  them is exactly how a self-test reported a working check as blind. The harness
  must distinguish them and say which — and it must assert the injected
  condition actually holds before asserting the rule fires. LAVA's answer to
  this hazard is that seeded bugs are *"always triggerable"* because they sit on
  a known-feasible path; two assertions, two failure messages.
- **Non-vacuity is printed, and NO RATIO IS COMPUTED.** Classes injected and
  rules exercised, by name. Not a score. Google's mutation-testing deployment —
  more than 24,000 developers, more than 1,000 projects, 14,730,562 mutants over
  six years — deliberately does not compute the mutant-detection ratio, because
  *"it is neither concrete nor actionable, and it does not guide testing."* This
  ADR retires one flattering metric in §1 and must not accept another in §3.
- **Suppression, not generation.** One injection per defect class, aimed at a
  node the rule can reach. The same deployment found developers initially
  classified **85% of reported mutants as unproductive**, and suppression — only
  changed and covered lines, at most one mutant per line, over a hundred curated
  exclusion rules — took that to **11%**. A harness that emits many
  uninteresting injections gets muted, and muting is this project's
  most-recorded failure mode.
- **It runs without a browser**, on the fake `Inspector`, so it is a gate rather
  than a nightly job.
- **The shape to copy is the boring one.** `axe-core` — a rule-based DOM checker
  sharing this architecture almost line for line, at 67.9 million downloads a
  week — ships 86 per-rule fixtures asserting 2,262 individual node verdicts.
  ReDeCheck, with the better theoretical fit to this problem, has 17 stars and
  last saw a commit in 2023. A folder of fixtures with expected verdicts is what
  survives contact with users.

### 4. A rule earns build authority by proving it can fail

Restated from ADR 0032 §5 and now enforced rather than intended: a rule may
break a build only once it ships a fixture demonstrating it catches its own
defect. A rule whose only fixture is the clean document has never been observed
to fire and is decoration.

### 5. A check that cannot measure says so

`Report.undecidable()` emits N680 with the asking rule named. The alternative —
a silent `continue` — is how three of the four silent oracle bugs happened, and
`px()` coercing an absent custom property to zero is its sharpest form, because
a floor of zero turns a rule into a rule that always passes.

Independently arrived at, and worth noting as convergent evidence: `axe-core`
ships an `incomplete` result class for the same reason.

### 6. Instrument disagreement is a failure, not a choice

When two instruments measuring the same defect disagree, the project reports the
disagreement rather than the more convenient number. This is already
implemented: the SSG proof refuses a verdict when geometry saw a displacement
the pixel differ did not classify as a wrong frame, on the stated grounds that
*either the watched region is mis-aimed or the defect was never on screen, and
both are reasons not to believe the pixel number.*

It has already paid: three independent measurements of one collision disagreed,
and the disagreement located a stale-build error rather than a CSS defect.

## Invariants

1. No claim about geometry is made through an accessor that answers a different
   question.
2. Every rule ships a fixture proving it fires and one proving it is silent on a
   clean document.
3. Every registered code has an injection in the harness, or the harness fails.
4. A rule that cannot decide reports `undecidable`; it never returns silently.
5. A threshold read from a custom property uses `raw()`, never `px()`.
6. Instrument disagreement is reported as a failure.
7. Diagnostic codes are append-only.

## Consequences

**Positive.** The product's central claim — the framework can tell you your UI
is wrong — acquires a defensible basis, which it did not have while the
checker's own defect history was being reported as a virtue. The three-time
recurrence becomes the argument for a mechanism rather than an embarrassment to
be disclosed. And the falsifiable metrics get worse if the project gets sloppier,
which the retired one did not.

**Risks, owned.**

- **The accessor/claim pairing is still not machine-checked.** §2 is a type
  obligation and a review discipline, not a guard. Nothing asserts that N650
  reads `bounds()` rather than `box()`. Given that documentation failed three
  times, a discipline should be assumed to fail too; the honest position is that
  this invariant is currently the weakest one here.
- **A harness that over-reports gets muted**, and muting is this project's
  most-recorded failure mode. Mutation-testing practice at scale reports that
  what made it viable was suppressing uninteresting mutants rather than
  generating more, and that finding applies directly.
- **Fifteen rules with ten historical defects may still contain undiscovered
  ones.** The sweep in §3 reduces that risk; it does not close it. Nothing here
  licenses the claim that the current rules are sound — only that the next
  defect should be found by a machine, quickly.
- **The newest rules have had the least exposure.** N700, N710, N713, N715,
  N730 and N740 all shipped within one working session.

## References

- [0032](./0032-derived-appearance-package.md) §5 — earned build authority, and
  the oracle-bug table this ADR decomposes.
- [`docs/worklists/nextgen/ORACLE/`](../worklists/nextgen/ORACLE/) — the
  supporting research and sweeps.
- [`experiments/c11-appearance/README.md`](https://github.com/gkoreli/nisli/tree/0a6dfed/experiments/c11-appearance/README.md)
  — the measured record, findings F4 and F8 through F13, and the four
  self-testing proof scripts.
