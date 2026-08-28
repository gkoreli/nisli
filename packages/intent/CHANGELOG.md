# Changelog

All notable changes to `@nisli/intent`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at checkpoints
(ADR 0022); dates are release dates.

## 0.1.0 — unreleased

Verification stopped being a discipline and became a type, after the same
principle failed three times as a comment. Still `private: true`; the
diagnostic-code debt in [ADR 0032](../../docs/adr/0032-derived-appearance-package.md)
§7 still comes first. The reasoning is
[ADR 0033](../../docs/adr/0033-oracle-soundness.md).

### The obligations are structural

Three cross-cutting obligations — whether a node can be measured at all, the
`[data-escaped]` exemption, and the choice between a claim about what the author
wrote and a claim about what the browser did — were applied per rule by hand.
Coverage tracked *when a rule was written* rather than *what it claims*: three
of eleven geometric rules asked whether measurement was possible, five of eleven
honoured an escape, and four rules triggered on a declaration while selecting
through painted output.

They now live in the constructor. `rule()` yields declarations and **no
geometry at all** — no box, no bounds, no line boxes, no containment, no
colour, and no resolved-style accessor either, because a resolved inline size is
a layout read wearing a property name. `measuringRule()` yields measurements
and has all of it. Thirteen of sixteen rules take the measuring constructor;
three take the other. The choice at the top of each file *is* the
declared-versus-painted decision, made once and visibly.

Verified rather than asserted: a probe in which a declaration rule calls each
geometry accessor compiles only because every call is a type error.

The escape policy is resolved by the sentence already in the code — an escape
forfeits *the rhythm, fit, contrast and hit-target guarantees* — and those four
families are exactly the claims about painted output, so honouring the sentence
and choosing the constructor turn out to be the same act. Two rules keep
reporting inside an escape, correctly: an escape buys different styling, not a
licence to misspell an attribute.

### Fault seeding

Every defect class the rule set claims to detect is now injected and the owning
rule asserted to fire, then the injection removed and silence asserted, on a
near-identical clean twin. Seventeen classes against seventeen registered
codes, **zero unseedable**; all sixteen rules fire on their own witnessed defect
with zero misattributed kills. The matrix is derived from the code registry, so
a new rule without an injection **fails** rather than passing quietly.

Results are reported by name and **no ratio is computed** — following the
largest published deployment of this technique, which refuses a detection score
because it *"is neither concrete nor actionable, and it does not guide
testing."*

### Fixed

- **Nine rules reported a clean page over a present defect.** When a defect sat
  in `content-visibility`-skipped content, nine of sixteen rules returned
  silence. They now admit *undecidable*. Proven by seeding, not inferred.
- **A hit-target rule could pass everything, forever, and worked only by
  accident.** It read its floor with an accessor that coerces an unresolvable
  custom property to zero, then skipped every control whose floor was not
  positive. Three routes in: a consumer document with no resolution table, a
  renamed token, or — the frightening one — a floor derived through `calc()`,
  because an unregistered custom property computes to a token stream rather than
  a length. The shipped table declares that one token as a plain length, which
  is the only reason the rule ever worked. Now read verbatim with an explicit
  three-way split: unparseable admits, an explicit zero is a context declining
  to promise, positive measures.
- **A text claim measured an element box**, for the third time in that rule's
  family. All three terms of the arithmetic failed: the padding subtraction
  coerced an unresolved longhand to zero — live in this package's own test
  environment — padding is not the only reason a box exceeds its text, and the
  divisor cost a verdict whenever the line height was a keyword. Now counts the
  line boxes the browser actually produced.
- **An attribute-namespace collision reached a consumer's components.** The
  alignment rules matched a bare attribute that another library writes as an
  animation hook — and the merged stylesheet carried six rules for that word,
  two of them the consumer's own. Now compound, requiring the composition
  attribute beside it, which is a correction rather than a guard: both
  properties the rule resolves into are inert outside a flex or grid box, so the
  bare form never did anything anywhere.
