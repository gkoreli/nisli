# Bet 05 — `adopt()`: islands-style in-place adoption of prerendered DOM

**Status**: Draft investment brief (August 2026 research sweep)
**Decides**: ADR 0025 §17 (docs/adr/0025-core-proposals-from-ui.md:721–761) — option (a), phased
**Supersedes on acceptance**: ADR 0018 phases 3–4 (hydration markers + client hydration), which stay unimplemented

## Context

The field verdict from the sweep is blunt: full-page remount of prerendered markup is below 2026 table stakes. Qwik-style resumability proved unnecessary in practice; Astro's islands model — static HTML plus independently mounting interactive islands, with no flicker and no lost input — is the settled minimum. nisli today is *below* that minimum: the SSG pipeline produces real, fully rendered HTML (a genuine strength — light DOM, no declarative-shadow-DOM folklore), and then the client throws that work away. Worse, the naive path is actively broken: globally registering a custom element over prerendered markup **double-renders** (the WWW-14 invariant), so `packages/www` had to hand-roll a replace-based frame that discards the SSG DOM wholesale — re-render-without-flicker, not adoption; any user state in the prerendered markup (typed input, focus) is lost.

This is the largest internals bet of the sweep. It is also the one the codebase has been quietly preparing for: ADR 0030.2 explicitly sequenced three enablers "with it in mind" (§5, docs/adr/0030.2-agent-native-core-ergonomics.md:257–267), and T4 (parse-once templates) has now landed. The question ADR 0025 §17 left open — should `@nisli/core` own an adoption primitive? — is answerable with a concrete design.

**Out of scope, explicitly**: streaming SSR, server components, per-request SSR, and any DOM-free server `html()` implementation. nisli's SSG renders with the *real client runtime* inside happy-dom; this bet keeps that single-runtime property and builds adoption on it. ADR 0018's two-implementation SSR pipeline is not being revived.

## Current state in nisli (verified against source)

**SSG pipeline.** `renderToHtml()` (packages/ssg/src/core-render.ts:59–94) boots a happy-dom `Window` (packages/ssg/src/environment.ts:35–47), mounts the live `TemplateResult` into a host div, awaits `tick()` so microtask work settles (projection sweeps, query/command passes — core-render.ts:55–58), then snapshots `host.innerHTML`. Crucially, `serializeHost()` **strips the runtime marker comments** — `RUNTIME_MARKERS = /<!--(?:slot|tpl|list|each)-(?:start|end)-->/g` (core-render.ts:15–19). Published HTML has no binding anchors. Note what it does *keep*: `<each-item style="display: contents">` wrapper elements (template.ts:1104–1105) survive serialization, as does the `style="display: contents"` that `transparentHost()` writes on every registry host (packages/www/src/nisli-ui/lib/utils.ts:123–125) — SSG output already carries pre-upgrade layout transparency. `buildStaticSite()` (packages/ssg/src/build.ts:144–185) writes pages route by route. A separate DOM-free string renderer exists (packages/ssg/src/render.ts:54–71, `staticHtml`) for non-component fragments.

**Why upgrade-in-place double-renders (the WWW-14 class).** `connectedCallback` (packages/core/src/component.ts:466–609) runs SEED → CAPTURE → CONTEXT → setup. CAPTURE (component.ts:490–494) snapshots `this.childNodes` as presumed *author* content; `mountTemplate` then **appends** the fresh template (component.ts:514–516, 854). Over prerendered markup, the snapshot is actually the component's own previous render output, so: a projecting component captures its old rendered tree and projects it *inside* the new one (`children()` consumes the capture, projection.ts:104–114); a non-projecting component leaves the old children in place and appends a duplicate beside them. Both are the double-render WWW-13/WWW-14 shipped. The root cause is one missing bit: **connect cannot distinguish "these children are my prior render output" from "these children are author content."**

