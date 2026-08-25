# Bet 09 — Four Small Runtime Wins

**Status**: Draft investment brief (August 2026 research sweep)

## Context

This bet bundles four independently-small platform alignments that share one constraint and one philosophy. The constraint: `@nisli/core` measures **12,389 B min+gzip against a 10KB ceiling** (AGN-WAVE1-GATE.md:119–127) — the ceiling stands as the prod-path target, with follow-up **F3** (dev-weight packaging) expected to recover ≥2.7KB. Every proposal below is priced in bytes first. The philosophy: ADR 0019's "thin reactive layer over native Web Components" — adopt platform features by feature detection, never by polyfill, never by bundling.

Platform facts as of August 2026: Explicit Resource Management (ERM) is Stage 4 / ES2026 — native in V8/Chrome 134+, Firefox 134+, and landed in Safari Technology Preview 250, stable imminent; TypeScript has supported `using` since 5.2. `scheduler.yield()` is in Chrome 129+ and Firefox 142+, **missing in Safari**. The Sanitizer API's safe `Element.setHTML()` shipped in Firefox 148 (Feb 2026) and Chrome 146 (Mar 2026), **missing in Safari**; the default sanitizer enforces a baseline XSS-safe policy regardless of config. Chrome 151 stable (Jul 28 2026) ships `soft-navigation` and `interaction-contentful-paint` performance entries unflagged, and web-vitals v6 (Jul 2026) has native SPA support. Two of four features are Chromium+Firefox only — everything here is opt-in, feature-detected, and fails safe.

---

## (a) Explicit resource management: `using` on nisli disposables

### Current state

Every nisli disposal surface is a plain function or a `dispose()` method:

- `effect()` returns a dispose closure — `packages/core/src/signal.ts:649` (closure built at 658–671; auto-registered with the owning component via the context hook at 674–679).
- `resource()` returns `ResourceResult` with `dispose()` — `packages/core/src/resource.ts:23` (impl at 46–52, component auto-registration at 57–59).
- `query()` returns a result with `dispose()` — `packages/core/src/query.ts:499–511` ("standalone callers; component setup auto-disposes", query.ts:22).
- `Emitter.on()` returns an unsubscribe function — `packages/core/src/emitter.ts:58–80`.
- `signal.subscribe()` / `computed.subscribe()` return unsubscribe — signal.ts:216–224, 403–408.
- `onCleanup()` — `packages/core/src/lifecycle.ts:62–69`; component teardown drains `disposers` — `packages/core/src/component.ts:251–266`.

Inside `setup()` none of this needs ERM — auto-disposal already wins. The gap is **standalone call sites**: tests, services, imperative integrations, where `const d = effect(...); try {...} finally { d(); }` is the manual idiom `using` was designed to replace.

The monorepo `tsconfig.json` targets `ES2022` with `lib: ["ES2022"]` — **`Symbol.dispose` is not in that lib**, so today neither core source nor emitted `.d.ts` can mention it.

### Design sketch

One internal helper, applied at each return site:

```ts
// signal.ts (or a shared micro-module)
const DISPOSE = Symbol.dispose as typeof Symbol.dispose | undefined;
function disposable(fn: () => void): Disposer {
  if (DISPOSE) (fn as Disposer)[DISPOSE] = fn;
  return fn;
}
```

`effect()`, `Emitter.on()`, and `subscribe()` wrap their returned function; `resource()`/`query()` results get `[Symbol.dispose] = dispose` on the result object the same guarded way. Then `using e = effect(...)` and `stack.use(query(...))` (native `DisposableStack`) both work — any object with the well-known symbol composes with `DisposableStack` for free, so nisli ships **no** stack abstraction of its own.

Decisions made honestly:

- **No polyfill, ever.** No `Symbol.dispose ??= Symbol(...)` — mutating globals from a library is disqualifying. The guard means: on an engine without ERM the property is simply absent, and `using` syntax wasn't available there anyway.
- **TS downlevel emit is the consumer's problem, documented.** TS 5.2+ can downlevel `using` for consumers on older targets, but its emitted helpers require `Symbol.dispose` to exist at runtime (TS documents the polyfill requirement). nisli documents: "native ERM engine or bring your own polyfill in the app, not in nisli."
- **Typing**: add `"ESNext.Disposable"` to `lib` in tsconfig (type-only, zero runtime bytes). Public return types use a structural `Disposer` interface (`{ (): void; [Symbol.dispose](): void }`) so consumers without the lib entry degrade to a callable — verify `.d.ts` output doesn't force the lib on consumers; if it does, publish the symbol member as optional.

