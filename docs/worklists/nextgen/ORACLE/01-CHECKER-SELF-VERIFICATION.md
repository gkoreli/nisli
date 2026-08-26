# Checker self-verification — how shipping analyzers prove their own checks

**Date**: 2026-08-26 · **Kind**: prior-art evidence, captured from source
**Slice**: The mechanisms by which linters, static analyzers and accessibility checkers verify that their own rules are sound — falsification fixtures, undecidable result classes, snapshot discipline, and cross-rule structural constraints.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — the `@nisli/intent` oracle
**Siblings**: `02-ORACLE-PROBLEM-AND-MUTATION.md`, `03-ACCESSOR-SWEEP.md`, `04-INJECTION-HARNESS.md`

---

## Verdict in five bullets

1. **Nobody enforces that a rule can fire. Including ESLint — and I proved it by running ESLint's own `RuleTester`.** The single most-cited mechanism in this space, `RuleTester.run`, requires that `valid` and `invalid` are *arrays*, not that either is *non-empty*: `const hasInvalid = Array.isArray(test.invalid)` (eslint/eslint `lib/rule-tester/rule-tester.js:550`). Running the real class against a real rule with `invalid: []`, the suite passes and reports one passing valid case. Omitting `valid` entirely *is* rejected. The asymmetry runs the wrong way: ESLint refuses a rule you never showed a clean input to, and accepts a rule nobody has ever seen fire. The falsification fixture this project arrived at is therefore **not** "standardised across tens of thousands of rules" — the *format* is standardised, the *obligation* is convention plus review. That is the headline correction to the brief.
2. **Google deleted its geometric hit-target audit, and Deque ships the replacement turned off.** Lighthouse's changelog records that "*The `tap-targets` audit is no longer a priority for SEO and has been replaced with the `target-size` audit in accessibility*" (GoogleChrome/lighthouse `changelog.md:1143`); the audit file is gone from the tree at version thirteen point four point one. The replacement, axe-core's `target-size`, ships with `"enabled": false` (dequelabs/axe-core `lib/rules/target-size.json:5`). Deque's stated reason is WCAG adoption timing, not defect rate — "*These rules are disabled by default, until WCAG 2.2 is more widely adopted and required*" (`doc/rule-descriptions.md:89`) — but the churn is the signal: fifteen `target-size`/`target-offset` fix entries in axe's changelog, against seventy-eight for `color-contrast`. The two hardest rules in the world's most-deployed appearance checker are the two this project has. Ten defects in fifteen rules is **not** anomalous; it is the going rate.
3. **The undecidable class is not novel, and axe-core's version is strictly richer than ours.** `Report.undecidable()` (this repo, `packages/intent/src/diagnostics/rule.ts:45`) has one shape: subject plus prose detail. axe-core's `target-size` returns `undefined` from five branches, each tagged with a **machine-readable reason key** — `contentOverflow`, `tooManyRects`, `partiallyObscured`, `partiallyObscuredNonTabbable`, `default` (`lib/checks/mobile/target-size.json`) — and its contrast check maintains a whole `incompleteData` registry (`lib/checks/color/color-contrast-evaluate.js:127-146`). Lighthouse goes further and makes the class part of the audit *type*: `NOT_APPLICABLE`, `ERROR`, `INFORMATIVE`, `MANUAL` are enumerated scoring modes (`core/audits/audit.js:50-58`). Our N680 is the right idea in its weakest available form: a string where everyone else has an enum.
4. **What actually catches false positives everywhere is not a positive test, it is a closed-world negative assertion — and we do not have one.** clang-tidy runs FileCheck with `-implicit-check-not={{warning|error}}:` (llvm/llvm-project `clang-tools-extra/test/clang-tidy/check_clang_tidy.py:396`), so *any* diagnostic the fixture did not name fails the test. rustc's compiletest collects every unmatched diagnostic into `unexpected` and fails on it (rust-lang/rust `src/tools/compiletest/src/runtest.rs:734-760`). Biome bails on "*an unexpected diagnostic*" (biomejs/biome `xtask/rules_check/src/lib.rs:292-297`). axe's rule-integration README states it plainly: "*Inapplicable results are not listed as the test will fail if any node is found in one of the 3 arrays that is not explicitly listed*". Every one of these projects tests the *complement*. This is the cheapest, most-copied, most-proven mechanism in the survey and it is the one our fixtures are missing.
5. **On recurrence there is a real answer and it is split.** Type-level constraints across all rules **do** exist — Biome ties a rule's available evidence to its query type (`type Query: Queryable`, whose `Services` determine the analysis `Phase`; `crates/biome_analyze/src/rule.rs:1323-1339`, `crates/biome_analyze/src/query.rs:8-13`), and rustc's `EarlyLintPass`/`LateLintPass` split makes "this lint reads types" a compile-time fact. Lints-on-lints also exist and are boring and widely used: `eslint-plugin-eslint-plugin` at four hundred and twenty-five thousand downloads a week with forty-one rules, ESLint's own `tools/internal-rules`, and semgrep's self-hosted `unsatisfiable-rule` which statically detects a rule that can never match. **But nobody binds a specific measurement accessor to a specific claim.** No project in this survey has the domain analogue of `Box` versus `Bounds`. Full answer in [The recurrence question](#the-recurrence-question).

---

## Systems surveyed

| system | what it verifies about its own rules | adoption | negative case required? | undecidable class? |
|---|---|---|---|---|
| **ESLint `RuleTester`** (v10.9.1) | `valid`/`invalid` fixtures; message/messageId, location, suggestion and `output` assertions; AST-immutability; fix must reparse | npm **160,098,819/wk**; 27,484★ | **No** — `invalid: []` accepted (verified by running it) | No |
| **`eslint-plugin-eslint-plugin`** (v7.6.2) | forty-one lints *on rule source and on rule tests* | npm **425,797/wk**; 234★ | no such rule exists in the set | n/a |
| **`@typescript-eslint/eslint-plugin`** | same `RuleTester` contract, typed | npm **136,860,252/wk** | inherits ESLint's | No |
| **clang-tidy / `check_clang_tidy.py`** | `CHECK-MESSAGES`/`CHECK-FIXES`/`CHECK-NOTES` over `lit`+`FileCheck`; closed-world `-implicit-check-not`; zero-annotation file asserts zero diagnostics | llvm/llvm-project 39,951★, pushed 2026-08-26 | **No**, but `add_new_check.py` scaffolds a test file with every new check | No (options + inline suppression instead) |
| **rustc `ui` tests** | `.stderr` snapshot **plus** hand-written `//~ ERROR` annotations; unmatched-either-way is fatal | rust-lang/rust 116,176★ | n/a (whole suite is negative cases) | No |
| **axe-core** (v4.13.0) | per-rule HTML fixtures × JSON expectations for `passes`/`violations`/`incomplete`; unlisted nodes fail | npm **67,916,706/wk**; 7,446★ | **No** — README says "at least one of" the three arrays; **seventy-four of eighty-four** rule directories declare a violation case | **Yes** — `undefined` ⇒ *needs review*, with reason keys |
| **stylelint** (v17.14.1) + `jest-preset-stylelint` (v9.2.0) | `accept`/`reject` cases; `--fix` must not change accepted code; fixed code must differ and must relint clean | stylelint npm **11,124,156/wk**, 11,513★; preset npm **523,086/wk** | **No** — `setupTestCases` no-ops on an absent array; but **one hundred and fifty of one hundred and fifty** core rule test files declare `reject` | No |
| **Biome** (main) | rule doc code blocks are *executed*; `expect_diagnostic` must yield **exactly one**; blocks without it must yield **none**; plus `insta` spec snapshots | npm `@biomejs/biome` **13,959,709/wk**; 25,652★ | **No** — but **four hundred and thirty-four of four hundred and forty-two** JS rules carry a firing example; **one thousand nine hundred and thirty-three** `invalid*` spec fixtures | No |
| **semgrep** + `semgrep-rules` | `ruleid:`/`ok:` inline annotations; `semgrep test`; twenty-two self-hosted rule-lints incl. `unsatisfiable-rule` | semgrep/semgrep 16,406★; rules repo 1,234★ (npm shim only **3,465/wk**; distribution is pip/brew) | **No**, but **one thousand nine hundred and fifty-one of one thousand nine hundred and sixty-four** rule files have a companion test file (99.3%) | `todoruleid`/`todook` = known-failing, tracked not hidden |
| **Lighthouse** (v13.4.1) | audits carry `scoreDisplayMode`; smoke tests compare whole result shapes | npm **4,295,938/wk**; 30,701★ | No | **Yes** — `notApplicable`, `error`, `informative`, `manual` |
| **pa11y** | runs HTML_CodeSniffer and/or axe; `--threshold` tolerates N findings; `--level-cap-when-needs-review` demotes axe `incomplete` | npm **266,285/wk**; 4,490★ | n/a (aggregator) | Yes, imported from axe — and **demoted, not escalated** |
| **BackstopJS** | pixel diff with `misMatchThreshold` (default zero point one percent) and `requireSameDimensions` (default true) | npm **87,140/wk**; 7,176★; last push **2024-09-07** | n/a | No — threshold only |
| **Percy** | server-side re-render of captured DOM in controlled browsers | npm `@percy/cli` **505,372/wk** | n/a | No |
| **Chromatic** | `diffThreshold` default zero point zero six three in YIQ colour space; anti-aliased pixels detected and ignored by default | npm `chromatic` **8,991,295/wk** | n/a | No — threshold + anti-alias detection |

*Adoption figures: npm registry `downloads/point/last-week` and the GitHub API, both queried 2026-08-26.*

---

## What each one actually does

### 1. ESLint `RuleTester` — the format is universal, the obligation is not

The scenario validator is twenty lines and it is the whole story:

```js
function assertTest(test, ruleName) {
	assert.ok(
		test && typeof test === "object",
		"Test Scenarios for rule … : Could not find test scenario object",
	);

	const hasValid = Array.isArray(test.valid);
	const hasInvalid = Array.isArray(test.invalid);

	assert.ok(hasValid,   "… Could not find any valid test scenarios");
	assert.ok(hasInvalid, "… Could not find any invalid test scenarios");
}
```
— eslint/eslint `lib/rule-tester/rule-tester.js:543-561` (template placeholders in the real messages elided)

`Array.isArray([])` is true. I ran the shipped class against a rule that reports on a specific identifier:

```
EMPTY-INVALID: ACCEPTED
MISSING-VALID: REJECTED -> Test Scenarios for rule no-valid is invalid: Could not find any valid test scenarios
```
— executed against a clean checkout of eslint v10.9.1, 2026-08-26

Everything ESLint *does* enforce, it enforces once you are already inside an invalid case:

- **Non-empty errors.** `assert.ok(errors.length !== 0, "Invalid cases must have at least one error")` (`:416-419`), and for the numeric form `assert.ok(errors > 0, "Invalid cases must have 'error' value greater than 0")` (`:481-484`).
- **Exact count.** `assert.strictEqual(messages.length, item.errors.length, …)` (`:1471-1474`). Count strictness is not opt-in.
- **Fix accountability, both directions.** If a rule fixed the code and the test said nothing: *"The rule fixed the code. Please add 'output' property."* If `output` equals `code`: *"Test property 'output' matches 'code'. If no autofix is expected, then omit the 'output' property or set it to null."* (`:1870-1904`). And the fixed source is re-linted — a fix that produces a parse error fails with *"A fatal parsing error occurred in autofix."* (`:1320-1334`).
- **Suggestions are opt-out-proof.** *"Error at index N has suggestions. Please specify 'suggestions' property on the test error object."* (`:1625-1629`); each suggestion's `output` is *required* (`:1808-1814`), must differ from the input (`:1846-1850`), must reparse (`:1826-1839`), and suggestion messages must be unique within one error (`:1449-1453`).
- **The rule must not mutate the AST.** `assert.fail("Rule should not modify AST.")` (`:1357-1359`).
- **A restricted API surface, enforced at test time.** `const forbiddenMethods = ["applyInlineConfig", "applyLanguageOptions", "finalize"]` (`:147-152`); the tester monkey-patches `SourceCode.prototype` so a rule calling one of them throws (`:303-320`, `:1295-1301`). This is the closest thing in ESLint to a type-level accessor constraint, and it covers three lifecycle methods, not measurement.
- **Opt-in extra strictness, added later.** `assertionOptions: { requireMessage, requireLocation, requireData }` (`:1028-1035`) — off by default. The tightening history is real (`output`, count strictness, suggestion `output`, unsubstituted-placeholder detection at `:1550-1553`) but it tightened *within* a declared case, never the obligation to declare one.

### 2. clang-tidy — the closed world, and the empty file that means "must stay silent"

Two mechanisms, both simple, both decades old.

**Closed-world messages.** Every message check runs FileCheck with an implicit negative:

```python
try_run([
    "FileCheck", f"-input-file={messages_file}", check_file,
    f"-check-prefixes={','.join(active_prefixes)}",
    "-implicit-check-not={{warning|error}}:",
])
```
— llvm/llvm-project `clang-tools-extra/test/clang-tidy/check_clang_tidy.py:390-397` (notes use `-implicit-check-not={{note|warning|error}}:`, `:409-417`). The docs say it in words: "*if `CHECK-MESSAGES:` is used in a file then every warning or error must have an associated CHECK in that file*" (`docs/clang-tidy/Contributing.rst:605-608`).

**A file with no annotations is an assertion of silence.** `get_prefixes` sets `expect_no_diagnosis = True` when none of the three prefixes appear (`:196-197`), and:

```python
def check_no_diagnosis(self, clang_tidy_output: str) -> None:
    if clang_tidy_output != "":
        sys.exit("No diagnostics were expected, but found the ones above")
```
— `check_clang_tidy.py:318-320`

That is the false-positive regression test: a bug report becomes a fixture with **zero** CHECK lines, and the check may never speak on it again. It is also the mechanism this project most obviously lacks.

A detail worth stealing verbatim: the harness strips its own CHECK comments before running, "*to avoid CHECKs matching on themselves*", while keeping the comment markers "*to preserve line numbers while avoiding empty lines which could potentially trigger formatting-related checks*" (`check_clang_tidy.py:204-210`). The fixture is defended against measuring itself.

LLVM's stated policy on false positives is explicitly economic, not aspirational: "*Ideally, a check would have no false positives, but given that matching against an AST is not control- or data flow- sensitive, a number of false positives are expected. The higher the false-positive rate, the less likely the check will be adopted in practice.*" And the two sanctioned remedies are **suppression syntax** and **configuration options** — not undecidability (`Contributing.rst:423-432`).

Enforcement of "every check has a test" is by **scaffold**: `add_new_check.py` "*create[s] a lit test file in the `test/clang-tidy/` directory*" (`Contributing.rst`, directory-structure section). Nothing gates a check whose scaffolded test was later gutted.

### 3. rustc — what stops a snapshot being blessed into wrongness

This is the question the brief most wanted answered, and rustc has an actual, deliberate, documented answer: **a second assertion that `--bless` cannot write.**

> "*Although UI tests have a `.stderr` file which contains the entire compiler output, UI tests require that errors are also annotated within the source. This redundancy helps avoid mistakes since the `.stderr` files are usually auto-generated. It also helps to directly see where the error spans are expected to point to by looking at one file instead of having to compare the `.stderr` file with the source. Finally, they ensure that no additional unexpected errors are generated.*"
> — rust-lang/rustc-dev-guide `src/tests/ui.md:200-207`

The inline `//~ ERROR <substring>` annotation is hand-written, line-anchored, and checked independently of the snapshot. compiletest partitions actual diagnostics against expectations and fails on either side of the mismatch:

```rust
if !unexpected.is_empty() || !not_found.is_empty() { … }
```
— rust-lang/rust `src/tools/compiletest/src/runtest.rs:760`, with `unexpected` populated at `:734-741` and `not_found` at `:752-757`

Three further anti-bless properties:

- **Normalization deletes the annotations from the snapshot** — "*Error line annotations like `//~ ERROR some message` are removed*" (`ui.md`, Normalization). The two assertions cannot contaminate each other.
- **Deduplication is off.** UI tests run with `-Zdeduplicate-diagnostics=no`; "*This helps illuminate situations where duplicate diagnostics are being generated*" (`ui.md:104-107`). The harness is tuned to expose instrument misbehaviour rather than smooth it.
- **Blessing is documented as requiring human reading**: "*You normally generate these files with the `--bless` CLI option, and then inspect them manually to verify they contain what you expect*" (`ui.md:54-56`).

The honest summary: rustc's protection against blessing wrongness is **one machine-checked redundant assertion plus code review**. That is more than a comment, and less than a type.