**www's hand-rolled workaround.** packages/www/src/client/hydrate.ts:1–24 records the invariant in its header ("the naive upgrade-in-place path re-mounts on top of the SSG children"); an IntersectionObserver with `rootMargin: '128px'` (hydrate.ts:60–78) finds `[data-preview=name]` frames (emitted at packages/www/src/pages/ui-component.ts:51) and calls `hydrateFrame()` (packages/www/src/client/hydrate-frame.ts:18–33): `data-hydrating` sync lock → load module → `frame.replaceChildren()` → mount live → `data-hydrated`. On failure the static baseline is untouched and the frame stays retryable. This is the "clean/bounded corpus for the possible @nisli/core adopt-in-place graduation" its own comment promises (hydrate.ts:21–23) — but it is frame-level replacement: SSG DOM and any user state in it are discarded.

**Enablers, landed and queued.**
- **T4 landed**: `parseTemplate()` caches the parsed `<template>` per `TemplateStringsArray` (template.ts:101, 122–160). For a given callsite, the marker positions (`<!--bk-N-->`, template.ts:164–175) and the static DOM shape are now deterministic and shared — the claim map any `adopt()` needs exists.
- **Attrs reactivity landed**: declared attributes are `observedAttributes`-wired; SEED (`_seedAttrs`, component.ts:453–458) reads current attributes into prop signals before setup, with pin-precedence for factory props (component.ts:681–729). An adopted host's attributes are already a working initial-state channel.
- **T3 queued** (schema-as-single-truth, 0030.2 Wave 3): makes attribute state the *declared* single truth an adopted DOM is read back from, and gives the SSG emitter a manifest of which attributes are state-bearing.
- **T6 landed**: contained failures stamp `data-nisli-error="N4xx"` + bubble `nisli-error` (component.ts:541–607); diagnostics leaf with the code registry exists (packages/core/src/diagnostics.ts:41–69).
- **Gated in 0030.2 §4**: upgrade-order-safe `inject` deferral (`whenDefined(providerTag)`) — explicitly parked *on this disposition*, because island loading is where the provider-not-yet-defined race goes live (element-context resolves by `parentElement` walk at setup, element-context.ts:107–116).

**ADR 0018** (Proposed, unimplemented) designed a full parallel universe: server `html()`, server component registry, versioned `nh-*` hydration marker contract, `defer-hydration`, mismatch warnings. None of it landed; the SSG that *did* land (happy-dom snapshot of the real runtime) obsoleted phases 1–2's approach.

## Proposed design

### The governing principle: recompute, don't serialize

Because SSG mounts the **same code** with the **same attribute-derived state** the client will run, almost everything a hydration marker would encode is *recomputable on the client*: the static DOM shape comes from T4's cached parse; binding positions come from the deterministic `processNode` walk order (template.ts:300–330); expected slot contents come from re-running setup and reading the signals. The one thing the client genuinely cannot recompute is **provenance** — which prerendered nodes were authored by the page (projected light-DOM content) versus rendered by the component.

