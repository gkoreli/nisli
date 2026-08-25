# Bet 10 — TC39 Signals: Hold the Core, Spec a Boundary Adapter

**Status**: Draft investment brief (August 2026)

## Context

The TC39 Signals proposal would standardize `Signal.State` / `Signal.Computed` / `Signal.subtle.Watcher` in the language. ADR 0015 (Feb 2026) already ruled on the core question: Watcher-based scheduling is "the right long-term direction but wrong timing — TC39 Signals is Stage 1", and `flush()` was designed to be forward-compatible (`flush()` → `defaultWatcher.flush()`). This bet re-confirms that ruling with August-2026 evidence and adds the one thing ADR 0015 did not cover: a small, optional interop adapter so nisli signals can produce/consume polyfill-based signals (the `@lit-labs/signals` pattern), without a single byte landing in `@nisli/core`.

**Verified external state (Aug 2026):**

- **Still Stage 1.** The official `tc39/proposals` stage-1 list shows Signals last presented to plenary **June 2024** ("Algorithms for Signals") — over two years without advancement. The proposal README still self-describes as Stage 1 ("can currently be thought of as Stage 0"). Last repo commit: Aug 2025, docs/fixes only. No engine implementation exists. (Some 2026 SEO articles claim Stage 2; the authoritative TC39 list contradicts them.)
- **`signal-polyfill` 0.2.2**, last published **2025-01-17** (19 months stale). README: "a preview of an in-progress proposal and could change at any time. Do not use this in production."
- **`@lit-labs/signals` 0.3.0**, published **2026-05-14** — actively maintained, but Labs-tier ("may receive breaking changes or stop being supported"). It takes `signal-polyfill ^0.2.2` as a **direct** dependency (not peer) and explicitly warns that multiple polyfill copies on one page break interop. Exports: `SignalWatcher` mixin, `watch()` directive, signal-aware `html` tag.
- **Who ships polyfill signals today?** Essentially only the Lit Labs ecosystem. Angular/Vue/Solid/Preact champions back the proposal but ship their own proprietary signal cores, not the polyfill. Production polyfill adoption is ~nil.

## Current state in nisli

`packages/core/src/signal.ts` (793 lines), push-pull hybrid:

- **Equality**: `Object.is` hard-coded on writes (`signal.ts:189`) and computed recomputes (`signal.ts:352`). No custom `equals` option.
- **Computed**: lazy (starts Dirty, `signal.ts:254`; pulls on read, `:287-289`), cached, MaybeDirty revalidation via `sourcesChanged()` epoch comparison (`:318-326`, `:332-336`), errors cached and rethrown until a dependency changes (`:257`, `:291-294`, `:367-384`), error-state transitions bump the change epoch both directions (`:361-374`).
- **Effects**: built-in, auto-tracking, `queueMicrotask`-coalesced (`:117-122`), creation-order flush (`:128`), pre-run MaybeDirty poll skips no-op runs (`:485-493`, `:508-511`), error containment without disposal (`:556-559`), N301 loop guard (`:570-586`), N302 write-attribution (`:196-206`), N310 async rejection (`:538-555`).
- **Boundary tools**: `untrack()` (`:707-715`), `subscribe()` built on effect+untrack (`:216-224`, `:403-408`), `flush()` with N303 cap (`:728-746`), `tick()` (`:770-792`), `SIGNAL_BRAND`/`isSignal` (`:47`, `:688-694`), effect disposal with component-context auto-dispose (`:658-679`).
- **Packaging**: `packages/core/package.json` exports only `.` and `./vite-hmr*` — ADR 0019's subpath-exports plan (§4) is **unimplemented**.

## Semantic diff table: nisli vs TC39 proposal

