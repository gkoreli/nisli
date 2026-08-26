# Changelog

All notable changes to `@nisli/intent`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at checkpoints
(ADR 0022); dates are release dates.

## 0.0.0 — unreleased

Initial port of the C11 prototype
([`experiments/c11-appearance`](../../experiments/c11-appearance/)) into a real
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