### Byte cost

~60–100 B min+gzip total (one helper + five one-line call-site wraps). Effectively free.

### Fallback

Engines without `Symbol.dispose`: property never attached, all existing call/`.dispose()` semantics unchanged. Zero behavioral delta.

### Tests

- Environment-gated (`typeof Symbol.dispose === 'symbol'`, true on current Node): `using e = effect(...)` — block exit stops reactivity; double-dispose idempotence (dispose closures already guard).
- `DisposableStack.use(resource(...))` disposes on stack disposal.
- Type-level (`signal.test-d.ts`): returned value assignable to `Disposable`.
- A guard test that the symbol property equals the function itself (aliasing, not a second path).

---

## (b) Opt-in `scheduler.yield()` time-slicing in the flush path

### Current state

`flush()` — signal.ts:728–746 — synchronously drains effect cascades in a `while (pendingEffects.size > 0)` loop, bounded by a 100,000-pass N303 guard. Passes run effects in creation order (ADR 0015 / ADR 0030.2 T5, signal.ts:124–135). `tick()` (signal.ts:770–792) already crosses **macrotask** boundaries via `setTimeout(0)` between drain iterations. ADR 0019:131–135 keeps signal scheduling on `queueMicrotask()` and rejects `scheduler.postTask()` as core — that rejection **stands**; nothing here touches how effects get scheduled.

### Design sketch — and an honest recommendation

`flush({yield: true})` is the wrong shape. `flush()`'s entire contract (ADR 0015: "point-in-time API for synchronous effect execution") is that the next line sees settled DOM; `scheduler.yield()` is `await`-only, so a yielding flush must return a Promise — a conditional sync/async API is the classic red/blue split and would silently break every `flush(); measure()` call site and test. **Do not touch `flush()`.**

The honest shapes, in preference order:

1. **`flushAsync(): Promise<void>`** — a new additive export: per drain pass, run `flushPendingEffects()` then `await scheduler.yield()` when present (feature-detect once), falling back to a `MessageChannel` macrotask hop (a real yield; `setTimeout(0)` is clamp-prone), then loop until quiescent under the same N303 pass cap. Semantics differ from `flush()` and must be documented: external writes landing during a yield **join the current drain** rather than the next microtask flush. Per-pass creation-order determinism is preserved; cross-pass interleaving is inherently timing-dependent — that is the price of yielding, stated plainly.
2. **`tick()` only** — swap its `setTimeout(0)` crossing for `scheduler.yield()` when present. Nearly free, but `tick()` is a test/verify primitive; production long-cascade INP wins don't flow through it. Cosmetic.

**Recommendation: defer building either until a workload proves cascades exceed ~5ms.** In a fine-grained model, cascades are typically shallow (signal → few effects); nisli has no measured evidence of long-task flushes. This is the weakest quadrant of the bet: keep the design on the shelf, spend the bytes only against a profile. If built, build shape 1, post-F3.

### Byte cost

0 B now (deferred). If built: ~200–250 B min+gzip (`flushAsync` + detect + MessageChannel fallback).

### Fallback

Safari (no `scheduler.yield`): MessageChannel hop — identical semantics, slightly coarser scheduling. Never a behavioral fork, only a scheduling-quality one.

### Tests

- `flush()`/`tick()` regression suites pass byte-identical (no change is the test).
- If built: `flushAsync` with a stubbed `scheduler.yield` (present/absent), creation-order within passes, writes-during-yield join the drain, N303 cap fires loudly, `settle()` interplay (settle.ts awaits `tick()` — `flushAsync` must not wedge it).

---

## (c) Narrowing `html:inner` via `setHTML()` / Sanitizer

### Current state

`html:inner` accepts **only** `raw()`-branded values (`RawHtml`, template.ts:63–75; brand check 77–85); a bare string throws N106 (template.ts:871–875). The sink is a direct `el.innerHTML =` assignment (template.ts:889 reactive, 894 static) inside `bindInnerHtml` (862–896). ADR 0019:124–128 explicitly pre-authorized this move: *"If `Element.setHTML()` becomes broadly available, it can be feature-detected inside that trusted path."* Firefox 148 + Chrome 146 shipped it; Safari hasn't. "Broadly available" has arrived for two of three engines — enough for an opt-in second brand, not enough to change the default.