| Dimension | nisli | TC39 (polyfill 0.2.2) | Divergence / migration pain |
|---|---|---|---|
| Read/write syntax | `.value` accessor, `.peek()` | `.get()` / `.set()`; `untrack` for peek-like reads | Mechanical; adapter wraps. No action. |
| Equality cutoff | `Object.is`, hard-coded (`:189`, `:352`) | `options.equals`, **default `Object.is`** | Defaults match. Missing custom `equals` is the one API gap; additive `equals` option would be behavior-preserving for all existing code. Cheap, but defer until a real need. |
| Computed evaluation | Lazy pull, cached, epoch-validated MaybeDirty | Lazy pull, cached, topological glitch-free | Aligned in observable semantics; both glitch-free on read. |
| Error semantics | Error cached, rethrown on read; enter/exit transitions bump epoch so effects never skip recovery (`:361-374`) | Computed caches exception, rethrows until deps change | Aligned. nisli's equal-value-recovery epoch bump is a superset that matters only to its own scheduler. |
| Effects | **Built-in**: microtask coalescing, creation-order flush, loop guard, containment | **None** — bring-your-own via `Signal.subtle.Watcher` (sync notify, no signal reads/writes in notify, must re-watch per episode) | Layering difference, not semantic conflict. nisli's notify already fires once per dirty episode (`wasClean`, `:392-398`) — structurally identical to Watcher's fire-once-until-rewatch. `effect()` could later be reimplemented over a Watcher, exactly as ADR 0015 anticipated. |
| Batching | None (ADR 0015); microtask coalescing + `flush()` | None; frameworks own scheduling | Aligned by prior decision. |
| untrack | `untrack()` (`:707`) | `Signal.subtle.untrack` | Aligned. |
| Subscription | `.subscribe()` sugar on signals | No subscribe; Watcher is the only subscription primitive | nisli's is sugar over effect — erasable. |
| Disposal / liveness | Effect `dispose()`, component auto-dispose; sources have no lifecycle hooks | `unwatch()`, GC-friendly; `[Signal.subtle.watched]/[unwatched]` **source-side** lifecycle hooks | The only structural gap: nisli sources can't observe "first/last observer". Irrelevant to core behavior; only the lazy `toTC39` variant wants it. Do not add now. |
| Cycles | Throws "Circular dependency detected" (`:276-278`) | Throws on cyclic read | Aligned. |

**Verdict**: no divergence that makes future migration painful. The core is semantically closer to the proposal than most shipping frameworks. The single cheap, behavior-preserving forward-compat tweak available is an optional `equals` parameter on `signal()`/`computed()` — worth batching into some future core train, not worth a dedicated change now.

## Adapter design

Two directions, both living outside core. Polling is a non-starter for `fromTC39`: wrapping `tc39.get()` in a nisli `computed()` registers **zero nisli sources**, so the computed would never invalidate. Invalidation must be Watcher-driven.

### `fromTC39(sig, opts?) → { signal: ReadonlySignal<T>, dispose(): void }`

```ts
export function fromTC39<T>(sig: Signal.State<T> | Signal.Computed<T>) {
  const version = signal(0);            // nisli-side invalidation source
  let needsProcess = true;
  const w = new Signal.subtle.Watcher(() => {
    // Sync during a foreign .set(); no TC39 signal access allowed here.
    // Writing a NISLI signal is legal and safe: nisli writes only push
    // dirty flags + schedule a microtask; nothing user-visible runs sync.
    version.value = version.peek() + 1;
    if (needsProcess) { needsProcess = false; queueMicrotask(rewatch); }
  });
  function rewatch() { needsProcess = true; w.getPending().forEach(c => c.get()); w.watch(); }
  w.watch(sig);
  const out = computed(() => { version.value; return sig.get(); });
  return { signal: out, dispose: () => w.unwatch(sig) };
}
```

- **Glitch-freedom**: TC39 has no batch — two sequential `.set()`s each fire notify. Both version bumps coalesce into one nisli microtask flush; nisli effects then pull `sig.get()` at run time and observe only the settled TC39 graph. No torn pairs across the boundary.
- **Re-watch hazard**: notify fires once per watch episode; the canonical polyfill pattern defers `getPending()` + argument-less `w.watch()` to a microtask. The version bump stays in notify (nisli-side, legal) so coalescing with same-tick nisli writes is preserved.
- **Double-scheduling**: one extra microtask hop worst-case (foreign consumer's queue + nisli's), still pre-paint. No re-entrancy: nisli never runs effects synchronously inside the foreign `.set()`.
- **Errors**: a throwing TC39 computed rethrows through `out.value` into nisli's effect containment — correct by construction.
- **Disposal**: explicit `dispose()`; inside component setup the adapter can auto-register it via core's exported context surface (`hasContext`/`getCurrentComponent`) for `effect()` parity.

### `toTC39(nisliSig) → { signal: Signal.State<T>, dispose(): void }` (v1: eager mirror)

```ts
export function toTC39<T>(src: ReadonlySignal<T>) {
  const mirror = new Signal.State(src.peek());
  const dispose = src.subscribe(v => mirror.set(v));  // effect underneath
  return { signal: mirror, dispose };
}
```

- **Scheduling**: nisli writes settle in nisli's flush; `mirror.set()` fires Watcher notifies synchronously *inside that flush*, and foreign consumers' microtasks run after it completes — they see all mirrors settled. `flush()` also makes the mirror synchronously fresh, matching the documented sync-boundary idiom.
- **Error hazard (real divergence)**: if `src` is an erroring nisli computed, the subscription effect's containment swallows the throw and the mirror silently keeps its last good value. TC39 consumers cannot observe nisli error states. Document it; a v2 could mirror through a rethrowing `Signal.Computed`.
- **Laziness**: v1 keeps one live nisli effect per bridge even with zero TC39 watchers. The refinement is `[Signal.subtle.watched]/[unwatched]` options starting/stopping the subscription (with a re-sync `set` on watch). Defer — demand does not justify it.
- **Echo loops**: bridging the same logical state both directions creates a write cycle. Both sides' `Object.is`/`equals` cutoffs break convergent echoes (`:189` plus State's default equals); divergent transforms would trip N301 exactly as an in-nisli loop would. Document; do not guard specially.

