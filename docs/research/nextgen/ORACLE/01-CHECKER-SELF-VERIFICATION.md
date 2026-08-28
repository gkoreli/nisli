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

### 4. axe-core — the closest system to this project, and the most instructive

**Fixture shape.** Per rule, an HTML file and a JSON file of expectations, generated into a test suite by `build/generate-integration-tests.js`. The README's last line is the closed-world assertion: "*The JSON file should have at least one of the `violations`, `passes`, or `incomplete` arrays. Inapplicable results are not listed as the test will fail if any node is found in one of the 3 arrays that is not explicitly listed.*" (dequelabs/axe-core `test/integration/rules/README.md`).

**Coverage, measured.** Of eighty-four rule directories: eighty-one declare a passing case, seventy-four declare a violation, twenty-five declare an incomplete. The ten with no violation fixture are `aria-braille-equivalent`, `audio-caption`, `duplicate-id-aria`, `form-field-multiple-labels`, `frame-title-unique`, `hidden-content`, `identical-links-same-purpose`, `server-side-image-map`, `th-has-data-cells`, `video-caption`. Three of those ten (`aria-braille-equivalent`, `duplicate-id-aria`, `frame-title-unique`) are `reviewOnFail` rules that *structurally cannot* produce a violation — `lib/core/base/rule.js:272-287` rewrites every `false` check result to `undefined`. So the true "never proven to fire" set is seven of eighty-four, about eight percent, and it is not zero.

**The undecidable class, in detail.** `target-size-evaluate.js` — the rule whose claim is ours — is worth reading whole. It returns `undefined` from five places, each with a reason:

```js
if (overflowingContent.length && (fullyObscuringElms.length || !hasMinimumSize(nodeRect))) {
    this.data({ minSize, messageKey: 'contentOverflow' });
    …
    return undefined;
}
…
// Check cannot fail if the target is not in the tab order
const negativeOutcome = isInTabOrder(vNode) ? false : undefined;
…
if (!largestInnerRect) {
    this.data({ minSize, messageKey: 'tooManyRects' });
    return undefined;
}
```
— `lib/checks/mobile/target-size-evaluate.js:35-74`

Note `negativeOutcome`: **a target that is not in the tab order can never fail this rule, only be reviewed.** That is a claim-scoping decision expressed as a value, and it is exactly the kind of thing our N690-widening episode got wrong by widening.

And `tooManyRects` is an explicit computational-budget surrender: `splitRects` throws `new Error('splitRects: Too many rects')` (`lib/commons/math/split-rects.js:21`), the caller catches it and returns `null`, and the rule becomes undecidable rather than guessing.

**Which box?** `target-size` reads `vNode.boundingClientRect` — border box, in viewport coordinates — everywhere: for the target, for overlap (`lib/commons/math/has-visual-overlap.js:11-22`), for enclosure (`isEnclosedRect`), and for the obscuring rects. The one exception is deliberate and recorded in the changelog: "*determine offset using clientRects if target is `display:inline`*" (issue five thousand and twelve), implemented as `display === 'inline' ? obscuredNode.clientRects : obscuredNode.boundingClientRect`. **Deque independently reached our conclusion that a pressability claim is a border-box claim** — and reached it, on the evidence of the changelog, by shipping fixes rather than by typing.

**Overlap is measured on children, not on the container.** `findNearbyElms(vNode)` enumerates neighbours, `filterByElmsOverlap` sorts them into fully- and partially-obscuring, and `getLargestUnobscuredArea` splits the target rect by the obscuring rects and takes the largest remainder. This is the correct construction for F8 and for the N670 v1 defect, arrived at independently, and it is about one hundred lines.