### Design sketch

Keep `raw()` as the untouched author-asserted-trust seam. Add a parallel brand for *untrusted* markup:

```ts
export interface SanitizedHtml { value: string; __sanitize: true }
export function sanitized(value: string): SanitizedHtml;
export function setSanitizerFallback(fn: (el: Element, html: string) => void): void;
```

`bindInnerHtml` resolution becomes a three-way branch: `RawHtml` → `innerHTML` (today's path, byte-identical); `SanitizedHtml` → `el.setHTML(value)` when `'setHTML' in Element.prototype` (safe default sanitizer — strips scripts, event handlers, dangerous URLs unconditionally); otherwise the registered fallback hook (app wires DOMPurify: `setSanitizerFallback((el, s) => { el.innerHTML = DOMPurify.sanitize(s) })`). **No native support + no hook = throw a coded error (N107). Fail closed — never silently downgrade untrusted markup to `innerHTML`.** nisli never bundles a sanitizer; the hook keeps the byte budget clean and the trust decision in the app.

Trusted Types note: under CSP `require-trusted-types-for 'script'` (Chromium + Firefox), the `raw()` path's `innerHTML` assignment with a plain string throws. `setHTML()` is exempt (it sanitizes). Cheap companion: let `html:inner` also pass through native `TrustedHTML` objects (detected via `trustedTypes?.isHTML`) on the raw branch (~40 B), so TT-enforcing apps can use policy-created values without wrappers. Document; make the pass-through part of this work.

### Byte cost

~250–300 B min+gzip (brand + `sanitized()` + branch + detect + hook registry + N107), +~40 B for TrustedHTML pass-through.

### Fallback

Safari / older engines: documented DOMPurify hook; absent hook, loud coded throw. `raw()` users see zero change.

### Tests

- happy-dom/jsdom lack `setHTML`: stub `Element.prototype.setHTML` to assert it is called with the unwrapped string (and `innerHTML` is *not* touched); delete the stub to exercise hook and fail-closed N107 paths.
- Reactive `Signal<SanitizedHtml>` path mirrors existing signal-of-RawHtml tests (eager initial validation, effect containment for later bad values).
- N106 for bare strings unchanged; mixed brand (object with both flags) rejected.
- One real-browser sweep case (www guard) in Chrome/Firefox asserting `<script>`/`onerror` stripping by the native default sanitizer.

---

## (d) Soft-navigation metrics readiness in `@nisli/router`

### Current state

Chrome 151's heuristic attributes a soft navigation when a **user interaction** (click or keyboard) leads to a **URL change** (history change) and a **DOM modification with paint** — in any order, joined by task attribution across microtasks and awaited promise continuations; the first soft nav additionally requires paint ≥ ~20% of pre-first-interaction paint. The router's shape is already nearly ideal:

- Link clicks are intercepted in `onDocumentClick` (packages/router/src/router.ts:408–420); `navigateSameOrigin` runs **synchronously in the click task** and calls `history.pushState`/`replaceState` immediately (router.ts:244–247) *before* any `await` — the URL change lands squarely in the interaction's task context. This ordering is load-bearing; pin it with a comment/test.
- DOM modification flows from the awaited `transition()` (router.ts:276–335) setting `connection.rendered.value` (323), through the outlet template's effect (application.ts:74–82) on the microtask flush — paths Chrome's task attribution tracker follows.

### Design sketch

**Zero mandatory runtime bytes.** Three deliverables:

1. **Verification, not code**: extend the www sweep harness (`pnpm sweep`, Playwright, Chrome 151+) with a guard that clicks a nav link and asserts a `PerformanceObserver({type: 'soft-navigation', buffered: true})` entry with the target URL, plus an `interaction-contentful-paint` entry after a second navigation. This empirically settles the two open attribution questions: whether async route renderers (dynamic import / fetch before `rendered.value`) and the `queueMicrotask` in `applyNavigationEffects` (router.ts:390–405) stay inside the attribution window.
2. **Docs recipe** (packages/www, not a dependency): web-vitals v6 with native SPA support for per-route LCP/INP, joined to the router via its reactive `url` signal — fine-grained rendering is exactly the architecture that looks good under a per-route lens; measure it, publish the numbers.
3. **Known non-navigations, documented**: programmatic `navigate()` outside interactions, redirect hops (replace semantics, router.ts:293–295), and hash-only changes (early return, 415) won't attribute — correct per the heuristic, worth a docs paragraph so users don't file bugs.

Optional dev-only `performance.mark('nisli:nav:'+name)` instrumentation is **rejected**: it duplicates what the platform entries now provide.

### Byte cost

0 B runtime. Harness + docs only.

### Fallback

Firefox/Safari expose no soft-navigation entries: the recipe feature-detects `PerformanceObserver.supportedEntryTypes`; nothing in the router itself depends on the API.

### Tests

The sweep guard above (Chromium-only, engine-gated); a unit test pinning pushState-before-first-await ordering in `navigateSameOrigin`.

---

## Interactions

- **Size budget / F3**: the gate ruling accepts interim overage (12,389 B) with F3 recovering ≥2.7KB toward the 10KB ceiling. This bet's mandatory adds total **~0.35–0.45KB**, and (b) adds ~0.25KB more if ever built. Discipline: (a) is small enough to land pre-F3; (c) — and (b) if resurrected — should land **after** F3's re-measure so the ceiling math stays legible.
- **ADR 0015 consistency**: `flush()` stays synchronous and point-in-time; no conditional-async flush, no `batch()` resurrection. `flushAsync` (if built) is additive and separately named.
- **ADR 0019 consistency**: `scheduler.postTask`-as-core stays rejected — (b) uses `yield` only inside an opt-in manual drain, never in `scheduleFlush`. (c) is the execution of ADR 0019's own written intention (lines 124–128), a decade — er, six months — after the "not yet broadly available" caveat expired for two engines.
- **Bet 03 (Navigation API interception)**: interception hands the browser explicit navigation intent, making soft-nav attribution *more* robust and removing sensitivity to pushState timing. (d)'s sweep guard becomes the regression net for that migration — build (d) first precisely so bet 03 has something to not break.

## Risks & open questions

1. **Safari holes** ((b), (c)) mean permanent feature-detect branches. Acceptable under ADR 0019's enhancement doctrine, but (c)'s fail-closed throw means Safari-targeting apps *must* wire the DOMPurify hook — is a loud N107 in production the right default, or should dev-mode warn earlier? (Recommend: dev-mode N-diag at `sanitized()` creation when neither path exists.)
2. **`.d.ts` leakage** ((a)): does publishing `Disposer` force `ESNext.Disposable` lib on consumers? Needs an emit check before committing to the public type.
3. **Drain semantics** ((b)): writes-during-yield joining the current drain is a real observable difference; if any consumer conflates `flushAsync` with `flush`, ordering bugs follow. Mitigation: don't build it yet.
4. **Heuristic churn** ((d)): the soft-navs heuristic changed repeatedly through its origin trials (paint thresholds, keyboard support). The sweep guard should assert *presence*, not entry field minutiae.
5. **Sanitizer interop** ((c)): early-ship config differences between Firefox 148 and Chrome 146 defaults — the design leans on the spec'd XSS-safe baseline only, never custom `SanitizerConfig`, which sidesteps most of it.

## Sequencing within the bet

1. **(a) ERM aliases** — smallest, zero-risk, lands pre-F3.
2. **(d) soft-nav harness + docs** — zero bytes, unblocks bet 03's regression net, and the measurement story is the marketing story.
3. **(c) `sanitized()` path** — after F3's re-measure; executes ADR 0019's standing intent.
4. **(b) `flushAsync`** — **deferred** pending a measured long-cascade workload; design shelved in this brief.

## Size estimate

| Item | min+gzip | When |
|---|---|---|
| (a) `[Symbol.dispose]` aliases | ~0.08KB | now |
| (d) router soft-nav | 0KB | now (harness/docs) |
| (c) `sanitized()`/setHTML + TrustedHTML pass-through | ~0.3KB | post-F3 |
| (b) `flushAsync` | ~0.25KB | deferred, evidence-gated |
| **Committed total** | **~0.4KB** | vs ~2.7KB F3 recovery — fits under the 10KB ceiling |