- **The contrast floor lived in a comment.** The table declared a threshold with
  the rationale that it belonged to the theme rather than the rule, and the rule
  hardcoded two numbers anyway. Both WCAG floors are now declared and read per
  element, so a subtree can demand more and a consumer can adopt AAA by editing
  a theme. A missing floor admits rather than falling back to a constant,
  because a fallback makes the declaration unfalsifiable.
- **A new rule for content that reflowed inside a container declared to hold one
  line.** The fit predicate was inline-axis only, so text that could not fit
  horizontally wrapped into the block axis where nothing was looking — a row
  measured as fitting while standing ten lines tall. Closed in both halves: the
  solver acts where degrading helps, the checker speaks where it cannot.
- **A container inside a container could not reflow, so it overflowed the page
  instead.** The no-crush block sets `flex: none` on every descendant of a
  layout container, which is `flex: 0 0 auto` — so a nested container was rigid
  at its *max*-content width and a wrapping row inside a wrapping row could not
  wrap. It held its widest possible line and painted past the page, which is the
  one degradation that block exists to prevent, arriving through the rule that
  prevents it. Measured on two shipped pages at a 390px device: a switcher row
  of six unbreakable buttons held 435px and widened the whole document, and the
  browser's shrink-to-fit then hid it from every relative overflow test.

  Nested containers may now shrink, and only they. `min-width` stays `auto`, so
  the floor is the container's own min-content — for a wrapping row, its widest
  child — and shrinking to that floor is exactly reflow, never a crush; the
  guarantee that nothing is squeezed below its content is unchanged. The licence
  is granted as a single `flex-shrink` declaration rather than the shorthand,
  because the nested selector outranks the grow opt-in and a shorthand would
  have silently un-grown every nested region that asked to absorb slack.

### Debts resolved by measurement

- **The static tier is correct at first paint with no JavaScript.** 1,020
  closed-form assertions across three routes and twelve contexts with scripting
  disabled, checked against the closed form of the axis table rather than
  against the stylesheet, so it catches *resolved wrong* as well as *did not
  resolve*.
- **But the measured tier cannot be pre-solved through a replacing mount.** The
  served bytes carry the solved state and the component discards it on
  hydration. The first hard constraint on the static-rendering story.
- **The byte budget is measured**: the runtime entry is about 1.6 kB minified
  and gzipped, the diagnostics about 9 kB, the table about 2.3 kB. Bundling the
  runtime entry pulls in zero diagnostics modules, so the split is real.
- **Layout shift is useless as an oracle here**, refuted on eighteen cells
  including the ten a pixel differ classified as wrong paints, and against a
  defect of known magnitude. Every defect in this family is a horizontal
  overflow that moves nothing.

### Known debts

- **No closed-world negative assertion.** Every mature checker fails a fixture
  when *any* unnamed diagnostic fires; this package asserts only that a rule
  fires on its defect and is silent on a clean document. It is the missing net
  for a rule that starts reporting something new in a fixture written for
  another rule.
- **`undecidable` carries prose, not a reason key.** Prose cannot be
  aggregated, filtered or counted; the state of the art tags each branch.
- **Two rules remain suspicious and were reported rather than rewritten** — one
  whose exemption set is built from declarations while its subjects are painted,
  one that treats an unresolvable discriminator as an absent one and so is
  vacuously silent across a whole document.
- **Chromium only.** No Firefox or WebKit run.
- **The hit-target rule class is contested upstream**: one major vendor deleted
  its geometric equivalent and another ships the replacement disabled by
  default. Their stated reason is standards-adoption timing rather than defect
  rate, but the churn is a signal about the class.

## 0.0.0 — unreleased