**One place where copying axe would be the wrong move**, flagged by AccessorSweep and worth stating so this file is not read as a mandate. axe's overlap test is a *visual-extent* claim — do these two rectangles intersect, and which one paints on top — and a border box is the right measurement for it. N670's sentence is a *containment* claim — did this box get the inline space its content needs, so that the overflow lands on the following sibling — and a padding box is the right measurement for that. The two accessors disagree because the two claims disagree, which is the whole thesis of the `Box`/`Bounds` split. What transfers from axe is the *construction* (enumerate the neighbours and measure the child, rather than measuring the container and inferring), not the accessor.

**An instrument tolerance, named and centralised.**

```js
const roundingMargin = 0.05;

export default function rectHasMinimumSize(minSize, { width, height }) {
  return (
    width + roundingMargin >= minSize && height + roundingMargin >= minSize
  );
}
```
— `lib/commons/math/rect-has-minimum-size.js`. One constant, one function; every size comparison in the rule goes through it. Compare our per-rule inline comparisons.

**Contrast's incomplete registry.** `color-contrast-evaluate.js` carries a mutable `incompleteData` store keyed by *what is missing* — `colorParse`, `bgColor`, `equalRatio`, `shortTextContent` — and the surrender is commented in plain English:

```js
// We don't know, so we'll put it into Can't Tell
if (
  fgColor === null ||
  bgColor === null ||
  equalRatio ||
  (shortTextContent && !ignoreLength && !isValid)
) {
  missing = null;
  incompleteData.clear();
  this.relatedNodes(bgNodes);
  return undefined;
}
```
— `lib/checks/color/color-contrast-evaluate.js:166-176`

**`failureSummary`** is generated, not authored: `lib/core/utils/publish-metadata.js` composes per-check messages from `metadata.messages.{pass,fail,incomplete}` in each check's JSON, falling back to `incompleteFallbackMessage()` when a reason key is missing (`:31-62`). Messages live in the same JSON as the check and are localised; there is no free-text detail string produced at the call site. Ours are free text.

### 5. stylelint, Biome, semgrep

**stylelint** (`jest-preset-stylelint`). `testRule({ ruleName, config, accept, reject })`. Accepted code must produce zero warnings, zero parse errors and zero invalid-option warnings (`getTestRule.js:52-54`); if `fix` is declared, accepted code must be **unchanged by the fixer** (`:58-64`). Rejected code must produce exactly the declared number of warnings (`:89`), each must carry a `message` — enforced by a custom matcher whose failure text is *"Expected \"reject\" test case to have a \"message\" property"* (`:165-168`) — and if the rule is fixable, every reject case must declare `fixed` or `unfixable`, thrown at runtime:

```js
throw new Error(
    'If using { fix: true } in test schema, all reject cases must have { fixed: .. }',
);
```
— `getTestRule.js:123-127`

Then the fixed output must **differ** from the input (`expect(fixedCode).not.toBe(testCase.code)`, `:137`) and re-linting the fixed code must yield the same warnings as the fix run and no parse errors (`:147-157`) — an idempotence-and-no-new-findings check. But `setupTestCases` is `if (cases && cases.length)` (`:190`): an absent `reject` silently tests nothing. Convention carries it — one hundred and fifty of one hundred and fifty core rule test files declare `reject`.

**Biome** is the strongest mechanism in the survey, because it fuses documentation and falsification. A rule's doc comment contains code blocks; `xtask/rules_check` parses and *runs* them:

```rust
} else if test.expect_diagnostic {
    // ...or if the analysis does not return exactly one diagnostic...
    if diagnostics.all_diagnostics.len() != 1 {
        diagnostics.print_all_diagnostics()?;
        bail!("… returned N diagnostics, but a single diagnostic was expected.");
    }
} else if test.expect_diff {
    if diagnostics.action_count == 0 {
        bail!("… returned no diff where one was expected.");
    }
} else if !diagnostics.all_diagnostics.is_empty() {
    // ...or if the analysis returns a diagnostic when none are expected.
    bail!("… returned an unexpected diagnostic.");
}
```
— biomejs/biome `xtask/rules_check/src/lib.rs:276-298` (message strings abridged; the comments are verbatim)