## Packaging

**Recommendation: a separate tiny package (`@nisli/interop-tc39`), not a core subpath.**

- ADR 0019's subpath-exports plan is unimplemented; hanging the adapter on `@nisli/core/interop` would make this bet depend on that backlog item and put polyfill-versioning churn inside core's release cadence.
- `signal-polyfill` is 0.x and self-declared unstable; a separate package can pin/bump it without touching core's version stream. Core keeps its zero-dependency claim untouched — zero bytes, zero deps.
- `signal-polyfill` as an **optional peer dependency** (`peerDependenciesMeta.optional: true`). The app must own exactly one polyfill instance: Lit Labs bundles it as a direct dep and its README warns duplicated copies silently break interop. A peer contract is the only correct posture; a direct dep would risk the very split-brain it warns about.
- ~120–180 LOC source; types import `signal-polyfill` types only.

## Hold-vs-adopt: the August 2026 call

**Hold the core (re-confirm ADR 0015).** Two years without plenary advancement, a polyfill frozen since Jan 2025 that says "do not use in production", no engine implementation, and a consumer ecosystem of exactly one Labs-tier package. Rewriting a working, well-guarded 793-line core against that target buys nothing and risks the diagnostics investment (N301/N302/N303/N310, deterministic flush order). The semantic diff shows migration cost is already low and not growing.

**Adapter timing: spec now, build on first request.** Interop value today is speculative — no known nisli consumer ships polyfill-based components. This brief *is* the spec; building it is 1–2 days whenever demand appears.

**Tripwires (write into the ADR so it self-updates):**

1. **Stage 2** (per official `tc39/proposals` listing) → graduate this brief to an ADR with the adapter API frozen; still no core changes.
2. **Polyfill stability signal** (1.0, or a published stability commitment, or Stage 2.7) → build and publish `@nisli/interop-tc39`.
3. **Stage 3 + any engine ships behind a flag** → open the core-native ADR: `effect()` reimplemented over Watcher, `flush()` → `defaultWatcher.flush()` (ADR 0015's escrowed path), `isSignal` extended to native instances.
4. **First concrete request** (a user shipping `@lit-labs/signals` components asks for nisli interop) → build immediately from this spec, regardless of stage.
5. **Negative tripwire**: proposal marked inactive/withdrawn, or reaches 4 years without plenary presentation (June 2028) → close the bet, delete the spec reference.

## Risks & open questions

- **Polyfill API drift**: adapter targets 0.2.2; any 0.3 could break `Watcher` semantics. Mitigated by peer-dep pinning and the build-on-demand posture.
- **Cross-instance detection**: no standard way to detect a `Signal.State` from a *different* polyfill copy (`instanceof` fails). Open question for the adapter's input validation; likely "document, don't detect".
- **Error opacity in `toTC39`** (above) — accept and document in v1.
- **`tick()` coverage**: bridging adds microtask hops; `tick()`'s task-boundary drain (`:781-785`) should cover them, but this is exactly what the verification plan must prove.
- **Naming**: `@nisli/interop-tc39` vs waiting for ADR 0019 subpaths — revisit if subpaths land first.

## Verification plan (cross-library glitch tests)

1. **Forward diamond**: one `Signal.State` → two `Signal.Computed`s → both `fromTC39` into one nisli effect. Two sequential `.set()`s: assert exactly one effect run after `tick()`, never a torn pair.
2. **Reverse diamond**: one nisli signal → `toTC39` → TC39 computed reading mirror + a second mirror; drive the polyfill's canonical effect. Assert settled-only observations.
3. **`flush()` boundary**: nisli write → `flush()` → synchronous `mirror.get()` is fresh.
4. **Error paths**: throwing TC39 computed contained by nisli effect (recovery included); erroring nisli computed's mirror staleness documented by a pinning test.
5. **Echo loop**: bidirectional bridge, convergent writes terminate silently (N301 quiet); divergent transform trips N301, not a hang.
6. **Disposal**: after `dispose()`, foreign `.set()` triggers no nisli work and vice versa; component auto-dispose parity.
7. **Re-watch discipline**: N sequential foreign writes across separate tasks each invalidate (regression against the fire-once-per-episode trap).

## Size estimate

Smallest bet in the sweep. Spec (this brief → ADR): **0.5 day, done**. Build when tripped: adapter ~150 LOC + ~350 LOC tests + package scaffolding — **1–2 engineer-days**. Optional core `equals` option (batched later): ~0.5 day. Core changes now: **zero**.
