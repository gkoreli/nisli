# 0030. Agent-Native Authoring — The Framework Written, Verified, and Debugged by Agents

**Date**: 2026-08-09
**Status**: Proposed
**Depends on**: [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0023-move-resilient-component-lifecycle](./0023-move-resilient-component-lifecycle.md) — companion to [0029-agent-native-ui-strategy](./0029-agent-native-ui-strategy.md)

## Context

### Frameworks are artifacts optimized for their authors

React is shaped by 2013 Facebook: large teams of humans who must not step on
each other, and whose coordination cost the ceremony (hook rules, dependency
arrays, memoization, provider trees) amortizes. Rails was shaped by the solo
human developer's happiness. A framework encodes an assumption about who
writes the code.

That author is changing. Coding agents write a growing share of new UI code —
and in this repository, all of it. ADR 0029 answers where nisli UI runs and
how it is distributed; it deliberately does not answer why `@nisli/core`
itself should exist in 2027. This ADR does: **nisli is the UI framework
designed to be written, verified, and debugged by agents.** No incumbent
claims that author, and none can claim it the way nisli can — this framework
is *being built* by an agent fleet, under the ADR/worklist/guard discipline
visible in this repo. The [117-PRs origin story](https://gkoreli.com/one-hundred-pull-requests)
is the seed of that narrative; the fleet is the standing R&D lab, where every
ergonomics gap an agent hits becomes a tracked proposal (ADR 0025 is exactly
that pipeline). We are the first consumer of the thesis.

### The author changed, so the failure modes moved

The recurring classes of agent-generated UI bugs are not random; each lives in
a **gap between the code and the document** — a second representation (fiber
tree, closure scope, hydration pass, dependency array) the author must
simulate mentally. Nisli's platform alignment (0019) closes those gaps by not
having the second representation:

| Agent bug class in incumbents | Structural cause | What closes it in nisli |
|---|---|---|
| Hook-order / conditional-hook violations | Hooks are positional protocol state | Composition-style `setup()` runs once; no positional rules |
| Stale-closure state bugs | Values captured at render scope | Signals read current values at use time |
| Hydration mismatches | Two render paths must agree byte-for-byte | Light DOM, attributes-as-truth; SSG emits the markup components already parse |
| Provider/context nesting errors | Runtime context protocols | `inject`/`provide` + `createContext`, portal-safe, resolved at mount |
| Dependency-array invalidation | Manual dependency declaration | Automatic tracking; there is no array |
| One bad component takes the app down | Shared render root | Per-component error boundaries, effect isolation (0008/0009), move-resilient lifecycle (0023) |

The same alignment pays on the *operator* side: pages are increasingly mutated
by actors the framework didn't render (extensions, browser agents). A
light-DOM, move-resilient runtime tolerates foreign mutation that VDOM
reconciliation fights.

### Relationship to 0029

The two ADRs are halves of one identity. 0029 is the ecosystem half: the
surfaces where nisli UI runs (ACP transcripts, MCP Apps widgets, machine-
legible components) and the distribution that reaches them. This ADR is the
core half: why the framework is the right authoring substrate for the agent
era. The components are the core's distribution vector — every widget and
embed installs `@nisli/core` silently; the core is the components'
differentiation — nobody else ships those surfaces in tens of kilobytes,
verifiable headlessly. 0029's surfaces are this thesis's demonstrations.

## Decision

Adopt agent-native authoring as the framework's identity and as a standing
review lens. Every core proposal is judged against three loops:

- the **author loop** — tokens and attempts to correct code;
- the **verify loop** — headless, deterministic, structured feedback;
- the **debug loop** — a runtime that can explain itself to a machine.

The lens is applied the way decisions in this repo are already made —
reasoned review against evidence, ADR by ADR. Turning the lens into a public
measurement is deliberately deferred (see *Deferred* below).

### 1. Design tenets (the lens)

- **Context economics.** The public API stays one small barrel (today:
  fourteen export statements); components stay one file importing only
  `@nisli/core`; there is no hidden build or config to hold in context. A new
  primitive pays for its tokens: it must remove more explanation than it
  adds. This is the agent-era restatement of 0019's minimalism — small
  surface is now an economic property, not an aesthetic one.
- **Document-as-truth.** What the author wrote ≈ what is in the DOM ≈ what
  the accessibility tree exposes. Anything that inserts a representation
  between them (virtual DOM, synthetic events, hydration protocol) fails
  this lens by construction.
- **Failure containment is a shipping requirement.** Agent-written code
  ships before it is 100% right; boundaries and isolation are why it can.
  The defense-in-depth investments re-price from "resilience garnish" to
  load-bearing features of the authoring model.
- **Human DX rides along.** Every property above — small API, fast verify,
  contained failures, inspectable runtime — is defensible engineering for
  human authors too. The bet degrades gracefully if the author mix shifts
  slower than expected.

### 2. The verify loop, productized

This repo already runs the loop the thesis promises — `renderToString`/SSG
snapshots, happy-dom keyboard and ARIA tests, the www Playwright guard that
proves every preview paints on live — but as private harness. Concretely:

**`npx nisli verify [target] --json`** — a new `@nisli/verify` package
(zero runtime deps; happy-dom built in, Playwright optional) that runs a
project's components through five contract levels and emits one NDJSON
verdict per check:

1. **static** — typecheck passes, templates parse;
2. **render** — mounts under happy-dom without diagnostics and produces
   markup (`renderToString` parity wherever SSR is claimed);
3. **semantics** — rendered ARIA roles/names/states and the
   `data-slot`/`data-state` vocabulary match the component's manifest entry;
4. **interaction** — the manifest's declared keyboard map executes
   generically (Escape closes, arrows rove, focus stays trapped) under
   happy-dom;
5. **live** (optional, Playwright) — the page paints, assets load, the size
   budget holds: the www guard, generalized.

```json
{"subject":"ui-dialog","contract":"interaction","check":"focus-trapped",
 "status":"fail",
 "expected":"focus remains inside [data-slot=dialog-content] after Tab from last tabbable",
 "actual":"document.body received focus",
 "hint":"wrap the content in trapFocus() from lib/focus.ts",
 "docs":"https://nisli.dev/verify/focus-trapped"}
```

The unification that makes this cheap: **the manifest (0029 §4) is the
declared contract, and verify is its generic executor.** A component that
declares `"keyboard": {"Escape": "close"}` gets that check for free; tests
remain for behavior beyond the declaration. Exit code is the summary
(0 = all pass), `--json` is the interface agents consume, and the human TTY
table is a formatting of the same verdicts.

### 3. Machine diagnostics and the introspection graph

Where this sits relative to accessibility, since every reviewer should ask:
the accessibility tree already solves **operation** — an accessible page is
an agent-operable page, and nisli is accessible by construction (0022). The
manifest and WebMCP descriptors solve **intent** — typed capability the
a11y tree does not carry. This section solves **causation** — *why* the UI
is in a state and where to change it — which serves the authoring and
debugging agent, not the operating one. Light DOM lets all three planes
project from one representation.

**Diagnostics.** Every dev-mode throw/warn site in core gains a stable code
(`N1xx` templates, `N2xx` attrs/props, `N3xx` reactivity, `N4xx` lifecycle,
`N5xx` projection/DI — the classes 0008/0009 catalogued) emitting one
console line plus a structured payload:

```
[nisli N301] effect re-ran 100× without settling — <ui-combobox>, combobox.ts:88 → nisli.dev/e/N301
```

```json
{"code":"N301","component":"ui-combobox","host":"body>main>ui-combobox",
 "cause":"signal `open` is written inside an effect that reads it",
 "hint":"move the write into the event handler, or wrap the read in untrack()",
 "docs":"https://nisli.dev/e/N301"}
```

The code registry lives in core source; nisli.dev serves one page per code
(the rustc `--explain` / React error-decoder pattern); CI fails on a
code-less throw site and on a code without a docs page.

**Introspection.** Dev builds (behind a build-time define, the same
dev-only posture as the HMR plugin) expose one versioned global:

```ts
interface NisliDevtools {
  version: 1;
  components(root?: Element): ComponentInfo[]; // live instances: tag, host, file
  component(node: Node): ComponentInfo | null; // nearest owning instance
  explain(node: Node): Explanation | null;     // the query that matters
  provenance(limit?: number): WriteRecord[];   // bounded ring of recent writes
}
interface Explanation {
  binding: 'text' | 'attr' | 'class' | 'inner' | 'slot';
  component: { tag: string; file?: string };
  signals: { name: string; value: unknown }[]; // current deps, shallow-serialized
  lastWrite?: WriteRecord;                     // what changed it, and from where
}
```

Everything is JSON-serializable, so the loop closes over a console or CDP:

```
> JSON.stringify(__NISLI__.explain($0))
{"binding":"text","component":{"tag":"cart-badge","file":"cart-badge.ts"},
 "signals":[{"name":"count","value":3}],
 "lastWrite":{"signal":"count","trigger":"event","stack":"onClick cart-badge.ts:31"}}
```

Implementation leans on what fine-grained reactivity already knows: each
binding holds its dependency edges — that is how targeted updates work — so
dev mode records them instead of discarding them, plus a fixed-size
provenance ring (stack capture behind a flag). VDOM frameworks cannot offer
this; they discard exactly this information at render time. Honest scoping:
in nisli much causality is readable from source (one-file components shrink
the gap this API bridges), which is why diagnostics ship first and the
graph second — the graph's irreplaceable cases are live values, write
provenance under real interaction, and instance disambiguation at scale.
Zero presence in production builds.

### 4. UI-as-data: the safe-hydration contract

Agents emit UI as markup or JSON, not compiled code. The core contract that
makes that safe, stated once:

- The declarative surface is **elements + attributes + text**. Components
  remain attribute-complete (0022 invariant; the `attrs{}` migration of
  ADR 0025 §3 is the groundwork), so generated markup can express full
  component capability with no scripting.
- Generated markup flowing through attribute and text channels is safe by
  construction; **`html:inner` stays the only trusted-HTML door** and never
  receives agent output unsanitized.
- The registry manifest of 0029 §4 is the generation vocabulary — the
  machine-readable answer to "what may I emit?" — and its CI drift guard is
  what keeps generated UI and shipped components honest with each other.

### 5. Docs as context

Core's complete reference ships as `llms.txt` inside a fixed token budget,
measured in CI (budget set in the worklist; with a fourteen-statement API the
constraint is achievable, and the constraint is the point). This decides the
core side of 0029 §4's distribution surface: the framework whose whole truth
fits in a context window is a framework agents can hold, not just find.

### 6. The narrative asset

Write and maintain the public account of how nisli is built: the fleet, the
ADR/worklist cadence, the guards, the attestation discipline, the replay
verification — shown, not asserted. The 117-PRs post is the seed;
nisli.dev carries the ongoing record. This is positioning no incumbent can
copy without first adopting the process, and it is the credibility that keeps
"agent-native" from being one more 2026 adjective.

## Deferred: rounds-to-green, the authoring eval

The natural instrument for this thesis is an authoring eval — identical UI
tasks handed to current coding agents in nisli and in the incumbents,
measuring attempts-until-verified, tokens, and wall clock, published losses
and all. It is deliberately **not** in this ADR's work plan.

Two reasons, structural rather than only budgetary:

- **The cost lands in maintenance, not construction.** A credible eval must
  be rerun per agent and per model generation, with pinned versions and
  published transcripts; stale results are worse than none.
- **A benchmark frozen now would steer the framework instead of measuring
  it.** While the core surface is still forming, locking a metric invites
  optimizing the API toward whatever today's agents happen to do well —
  Goodhart pressure aimed at our own design freedom. For now, reasoned
  review against the three-loop lens decides what makes sense. The fleet
  building nisli is the informal, continuous version of this eval already —
  every worklist batch is agents authoring against the framework, with
  review cycles as the signal — and it is free.

Revisit when the core surface stabilizes, or when a specific public claim
needs external proof. Whenever it is built, the standing conditions carry:
open harness, no curated task sets, no quiet retries, losses published with
the wins.

## Boundaries

- **No LLM in the runtime.** Core stays deterministic and standards-based
  (0019). Agent-native describes who the framework serves, never what it
  calls at runtime.
- **No agent-flavored API sprawl.** The thesis is pressure toward a smaller
  surface; it is never license for novelty primitives.
- **Production builds carry zero weight** for diagnostics or introspection.

## Sequencing

*[ADR 0030.1](./0030.1-agent-native-gap-audit.md) audits this plan against
prior-art evidence and supersedes the ordering below; the batches remain
the vocabulary.*

1. **AGN-1 — Diagnostics + docs budget**: error-code taxonomy with
   structured payloads; core `llms.txt` with CI-measured budget. Cheap,
   immediate; pairs with 0029's AUI-4.
2. **AGN-2 — Introspection graph**: dev-only global, provenance buffer,
   documented query surface.
3. **AGN-3 — Verify story**: verdict contract, packaging decision,
   agent-facing verification docs.
4. **AGN-4 — Narrative**: the built-by-agents account on nisli.dev.

Nothing here blocks 0029's AUI batches; AGN-1 and AUI-4 land best together.

## Consequences

**Positive.** The core finally has its own reason-to-exist statement, and it
is one the project already lives rather than aspires to. 0029's surfaces
become demonstrations of this thesis. Past investments re-price: 0019's
minimalism becomes context economics, 0009/0023's resilience becomes the
shipping requirement for agent-written code, the www guard becomes the
prototype of a product. The fleet stops being merely how nisli is built and
becomes standing evidence and a test bench.

**Risks, owned.**

- *Without a benchmark, the thesis rests on judgment.* Accepted
  deliberately — see *Deferred* for why measuring too early is the larger
  risk, and for the revisit trigger.
- *Introspection scope creep.* Dev-only, bounded query surface, and the
  provenance buffer has a fixed size; anything more needs its own ADR.
- *"Agent-native" is 2026's noisiest label.* Differentiation is a visible
  process and the cheap objective numbers we do publish (token budgets,
  payload sizes, 0029 §8's runtime measurements) — never the adjective.

## Alternatives considered

- **Let 0029 carry the identity alone.** Rejected: an ecosystem strategy
  with no core thesis is a component library wearing a framework's name —
  the exact confusion this ADR exists to end.
- **Put AI in the framework** (LLM-assisted rendering, codegen in core).
  Rejected: violates 0019's determinism and minimalism; serves demos, not
  authors.
- **Optimize for human DX and let agents adapt.** Rejected: incumbents own
  human mindshare and training-data presence; the marginal author is the
  agent — and nothing in this ADR costs human authors anything.
- **Rebrand around AI.** Rejected: the thesis is a lens that gives nisli's
  existing values their economic argument, not a new product or name.

## References

- In-tree: [ADR 0008](./0008-effect-scheduling-and-batching-gaps.md) /
  [0009](./0009-framework-defense-in-depth.md) (isolation and containment),
  [0019](./0019-minimal-runtime-and-native-platform-alignment.md) (platform
  alignment), [0023](./0023-move-resilient-component-lifecycle.md)
  (move resilience), [0025 §3](./0025-core-proposals-from-ui.md) (`attrs{}`
  groundwork), [0022](./0022-nisli-ui-component-library.md) (invariants),
  [0029](./0029-agent-native-ui-strategy.md) (ecosystem half);
  `packages/www` guard scripts (the verify-loop prototype).
- Origin narrative: [117 Pull Requests Later](https://gkoreli.com/one-hundred-pull-requests).