So: every documented example is a fixture, every undecorated example is a *negative* fixture, and a rule that fires twice where the docs promised once fails the build. It still does not require that at least one block be `expect_diagnostic` — four hundred and thirty-four of four hundred and forty-two JS rules have one, eight do not (`no_vue_data_object_declaration`, `use_import_extensions`, `no_undeclared_classes`, `no_restricted_types`, `use_filenaming_convention`, `no_document_import_in_page`, `no_head_import_in_document`, `no_undeclared_env_vars`). Separately, `rules_check` is a genuine lint-on-lints over rule *metadata*: it rejects `type Options = ()`, rejects a non-nursery rule carrying an issue number ("*The presence of an issue number indicates that the rule is not yet completed*"), and enforces a severity-per-group matrix (`:68-146`).

**semgrep.** Fixtures are the target language itself with inline annotations — `# ruleid: <id>` for an expected finding, `# ok: <id>` for an expected silence, plus `todoruleid`/`todook` for known-failing expectations that are subtracted from both sides rather than deleted (semgrep/semgrep `cli/src/semgrep/test.py:54-58`, `:229-236`). The output names both failure directions explicitly: `missed lines` and `incorrect lines` (`:262-268`) — the second being false positives. And a dangling annotation is fatal:

> "*Failing due to rule id mismatch. There is a test denoted with 'ruleid: <rule name>' where the rule name does not exist or is not expected in the test file.*"
> — `cli/src/semgrep/test.py:142-146`

The `semgrep-rules` repo runs `semgrep validate .` and `semgrep test .` in CI (`.github/workflows/semgrep-rules-test.yml`), and separately runs twenty-two semgrep rules **over the rule files themselves** (`.github/workflows/semgrep-rule-lints.yaml`), including `duplicate-id`, `empty-message`, `missing-message-field`, `missing-language-field` and `unsatisfiable`. One thousand nine hundred and fifty-one of one thousand nine hundred and sixty-four rule files have a companion test file.

### 6. Visual and geometric checkers — how they separate a regression from an artefact

Nobody in this tier does what this project did. The universal answer is **tolerance**, applied to the *comparison*, not agreement between instruments.

- **BackstopJS**: `misMatchThreshold` (default zero point one percent of pixels) plus `requireSameDimensions` (default true — "*any change in selector size will trigger a test failure*"). The README even documents the threshold's own noise floor: Resemble's `misMatchPercentage` "*only detects mismatches above 0.01%*", requiring `usePreciseMatching` below that (garris/BackstopJS `README.md:197-198, 496-502, 1009`). Repo last pushed 2024-09-07 — the tool is effectively frozen.
- **Chromatic**: a *colour-distance* threshold in YIQ space, default zero point zero six three, "*which balances high visual accuracy with low false positives (for example, from artifacts like anti-aliasing)*", plus explicit anti-aliased-pixel detection which is on by default and overridable with `diffIncludeAntiAliasing` (chromatic.com/docs/threshold). Chromatic's docs then name the failure mode of the approach: "*a threshold of `0.8` may prevent Chromatic from detecting positioning changes*". A tolerance tuned for colour noise blinds you to geometry.
- **Percy**: removes the instrument instead of tolerating it, by capturing DOM and re-rendering server-side in controlled browsers, so the comparison is not against a developer's GPU. Diff-tolerance semantics `[UNVERIFIED]` — the renderer is closed-source and I found no primary source stating them.
- **pa11y** is the one that faces the disagreement problem directly, and it resolves it in the opposite direction to ours. It can run **two independent instruments in one pass** — `pa11y https://example.com --runner axe --runner htmlcs` — and unions their findings. It also **demotes** uncertainty rather than escalating it: `--level-cap-when-needs-review <level>` "*(axe-only) cap severity of any issue requiring manual review to: error (default), warning, notice*" (pa11y/pa11y `README.md:65, 71, 91-100, 465`). And it offers `--threshold <number>` to "*permit this number of errors, warnings, or notices*".
- **Lighthouse** does not have an instrument-disagreement mechanism; it has a *result-class* mechanism. `SCORING_MODES` enumerates `NUMERIC`, `METRIC_SAVINGS`, `BINARY`, `MANUAL`, `INFORMATIVE`, `NOT_APPLICABLE`, `ERROR` (`core/audits/audit.js:50-58`) and `generateAuditResult` promotes a product into `ERROR` if it carries an `errorMessage`, or `NOT_APPLICABLE` if it says so (`:428-437`). `MANUAL` is the interesting one: an audit that admits a human must decide, permanently.