So the decision on the marker question: **do not keep runtime markers in published HTML.** No `slot-start`/`bk-N` retention, no ADR 0018 `nh-*` contract — that contract is versioned server/client coupling (0018's own gotcha 6) buying information we can recompute. The only additions to SSG output for adoptable islands are (1) one flag attribute per island host and (2) a single provenance comment pair around `children()` projection regions inside islands. Everything else is bytes-identical to today's clean output.

### Island declaration: the component tag *is* the island

`renderToHtml(value, { islands: true })` (threaded from `buildStaticSite({ islands: true })`) walks the settled happy-dom tree before snapshot and stamps every framework component host with `data-nisli-adopt="1"` (protocol version; unknown versions fall back to the P1 path, which is version-independent by construction). Custom elements upgrade naturally when their module loads — no wrapper element, no island component, no registry of mount points. Additionally, in islands mode `children()` brackets its projected light-DOM nodes with `<!--nisli:ch-->…<!--/nisli:ch-->` so author content survives with provenance (~24 bytes per projecting island; components whose slot content came from the factory/template need nothing).

On the client, `connectedCallback` gains one branch: if the host carries `data-nisli-adopt` and has children, take the **adopt path** instead of fresh-mount. This is the WWW-14 fix at its root — the missing provenance bit now exists, so "globally registering custom elements over prerendered markup" stops being a footgun *by construction*: adopt-flagged children are treated as prior render output; unflagged children remain author content and capture/project exactly as today.

### Phase 1 — attribute-seeded in-place replace with continuity carry

P1 ships the Astro-minimum (no flicker, no lost input, state continuity) without touching the template engine. Adopt path, in order:

1. **SEED** from attributes as today (attrs now; T3 schema when it lands). The UI-30 attribute-as-truth pattern means `open`, `checked`, `value` in the snapshot *are* the state — continuity is the existing precedence machinery, not a new channel.
2. **Recover author content**: lift the `<!--nisli:ch-->` region (if present) out of the prerendered subtree and install it as `__capturedChildren`; skip the naive CAPTURE.
3. **Run setup and mount the template into a detached fragment** (bindings work detached — the slot effect resolves `endMarker.parentNode` live, template.ts:518–521).
4. **Snapshot interactive state** from the prerendered subtree: active element (identified by `data-slot` + index path — the registry stamps `data-slot` on every rendered element per ADR 0022), input/textarea/select `value`/`checked`/selection range, scroll offsets of scrollable `data-slot` regions.
5. **Atomic swap**: `host.replaceChildren(fragment)`. This happens synchronously inside the upgrade task — the browser cannot paint between the old and new subtree, so when server and client render agree (the normal case) there is zero flicker.
6. **Restore interactive state** onto the matching fresh nodes; then the projection phase, `onMount`, and success stamping: `data-nisli-adopt` is replaced by `data-nisli-adopted="replace"` — a DOM fact, per the house T6 style, queryable by tests and agents.

Everything before step 5 leaves the prerendered baseline untouched — the failure contract is inherited from `hydrateFrame` (baseline intact, retryable) and is *stronger* than the current fresh-mount boundary, which destroys children before showing the fallback.

P1's honest limits: DOM node identity inside the island is not preserved (CSS animations restart; an iframe inside an island reloads; selection in non-form content is lost). Named form/focus/scroll state is carried, which covers the field-verdict bar.

### Phase 2 — claim-walk adoption (bind to existing DOM)

P2 makes the swap unnecessary where server and client agree, preserving node identity. New engine capability: `TemplateResult.mount(host, { adopt: childNodes })` — `template.ts` walks the **pristine cached parse** (which still carries `bk-N` markers and raw `@event`/`class:` attributes) in lockstep with the existing DOM, instead of walking a fresh clone. Sketch of the claim walk:

- **Elements**: lockstep by `(nodeType, tagName)`. Marker-bearing attributes are read from the pristine template node but *applied to the existing element*: event bindings `addEventListener` on it, attribute/class effects attach with a first-run compare-and-skip (don't rewrite an attribute that already holds the expected value), `ref`s point at it. The element is claimed; recurse.
- **Text with embedded expressions**: the template knows the exact static strings; setup has run, so expected slot values are readable (untracked). Compute the expected serialized text, then *split* the existing (parser-merged) text node at the known static-prefix/suffix boundaries — this is the classic text-boundary problem hydration markers exist to solve, solved instead by expected-value splitting. Claimed region becomes the binding's live `Text` node; fresh `slot-start`/`slot-end` comments are inserted around reactive child regions *at claim time* (the runtime needs its anchors live; it never needed them shipped).
- **Reactive child slots / `when()`**: evaluate the current value (the same value SSG rendered, state being attribute-derived); delimit the region by the next expected static sibling; claim recursively with the value's own template. `when()`'s boolean gate (template.ts:1152–1185) evaluates the same branch the server took.
- **`each()`**: the `<each-item style="display:contents">` wrappers survived serialization — claim them positionally in current-array order (keys re-derived by running `keyFn` over the adopted items), insert fresh `each-start`/`each-end` anchors, recurse per wrapper.
- **Nested component hosts**: opaque boundaries. Claim the host element itself (attributes/events), do not descend — the child island adopts itself at its own upgrade.
- **Any desync** — tag mismatch, region underrun/overrun, expected-text mismatch: **splice-repair**. Render just that region fresh (the engine already knows how — it's the slot mounter), replace the unclaimed nodes, emit dev diagnostic `N410` naming the component, slot index, expected and found. Containment is per-region, not per-island; a whole-island desync falls back to the P1 replace path (`N411`). Success stamps `data-nisli-adopted="claimed"` (or `"repaired:<n>"`).

P2 lands behind a subpath entry (`@nisli/core/adopt`, per the §7 dev-entry precedent) so apps that never adopt pay zero bytes on `.`; `component.ts` carries only the ~15-line hook that dispatches to an installed adopt handler.

### Loading strategies and island lifecycle

Promote www's proven loader shape into a small lib item (registry `lib/islands.ts`, copy-in per ADR 0022 discipline — it is consumer wiring, not engine):

```ts
islands({
  load: { 'ui-accordion': () => import('./ui/accordion.js'), … }, // derived, not curated (WWW-15)
  strategy: { default: 'visible', 'site-search': 'eager' },        // visible | idle | eager
});
```

It scans `[data-nisli-adopt]`, groups by tag, and schedules module loads: `visible` via IntersectionObserver with the www-proven `rootMargin: '128px'`; `idle` via `requestIdleCallback`; `eager` immediately. Honest platform note: `customElements.define` upgrades **all** instances of a tag document-wide, so per-instance laziness is per-*tag* — the first visible instance triggers adoption of every instance. That is the platform's granularity and it's fine; the win of `visible` is deferring the module fetch, which is where the cost lives. Failure keeps `data-nisli-adopt` in place (retryable on next intersection, `hydrateFrame`'s re-observe contract).

**Upgrade order**: if an outer island's module defines first, its P1 replace fresh-mounts descendants (normal path — their flags left with the replaced DOM); under P2 claiming, an already-adopted inner host is claimed by identity and survives. If an inner island defines first and `inject()`s context from a not-yet-defined provider, that is exactly the gated 0030.2 §4 item: the adopt path defers a child island's setup on `customElements.whenDefined(providerTag)`. This bet un-gates that item and lands it as part of P1.

## Implementation plan

1. **Gate packet** (0025-process design gate): this brief + a P1 prototype on one overlay component (`ui-switch` or `ui-accordion`) proving seed-from-attributes + swap + input carry in a real browser.
2. **P1 core** (`component.ts` adopt branch, author-content recovery, continuity carry) + **SSG islands mode** (`core-render.ts`: stamp hosts, retain `nisli:ch` provenance pair — the only change to `serializeHost`) + **loader lib item**. New codes `N410`/`N411` in the diagnostics registry (N4xx range, diagnostics.ts:46).
3. **www migration** (the second-consumer proof): previews and the mobile-nav chrome move from `hydrateFrame` replace to islands; `hydrate-frame.ts` retires; the derived-loader logic (WWW-15) survives unchanged as the `load` map. Deploy after verdict, per house rule.
4. **P2 engine** (`@nisli/core/adopt` subpath: claim walk in template layer, splice-repair) behind its own gate, with the adopt-equivalence sweep (below) green first.
5. **ADR bookkeeping**: new ADR marks 0018 Superseded (graduating `defer-hydration`'s *concept* as `data-nisli-adopt` + strategies, and the mismatch-detection *goal* as splice-repair; explicitly not graduating the `nh-*` marker contract, server registry, or dual `html()`); 0025 §17 dispositioned as option (a), with (b)'s failure contract absorbed.

## Fallback & failure containment

Failure ladder, each level contained and DOM-visible (T6 discipline):

- **Module load fails** → loader leaves baseline + flag, retryable (www contract, hydrate-frame.ts:27–32).
- **P2 region mismatch** → splice-repair that region, `N410` dev diag, `data-nisli-adopted="repaired:n"`. Mismatch is *contained re-render*, never a broken half-hydrated tree and never a silent lie.
- **P2 island desync** → fall back to P1 replace (`N411`).
- **Setup/mount throws during adoption** → the prerendered baseline is still intact (nothing detached before the swap), so containment is: keep static DOM, stamp `data-nisli-error="N401|N402"` per the existing boundary (component.ts:541–607), dispatch `nisli-error`. This deliberately *diverges* from the fresh-mount boundary (which clears children and mounts a red fallback): for an island, degraded-static beats error-box. `_remount()` remains the documented reset and re-enters the adopt path while the flag persists.

Every terminal state is a queryable attribute — `[data-nisli-adopt]` (pending), `[data-nisli-adopted]` (succeeded, with mode), `[data-nisli-error]` (contained failure) — the verify loop and agents read outcomes from the DOM, no log scraping.

## Interactions

- **T4 (landed)** is the load-bearing enabler: per-callsite cached parse ⇒ deterministic claim map. The pristine cached template (which the first-parse audit already inspects pre-strip, template.ts:117–121) is exactly the artifact the P2 walk consumes. The single-mount guard N105 needs an adopt-aware carve-out (adopt is a mount).
- **T3 (queued)** upgrades adoption from "attrs-declared components adopt well" to "the schema is the adoption contract": manifest-driven knowledge of state-bearing attributes, `p.state` seeding semantics identical on server and client. P1 should land against current attrs and get T3 for free; do not sequence P1 behind T3.
- **Bet 04 (cross-document View Transitions)**: the two bets compound. Cross-doc VT makes MPA navigation seamless *up to first paint*; a post-navigation island remount that changes pixels is flicker *after* the transition — precisely what adopt eliminates. P2's node-identity preservation also keeps `view-transition-name` elements stable across adoption. Eager-strategy islands above the fold should adopt before `pagereveal` settles; the VT bet's timing budget should cite this.
- **ADR 0018 graduation boundary** (explicit): graduated — `defer-hydration` as `data-nisli-adopt` + loading strategies; dev mismatch detection as N410 splice-repair; islands vision (0018 "Medium-Term"). Not graduated — server `html()`/`RenderResult`, server component registry, host proxy, `nh-*` versioned marker format, `isServer` authoring split. nisli's one-runtime SSG makes those unnecessary; adopting them would reintroduce the two-implementations-diverge risk 0018 itself flagged (gotcha 8).
- **ADR 0022 transparent hosts**: `style="display: contents"` is already serialized on hosts, so pre-adoption layout is correct and adoption causes no shift; the P2 walk treats hosts as opaque and `parentElement` context walks cross them unchanged (element-context.ts:107–116).
- **Portals**: `portal()` runs at `onMount` inside happy-dom too, so portaled subtrees escape the host snapshot — prerendered islands are missing their overlay content *by construction* (and overlays are closed at build). Under P1 the fresh render simply recreates and re-portals it; under P2 the portal region is one expected splice (present in the fresh template, absent in the DOM) — insert fresh, `onMount` moves it to `document.body`. Rule: portal content is always client-fresh, never claimed. No mismatch class, one documented line.
- **www migration** replaces ~120 lines of hand-rolled machinery with the loader map; the docs sidebar/mobile-nav chrome becomes an ordinary island. WWW-16's per-component example splitting aligns with per-tag loading.
- **Async (T1/T2)**: an adopted island with a `query()`/`resource()` re-fetches on the client; if the build prerendered loaded state, the loading flash is a P2 splice-repair or P1 re-render. The T1 gate's SSG stance (queries terminate before snapshot or are statically disabled) plus attribute-carried data are the current answer; anything richer (serialized cache seeding) is explicitly out of this bet.

## Risks & open questions

1. **Serialization fidelity** (top technical risk): P2's expected-text comparison assumes happy-dom's `innerHTML` → browser-parser round-trip is normalization-stable (entity encoding, attribute order/quoting, whitespace in `<pre>`, boolean attribute forms). Mitigation: normalize comparisons (compare parsed values, not strings, for attributes; `textContent` not markup for text) and rely on splice-repair as the safety net. The adopt-equivalence sweep will surface real divergences early.
2. **Core size budget**: 0030.2 §6 pins `@nisli/core` under 10KB min+gzip with T1 already +1.7KB. P1's connect branch + carry must be measured; the P2 walker *must* live on the `@nisli/core/adopt` subpath (zero `.` bytes). If P1 exceeds ~0.9KB on `.`, move the carry protocol to the subpath too and keep only the branch+dispatch in `.`.
3. **`each()` claiming**: positional wrapper claiming assumes the adopted array equals the rendered array. Attribute-derived state guarantees it today; a T1-fed list will diverge → whole-region splice. Acceptable? (Proposed: yes, documented.)
4. **Author content provenance**: is the `nisli:ch` comment pair enough, or do mixed authored/rendered siblings inside deep slots need it too? (Current claim: `children()` is the single projection slot — ADR 0025 item 1 — so one pair per island suffices; named slots would reopen this.)
5. **Stamp semantics**: does `data-nisli-adopted` survive `_remount()`? Proposed: cleared on teardown, restamped per cycle — the attribute describes the *current* subtree.
6. **Second consumer**: www is consumer one; the blog (0020.2) should be scoped as consumer two before P2 is gated, honoring the second-consumer discipline.
7. **Focus-carry edges**: caret restore in `input[type=email]` etc. (selection APIs throw on some types); IME composition mid-adopt. Bounded best-effort, documented.

## Verification plan

- **Double-render regression (the WWW-14 pin)**: unit — render a projecting and a non-projecting component via `renderToHtml({islands:true})`, re-parse into a client DOM, define the components, `await settle()`, assert exactly one rendered root and no nested duplicate (also pinned in `invariants.test.ts`: *adopt-flagged children are never captured as author content*). This test fails today by construction on the naive path.
- **Adopt-equivalence sweep** (extends `pnpm sweep`, the landed Playwright guard over every /ui preview — rebuild dist first, vitest wipes assets): for every registry preview, compare adopted DOM against a fresh client mount (normalized), and assert `data-nisli-adopted` present with zero `repaired:*` on the golden corpus. Sweep results per house rule only after the harness itself passes review (attestation attached to the rev request).
- **Focus/input preservation E2E**: serve a built page with an artificially delayed island module; type into a prerendered input, focus it; release the module; assert value, focus, and caret survive adoption (P1) and node identity survives (P2: `evaluate` captures the element pre-adopt, compares identity post).
- **No-flicker**: assert no paint between swap halves via CDP screencast frames on a throttled load; weaker but cheap CI proxy: MutationObserver transcript shows a single `replaceChildren` (P1) / zero child-list mutations outside splices (P2).
- **Failure ladder**: forced module 404 (baseline intact, retryable), forced setup throw (baseline intact + `data-nisli-error`), forced text mismatch (N410 + repaired region only).
- **Marker hygiene**: published HTML for a non-islands build is byte-identical to today; islands build adds only the flag attribute and `nisli:ch` pairs.

## Size estimate

- **P1** (core branch + carry + SSG islands mode + loader lib + tests): ~500–700 LOC, one design gate, **~1.5–2 engineer-weeks**. Est. `.`-entry cost ≤ ~0.8KB min+gzip (budget-checked in CI).
- **www migration**: ~2–3 days net-negative LOC (retires hydrate-frame machinery).
- **P2** (claim walk + splice-repair + equivalence sweep): ~900–1300 LOC incl. tests, second gate, **~3 engineer-weeks**; zero `.`-entry bytes (subpath).
- **Total**: ~5–6 engineer-weeks across two gates, each phase shipping standalone value: P1 alone clears the 2026 table-stakes bar (no flicker, no lost input, WWW-14 class dead); P2 buys node identity for the VT bet and animation/iframe continuity.