Initial port of the C11 prototype
([`experiments/c11-appearance`](https://github.com/gkoreli/nisli/tree/0a6dfed/experiments/c11-appearance)) into a real
package, under [ADR 0032](../../docs/adr/0032-derived-appearance-package.md).
Behaviour, findings and severities are carried over unchanged; the prototype
stays in the tree as the committed evidence.

**The package is `private: true`.** Nothing has published, and the publishing
prerequisites are listed in `README.md` — the diagnostic-code range debt in
ADR 0032 §7 comes first.

### Capabilities

- **The resolution table** (`@nisli/intent/theme.css`) — about forty percent of
  the idea, and the only place in the package where a number, a colour or a
  radius exists. Four files: the context axes, declared composition becoming
  geometry, declared meaning becoming appearance, and what the engine writes.
  The first three are layered; the last is deliberately unlayered so an engine
  decision outranks any role rule that will ever be written, not merely the ones
  that happen to tie. **Every custom property it declares is `--intent-`
  prefixed** — see the fixed defect below.
- **The declared vocabulary** — what a thing *is* (`data-appearance`,
  `data-role`, `data-text`), how it *composes* (`data-layout`, `data-grow`,
  `data-align`, `data-clip`), and what matters *least* (`data-priority`,
  `data-collapse`). No `size` prop and no class-name channel exists, and the
  escape hatch for raw CSS reports itself rather than being forbidden.
- **The measured tier** — a bounded loop over the declared priority list, about
  thirty-five lines including lifecycle, registered in a component with one
  line. Never a constraint system.
- **Verification** — fifteen rules as pure functions over an inspector port,
  with the padding box and the border box as distinct types so confusing a
  containment claim with a pressability claim is a compile error, and one way
  for any rule to report *undecidable* rather than passing.
- **Provenance** — `explain()` names the declarations and the context that
  produced an element's geometry, the debugging story for a system where no
  value was typed by a human.
- **A split entry surface** — the runtime entry never imports the diagnostics,
  so a production bundle that only registers the measured pass carries none of
  the rule engine, the reporters or the provenance strings.

### Measured at port time

- 240 of 240 context combinations clean in real Chromium across ten independent
  assertion paths, each proven capable of failing before the run is trusted.
- 79.1% of 278 audited CSS capabilities derived automatically or authored once
  in the table; the remaining 20.9% is named per capability.
- Contrast above the WCAG floor on 4,913 of 4,913 swept surfaces, minimum
  4.585:1.
- 141 tests behind a type gate, no browser required.

### Fixed

- **The table declared un-namespaced custom properties and collapsed a
  consumer's radius ramp.** All thirty-one properties are now `--intent-`
  prefixed; a test fails the build if a new one is not. `tokens.css` declared
  bare `--radius` on the universal selector, so importing `theme.css` into a
  real Tailwind + shadcn application shadowed the site's own
  `--radius: 0.625rem` on **every element** and collapsed its whole derived
  ramp (`sm` 6→4, `md` 8→6, `lg` 10→8, `xl` 14→12). Measured: **5,762 changed
  computed properties across 9 pages and 3,584 elements, zero bounding-box
  changes** — no screenshot diff would have caught it. Six properties sat on
  `*` (`--unit`, `--text`, `--text-meta`, `--text-title`, `--text-display`,
  `--radius`); twenty-five more sat on `:root` and the context scopes, where a
  consumer declaring `--accent` wins or loses on document order. Found only by
  putting the package in a real application: the 240-cell matrix was green
  throughout, because every cell measured the package alone. Rename verified
  behaviour-preserving by measurement — 2,816 computed-property comparisons
  across 88 elements and 8 contexts, zero differences before vs. after.

### Known debts

- **Diagnostic codes are not yet allocated against core's registry** (ADR 0032
  §7). This blocks publishing and will renumber codes when resolved.
- **No SSG pre-solve.** The static tier should resolve at build time; untested.
  The flash of unfit is zero composited frames client-rendered, but nine to ten
  frames — 69 to 87 milliseconds — against a 100-millisecond hydration budget.
- **No byte budget.** The measured tier has never been weighed minified and
  gzipped against core's ceiling.
- **Chromium only.** No Firefox or WebKit run.
- **One deferred case.** Bare markup inside a flush surface, with no wrapper
  element to promote, is still clipped; fixing it needs the mutator to insert an
  element. A rule reports it, so the loss is loud rather than silent.
- **Small surface.** Four pages exercised the vocabulary, not a product, so the
  claim that the vocabulary closes is measured at 79.1% and not at one.