---

## Ideas worth stealing

1. **The empty fixture as a false-positive regression test.** clang-tidy's `expect_no_diagnosis`: a fixture with zero expectations asserts the rule stays silent. Every one of our six measurement defects produced a concrete page that should not have fired. Each is one silent fixture. Cost: near zero.
2. **Closed-world assertions.** `-implicit-check-not` / compiletest's `unexpected` / Biome's *"unexpected diagnostic"* / axe's "*will fail if any node is found … that is not explicitly listed*". A fixture should declare the complete finding set for a page, not a subset. Four independent projects, one mechanism.
3. **Reason keys instead of prose for undecidable.** axe's `messageKey` enum per check plus a shared fallback. Turns `undecidable()` from a log line into something a coverage guard can count and a sweep can enumerate — directly relevant to AccessorSweep's finding that N713 is *vacuously* silent, which no prose detail string would ever have surfaced.
4. **A rule metadata lint that runs in the gate.** Biome's `rules_check` and semgrep's `semgrep-rule-lints` are both *the project's own analyzer pointed at its own rules*. We already have a coverage guard and a namespace guard; a rules-check is the same shape.
5. **The non-blessable second assertion.** rustc's `//~ ERROR` beside the `.stderr` snapshot, with the annotations *stripped* from the snapshot during normalization so the two cannot contaminate each other. If any recorded number in `experiments/` ever becomes machine-compared, it needs a hand-written companion that regeneration cannot touch.
6. **One centralised tolerance function.** axe's `rectHasMinimumSize` with a single named `roundingMargin`. Every size comparison in every rule routes through one place, so the instrument's precision is a single reviewable fact.
7. **Claim-scoping as a value.** axe's `const negativeOutcome = isInTabOrder(vNode) ? false : undefined` — "this rule may not *fail* on this subject, only review it". Cheaper and more honest than either firing or excluding.
8. **Known-failing tracked, not deleted.** semgrep's `todoruleid`/`todook`. A defect you have not fixed stays in the fixture, annotated, subtracted from both expected and reported — visible instead of absent.

---

## Where the prior art says we are wrong

