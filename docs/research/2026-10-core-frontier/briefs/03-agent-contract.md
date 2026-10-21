# Bet 03 — Shared contracts and repair tooling

**Revised verdict:** research only. Separate additive authoring tools from the
broad schema/state migration: the latter has no demonstrated value/risk case.
Any experiment must beat existing engine blocks and proof tools on real tasks.
This continues ADRs 0030–0030.2, particularly T3, rather than mandating new tools.

**Evidence:** core has coded console diagnostics (`diagnostics.ts:42`, `:120`),
and engine has typed intent, `prove` and a Chromium verifier with structured
findings (`packages/engine/src/verify/index.ts:1`). Registry's manifest describes
copyable items/dependencies rather than full component contracts. Dialog still
repeats controlled/owned-state machinery (`ui/dialog.ts:87`).

**Proposal:** introduce a reviewed runtime declaration that infers types and
attribute metadata; centralize state pinning/seeding/reflection. Export standard
[Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest)
data plus a Nisli semantic extension. Reuse engine's Form schema, validation and
proof vocabulary. Do not pretend arbitrary validation closures serialize to JSON
Schema or that importing component modules is safe outside a DOM environment.

**Tooling:** one CLI implementation for version-matched documentation, static
checks, structured runtime evidence and browser verification; MCP is a thin
adapter. [Svelte's official tool instructions](https://github.com/sveltejs/ai-tools/blob/main/tools/skills/svelte-code-writer/SKILL.md)
show targeted docs lookup and code fixing as a practical combination.

**Acceptance:** mutations of seeded defects fail checks; deliberate snapshots
and valid custom events do not get destructive fixes; missing evidence fails;
compile-time/runtime type parity and registry copies remain correct. Evaluate
held-out app tasks with and without the tools, measuring correctness, repair
attempts, tokens and time. Keep engine, registry and raw core consumers explicit.

**Kill condition:** metadata is maintained twice, new tooling duplicates existing
engine logic, or docs grow without improving held-out outcomes.