1. **"Every rule needs an invalid case" is our invention, not an inherited standard — and the industry's *implemented* version of it is weaker than ours.** ESLint accepts `invalid: []` (proven by execution, above). stylelint's harness no-ops on a missing `reject`. axe's README requires "at least one of" three arrays. Biome requires nothing. If we state that our falsification fixture matches ESLint's, the claim is false. What *is* true, and is the stronger claim: measured coverage in these projects is ninety-two to one hundred percent by convention, and the residue is real (seven axe rules, eight Biome rules). **A gate would be a genuine contribution, not catching up.**
2. **We are missing the mechanism that actually catches this bug class, and four projects independently converged on it.** Every one of our six measurement defects was a **false positive** — a rule firing on clean input. Positive fixtures do not catch false positives; closed-world negative assertions do. clang-tidy has had this since the `lit` era; rustc, Biome and axe all have it. We have the weaker half of the standard practice, not the stronger half.
3. **Undecidability is the *last* remedy in LLVM's playbook, not the first.** "*There are two primary mechanisms for managing false positives: supporting a code pattern which allows the programmer to silence the diagnostic in an ad hoc manner and check configuration options to control the behavior of the check*" (`Contributing.rst:429-432`). Neither is undecidability. axe's `target-size` also carries a `minSize` option and an `enabled` flag before it ever reaches `undefined`. Our answer to a rule that cannot decide is always N680; the prior art's first answers are **suppression** and **configuration**, and we have neither.
4. **Treating instrument disagreement as the failure is unshared.** pa11y is the one shipping tool that runs two independent appearance instruments over the same page, and it **unions** their findings and **demotes** the uncertain ones (`--level-cap-when-needs-review` defaults to capping at `error`, and can cap to `notice`). Chromatic, BackstopJS and Percy all absorb instrument variation into a tolerance and never surface it. Nobody found does what we did. That is either genuinely novel or a category error, and the prior art gives no support for the second instrument being a *check* rather than a *supplement*.
5. **A geometric hit-target rule may not be worth having at the tier we are attempting it.** Google removed `tap-targets` from Lighthouse (`changelog.md:1143`) and delegated to axe; axe ships `target-size` disabled; the rule needed one hundred-odd lines of rect-splitting, five undecidable branches, a shared rounding margin and fifteen changelog fixes to become trustworthy. Our N650/N670/N690 family attempts the same claim with less machinery — and AccessorSweep has just found two of the three still wrong. The prior art's verdict on this specific rule is *hard, expensive, and off by default*.
6. **A snapshot's protection is a second hand-written assertion, and our recorded numbers do not have one.** rustc's dev guide names the exact risk we have — "*the `.stderr` files are usually auto-generated*" — and answers it with `//~ ERROR`: machine-checked, snapshot-stripped, un-blessable. Numbers recorded in rule header comments are checked by nothing. They are documentation, and this project's own history says documentation does not stop recurrence.
7. **Free-text detail on `undecidable()` will not scale.** axe generates every message from per-check JSON with reason keys and a localised fallback; Lighthouse makes the class part of the audit type. A prose string cannot be counted, cannot be swept, and cannot be asserted against. `[INFERENCE]` — no source says this about *our* API; the inference is from four systems having independently chosen enums.

---

## The recurrence question

**Direct answer: partially. Type-level constraints across all rules exist and are shipping. Accessor-to-claim binding does not exist anywhere I could find.**

Three tiers of evidence, weakest to strongest.

**Tier one — a lint on the lints. Common, boring, well adopted.**
`eslint-plugin-eslint-plugin` (four hundred and twenty-five thousand downloads a week) ships forty-one rules over rule source and rule tests, and ESLint itself uses it on `lib/rules/*.js` via `extends: ["eslint-plugin/rules-recommended"]` and on `tests/lib/rules/*.js` via `extends: ["eslint-plugin/tests-recommended"]` (eslint/eslint `eslint.config.js:125-199`), alongside its own `tools/internal-rules` (`no-invalid-meta.js`, `multiline-comment-style.js`). The catalogue is instructive because of what it *is*: metadata hygiene (`require-meta-schema`, `require-meta-docs-url`, `require-meta-fixable`), dead-diagnostic detection (`no-unused-message-ids` — "*The messageId … is never used.*"), test hygiene (`consistent-output`, `no-identical-tests`, `unique-test-case-names`, `no-only-tests`, `require-test-error-positions`). Biome's `xtask/rules_check` and semgrep's twenty-two self-hosted rule-lints are the same tier.

**Tier two — a restricted API surface rules must code against. Exists, narrow.**
ESLint's `RuleTester` monkey-patches `SourceCode.prototype` so that `applyInlineConfig`, `applyLanguageOptions` and `finalize` throw when a rule calls them (`rule-tester.js:147-152, 303-320, 1295-1301`). Three lifecycle methods. Nothing about measurement.

The nearest thing to our problem in this tier is `eslint-plugin/no-property-in-node`: "*disallow using `in` to narrow node types instead of looking at properties*", implemented with the TypeScript type checker — it resolves the type of the right operand of `in` and reports if it is a known ESTree/TSESTree node type (`lib/rules/no-property-in-node.ts:32-47, 96-110`). This is genuinely *"a lint that enforces rules use the right way of asking a question about a node"*. It is also `recommended: false` and `requiresTypeChecking: true`, i.e. opt-in and expensive — and ESLint does not enable it on its own rules.

**Tier three — a type-level constraint tying a rule's claim to its evidence. Exists, in two compilers, at coarse grain.**

```rust
pub trait Rule: RuleMeta + Sized {
    /// The type of AstNode this rule is interested in
    type Query: Queryable;
    …
    fn phase() -> Phases {
        <<<Self as Rule>::Query as Queryable>::Services as Phase>::phase()
    }
```
— biomejs/biome `crates/biome_analyze/src/rule.rs:1323-1339`, with `pub trait Queryable { type Input; type Output; type Language; type Services: FromServices + Phase; }` at `crates/biome_analyze/src/query.rs:8-13`

A rule does not *choose* which analysis phase it runs in, and therefore which services it can read; the phase is **derived from the query type**. A syntax-only rule cannot reach semantic information because its `Services` type does not carry it. rustc has the same idea at coarser grain: the `EarlyLintPass` / `LateLintPass` split makes "this lint has type information" a property of the trait implemented, not a runtime check.

**What none of them have.** Both of those constrain *what class of evidence is available*. Neither constrains *which of two structurally identical measurements of the same subject a given claim must use*. There is no project in this survey where a rule asserting pressability is prevented, by type, from reading a padding box; the compilers' constraint is "you may not see types here", not "you may not measure this quantity for that claim".

axe-core is the strongest counter-example to our novelty, and it still is not a counter-example. It reached the same conclusion — pressability is a border-box claim, overlap is measured on enumerated neighbours — but it reached it by **convention plus fifteen changelog fixes**, and enforces it with **nothing**. `vNode.boundingClientRect` and `vNode.clientRects` are both plain properties on the same object; `getComputedStylePropertyValue` sits beside them. A new axe check confusing them would compile.

**Therefore:** the `Box`/`Bounds` split, as a *domain-specific* type-level constraint that makes a measurement/claim mismatch a compile error, is **not present in any of the ten systems surveyed**. The generic pattern it instantiates — encode the analysis capability in the rule's type — is proven and shipping in Biome and rustc, which is exactly the evidence needed to argue it is a sound design rather than a clever one-off. The honest framing is: *the shape is precedented, the instance is ours, and the enforcement gap it leaves — nothing yet asserts each rule uses the accessor its claim requires — is the same gap axe-core has, which is why axe-core keeps fixing that rule.*

**A corollary the sweep supplied.** `Box`/`Bounds` closes the *wrong-box* mistake and closes nothing else. AccessorSweep reports two rules still wrong for reasons the types cannot see: N650 coerces an unresolvable custom property to zero and then silently passes forever, and N690 reads an element box for a text claim through arithmetic the types permit. Both are the *coercion* hazard, not the *box* hazard — a lossy accessor that turns "unknown" into a plausible number. That is precisely what axe refuses by returning `undefined` with a reason key instead of a default, and precisely what clang-tidy's silent fixture would have caught. Two of the eight ideas above target it directly.

---

## Open questions

- Does ESLint's monorepo or CI have an out-of-band check that a core rule's test file declares non-empty `invalid`? I found none in `eslint.config.js`, `tools/` or the plugin catalogue, but I did not read every CI workflow. `[UNVERIFIED]`
- Percy's diff semantics. No primary source found; the renderer is closed. `[UNVERIFIED]`
- axe-core's aggregate false-positive rate. Deque publishes no figure. The ACT rules mapping in `doc/rule-descriptions.md` is the closest thing to external validation, and it is per-rule conformance, not defect rate. `[UNVERIFIED]`
- Whether Biome's `rules_check` runs in the merge gate or only in a codegen check job. I read the implementation, not the workflow wiring.
- semgrep's real adoption. The npm package is a shim at three thousand four hundred and sixty-five a week; distribution is pip and brew. pypistats returned no parseable body when queried. `[UNVERIFIED]`
- Whether `eslint-plugin/no-property-in-node` was ever proposed for `rules-recommended` and rejected on cost. That discussion would bear directly on whether a domain accessor lint is affordable for us.

---

## Sources

**Cloned and read under `/tmp/librarian-*` on 2026-08-26** (removed after reading):

- eslint/eslint v10.9.1 — `lib/rule-tester/rule-tester.js`, `eslint.config.js`, `tools/internal-rules/`
- eslint-community/eslint-plugin-eslint-plugin v7.6.2 — `lib/rules/` (forty-one rules), `no-property-in-node.ts`, `no-unused-message-ids.ts`, `consistent-output.ts`, `require-test-error-positions.ts`
- dequelabs/axe-core v4.13.0 — `lib/checks/mobile/target-size-evaluate.js`, `lib/checks/mobile/target-size.json`, `lib/checks/color/color-contrast-evaluate.js`, `lib/commons/math/rect-has-minimum-size.js`, `has-visual-overlap.js`, `split-rects.js`, `lib/core/base/rule.js`, `lib/core/utils/publish-metadata.js`, `lib/rules/*.json` (one hundred and five), `test/integration/rules/` (eighty-four directories), `doc/rule-descriptions.md`, `CHANGELOG.md`
- stylelint/stylelint v17.14.1 — `lib/rules/*/__tests__/index.mjs` (one hundred and fifty)
- stylelint/jest-preset-stylelint v9.2.0 — `getTestRule.js`
- biomejs/biome (main) — `xtask/rules_check/src/lib.rs`, `crates/biome_analyze/src/rule.rs`, `crates/biome_analyze/src/query.rs`, `crates/biome_js_analyze/src/lint/` (four hundred and forty-two rules), `crates/biome_js_analyze/tests/specs/`
- semgrep/semgrep-rules — `.github/workflows/semgrep-rule-lints.yaml`, `.github/workflows/semgrep-rules-test.yml`, `yaml/semgrep/unsatisfiable.yaml`, one thousand nine hundred and sixty-four rule files
- GoogleChrome/lighthouse v13.4.1 — `core/audits/audit.js`, `changelog.md`

**Fetched from canonical raw URLs:**

- <https://raw.githubusercontent.com/llvm/llvm-project/main/clang-tools-extra/test/clang-tidy/check_clang_tidy.py>
- <https://raw.githubusercontent.com/llvm/llvm-project/main/clang-tools-extra/docs/clang-tidy/Contributing.rst>
- <https://raw.githubusercontent.com/rust-lang/rustc-dev-guide/master/src/tests/ui.md>
- <https://raw.githubusercontent.com/rust-lang/rust/master/src/tools/compiletest/src/runtest.rs>
- <https://raw.githubusercontent.com/semgrep/semgrep/develop/cli/src/semgrep/test.py>
- <https://raw.githubusercontent.com/garris/BackstopJS/master/README.md>
- <https://raw.githubusercontent.com/pa11y/pa11y/main/README.md>
- <https://www.chromatic.com/docs/threshold/>
- <https://github.com/GoogleChrome/lighthouse/issues/13719> — false positives in `tap-targets` from a missing viewport declaration
- <https://github.com/GoogleChrome/lighthouse/issues/7365> — `tap-targets` ignoring absolutely positioned elements to avoid false positives, and thereby missing real failures

**Adoption data:** npm registry `https://api.npmjs.org/downloads/point/last-week/<pkg>` and `https://api.github.com/repos/<owner>/<repo>`, both queried 2026-08-26.

**This repository, for comparison:** `packages/intent/src/contracts.ts:154` (`Box`), `:213` (`Bounds`), `:517` (`lines()`), `:412` (`Severity`); `packages/intent/src/diagnostics/rule.ts:18-45` (`undecidable()`); `packages/intent/src/diagnostics/rules/shredded.ts:56-59` (the third recurrence, recorded in prose).
