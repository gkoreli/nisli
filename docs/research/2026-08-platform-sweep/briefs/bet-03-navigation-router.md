# Bet 03 — Navigation API Engine for @nisli/router

**Status:** Draft investment brief (August 2026 research sweep)
**Scope:** Swap the browser navigation *engine* of `@nisli/router` (0.5.1) from History API + delegated clicks to `navigation.intercept()`, feature-detected with a History fallback. Everything else — typed `href()` builders, query/param codecs, redirects + loop guard, generation-guarded async renders, managed head reconciliation, `isActive()`, the pure matcher, `@nisli/router/catalog` for edge Workers, the Vite plugin, SSG expansion — stays.

## Context

ADR 0026 (§9) built browser routing on the only primitives that were universally available in July 2026's compatibility frame: one `popstate` listener, one delegated document click listener, and `history.pushState/replaceState`. That stack forces the router to hand-emulate what the browser already knows how to do: per-entry scroll memory (with a key smuggled through `history.state`), focus movement, hash jumps, and click-eligibility heuristics (modifiers, `target`, `download`, origin).

The platform has since flipped:

- **Navigation API is Baseline Newly Available since January 13, 2026** — Chrome/Edge (since 102), Firefox 147 (Jan 2026), Safari 26.2 (Dec 2025). Safari ships without `precommitHandler`. It is an **Interop 2026 focus area** (the group's stated work item is precisely `precommitHandler` interop), so the tail of implementation bugs is being actively burned down.
- **URLPattern is Baseline Newly Available since September 15, 2025** (Chrome 95+, Firefox 142, Safari 26), an Interop 2025 result; it is also native in workerd/Cloudflare Workers (Ada-based) and in Node ≥ 23.8 / Node 24 LTS — but **not** in Node 20/22 (verified: the repo's own dev Node v20.20.2 has `typeof URLPattern === 'undefined'`).

`navigation.intercept()` turns any same-origin navigation — link clicks, `location.href =`, form submissions, back/forward — into a same-document transition with **correct traversal semantics, browser-owned scroll restoration, focus reset, and a handler promise the browser ties to the navigation's lifecycle** (`navigatesuccess`/`navigateerror`, `navigation.transition`, per-navigation `AbortSignal`). That is, near-verbatim, the list of things `router.ts` currently reimplements by hand. ADR 0026 §12 deferred URLPattern "until browser support and semantics fit"; support has flipped, and this bet re-litigates that deferral honestly (spoiler: semantics still don't fit — see Phase 3).

## Current state in nisli (verified against source)

All in `packages/router/src/` at 0.5.1:

- **Engine listeners** — `router.ts:166-168`: one `popstate` listener + one delegated `document` click listener registered in `connect()`; disposed at `router.ts:180-185`.
- **Click eligibility heuristics** — `router.ts:408-420` (`onDocumentClick`): left-button, no modifiers, `closest('a[href]')`, non-self `target` / `download` / `data-router-ignore` opt-outs, same-origin check, same-URL-with-hash bail (`:415`), match-before-preventDefault.
- **History commits** — `router.ts:246-247`: `history.replaceState`/`pushState` inside `navigateSameOrigin`; cross-origin escape to `location.assign` at `router.ts:233-235`.
- **Manual scroll restoration** — `router.ts:193-215`: `history.scrollRestoration = 'manual'` (`:197`), per-entry keys stamped into a wrapped `history.state` (`HISTORY_KEY = '__nisli_router'`, `router.ts:17`, `wrapHistoryState` `:221-224`), a `scrollPositions` map (`:135`), `rememberScroll` (`:226-229`), restore-on-pop (`:401-404`), reload-safe key seeding (`:199-206`).
- **Navigation effects** — `router.ts:390-406` (`applyNavigationEffects`): hash `scrollIntoView` emulation, push → `scrollTo(0,0)` + `outlet.focus({preventScroll:true})`, replace → preserve, pop → manual restore; all in a `queueMicrotask`.
- **Redirects** — `router.ts:285-296`: matcher-resolved `match.redirect` re-entered as `navigate(target, {replace:true})` with `MAX_REDIRECTS = 10` hop guard (`:31`).
- **Generation guard** — `router.ts:301,322,327,333`: stale async renders discarded per-connection generation, per ADR 0026 §9.
- **Head reconciliation** — `router.ts:337-388`: title/meta/property/canonical/hreflang/JSON-LD/lang/dir set-update-remove; engine-independent.
- **Hand matcher** — `matcher.ts:101-169`: compiled segments (static/`:param`/`*catchAll`), specificity ranking + ambiguity detection (`:123-145`), codec NO-MATCH fallthrough (`:182-198`), base handling, percent-decoding; pure and `window`-free (guarded by `purity.test.ts` over the `/catalog` subpath).
- **Typed surface** — `route.ts:4-14` (template-literal `PathParams`), typed `href()` with `HrefExtras`, `application.ts:39-93` (`defineRouter` + outlet), `vite.ts:49-85` (Node-side dev matching), `catalog.ts` (core-free Worker subpath).
- **ADR 0026** — `docs/adr/0026-typed-application-router.md`: §6 native anchors (no RouterLink), §9 engine contract, §12 URLPattern deferral, RTR-6/0.2.0 validation tables naming **real-browser scroll/focus automation as the one persistent gap**.

## Proposed design

### One engine interface, two implementations

The `Router` class splits along an already-visible seam: everything above `transition()` (matching, signals, redirects, head, render) is engine-independent; everything that touches `window`/`history`/`document`-click is the engine.

```ts
/** What the router core needs from a browser engine. */
export interface NavigationEngine {
  /** Register listeners; call sink for every navigation this engine owns. */
  connect(sink: EngineSink): () => void;
  /** Commit url and drive a transition. Resolves when the transition settles. */
  navigate(url: URL, options: EngineNavigateOptions): Promise<void>;
  back(): void;
  forward(): void;
  /** Whether this engine wants the router's manual scroll/focus/hash effects. */
  readonly ownsScrollRestoration: boolean;
}

export interface EngineNavigateOptions {
  replace: boolean;
  state: unknown;
  scroll: 'top' | 'preserve';
  /** Redirect hop: engine may choose commit semantics (e.g. replace). */
  redirect?: boolean;
}

export interface EngineSink {
  /**
   * The router's transition pipeline (match → render → head → effects).
   * The engine ties the returned promise to its own lifecycle: the intercept
   * handler promise in Navigation mode; fire-and-forget in History mode.
   * `signal` aborts when the navigation is superseded (Navigation mode only).
   */
  transition(nav: {
    url: URL;
    kind: 'initial' | 'push' | 'replace' | 'traverse';
    options?: { scroll?: 'top' | 'preserve'; state?: unknown };
    signal?: AbortSignal;
  }): Promise<void>;
}
```

`HistoryEngine` is a mechanical extraction of today's `router.ts:159-257` + `:390-420` (`ownsScrollRestoration: true`). `NavigationEngine` (`ownsScrollRestoration: false`) is:

```ts
class NavigationApiEngine implements NavigationEngine {
  readonly ownsScrollRestoration = false;
  connect(sink: EngineSink): () => void {
    const onNavigate = (event: NavigateEvent) => {
      if (!event.canIntercept) return;                  // cross-origin etc. → native
      if (event.hashChange) return;                     // same-doc fragment → native (§6 parity)
      if (event.downloadRequest !== null) return;       // download → native
      if (this.optedOut(event)) return;                 // data-router-ignore
      const url = new URL(event.destination.url);
      const info = event.info as NavigateOptions | undefined; // carried from navigate()
      event.intercept({
        // Traversals: browser restores the remembered scroll AFTER the handler
        // resolves — deletes the scrollPositions map. Push: browser scrolls to
        // top / fragment — deletes scrollTo(0,0) and the scrollIntoView shim.
        scroll: info?.scroll === 'preserve' ? 'manual' : 'after-transition',
        focusReset: 'manual',                           // keep outlet-focus contract (RTR-3)
        handler: () => sink.transition({
          url,
          kind: event.navigationType === 'traverse' ? 'traverse'
              : event.navigationType === 'replace' ? 'replace' : 'push',
          options: info,
          signal: event.signal,
        }),
      });
    };
    navigation.addEventListener('navigate', onNavigate);
    return () => navigation.removeEventListener('navigate', onNavigate);
  }
  async navigate(url: URL, o: EngineNavigateOptions): Promise<void> {
    // Programmatic entry point funnels through the same navigate event above.
    await navigation.navigate(url.href, {
      history: o.replace || o.redirect ? 'replace' : 'push',
      state: o.state,
      info: { scroll: o.scroll },      // per-navigation options ride event.info
    }).finished;
  }
  back(): void { void navigation.back(); }
  forward(): void { void navigation.forward(); }
  private optedOut(event: NavigateEvent): boolean {
    // NavigateEvent.sourceElement where present; else a capture-phase click
    // recorder (see Risks) that remembers the last-clicked anchor's opt-out.
    const source = (event as { sourceElement?: Element }).sourceElement;
    return source?.closest?.('[data-router-ignore]') != null || this.recordedOptOut();
  }
}
```

**What the delegated click listener still handles in Navigation mode: essentially nothing.** The eligibility table maps as: modifier/middle clicks and `target=_blank` navigate a *different* navigable, so no `navigate` event fires in this window (native, free); cross-origin fires with `canIntercept: false`; `download` fires with `downloadRequest !== null`; same-document hash-only fires with `hashChange: true` (decline, matching `router.ts:415`); same-URL pushes are auto-converted to replace by the browser. The one residue is `data-router-ignore` (`router.ts:412`): the `navigate` event doesn't inherently say which anchor was clicked. `NavigateEvent.sourceElement` answers it where supported; where absent, keep a **vestigial capture-phase click listener whose only job is recording opt-out intent** — five lines, no preventDefault, no eligibility logic.

Wins that fall out for free: `location.href =` by app/third-party code becomes an SPA transition; the browser owns traversal scroll (pixel-correct, bfcache-consistent, including iframe/scroll-container cases the manual map never handled); `history.state` no longer needs the `__nisli_router` wrapper (state rides `NavigationHistoryEntry` state, read via `getState()`); `navigation.transition`/`event.signal` give a real cancellation story the generation guard only approximates (guard stays — it's cheap, and HistoryEngine needs it).

**Redirects:** the current pipeline (commit → match → `navigate(target, {replace:true})`, `router.ts:285-296`) maps directly: the intercept handler observes `match.redirect` and re-enters `navigation.navigate(target, { history: 'replace' })` — identical observable behavior to today (source URL flashes, replaced before settle), hop guard unchanged. `precommitHandler`/`NavigationPrecommitController.redirect()` would eliminate even the flash by redirecting pre-commit — **do not use it in v1**: Safari 26.2 lacks it, and shipping two redirect behaviors by browser is a test-matrix tax with no correctness gain. Revisit when the Interop 2026 work lands it everywhere.

**Focus:** keep `focusReset: 'manual'` plus the existing outlet-focus effect. The native default (`after-transition` → focus `autofocus`/body) differs from the documented push→outlet contract (RTR-3); don't change a documented a11y behavior as a side effect of an engine swap.

### Phase 3 decision: URLPattern does **not** replace matcher.ts

Recommendation: **keep the hand matcher as the single implementation; do not adopt URLPattern for matching.** Honest tradeoffs:

*For URLPattern:* spec-maintained, native-speed parsing; richer syntax (regex groups, optional segments) if ever needed; alignment with other platform surfaces that consume URLPattern (Service Worker Static Routing, speculation rules).

*Against, decisive:* (1) **Catalog neutrality** — the matcher runs in browsers, workerd (URLPattern: yes, Ada-native), Vite dev middleware and SSG on Node (`vite.ts:68`, `buildStaticSite`): Node < 23.8 has no URLPattern, Node 22 is in maintenance until April 2027, and this repo itself develops on Node 20 (verified `undefined`). A polyfill contradicts the zero-dependency purity guarantee `purity.test.ts` enforces on `/catalog`. (2) **Semantics** — URLPattern matches one pattern; nisli needs cross-catalog specificity ranking, compile-time ambiguity detection (`matcher.ts:133`), and codec-throws-as-NO-MATCH fallthrough (`matcher.ts:182-198`). All three would be reimplemented *around* URLPattern, so net code shrinks little or grows. (3) **Typed extraction** — template-literal `PathParams` (`route.ts:4-14`) is keyed to nisli's `:name`/`*name` syntax and yields codec-refined types; URLPattern groups are stringly and its wildcard/regex surface is untypeable without constraining to a subset — at which point the subset is the current syntax. (4) The engine swap doesn't need it: `intercept()` composes with any matcher. ADR 0026 §12's deferral condition was "support **and semantics**"; only support flipped. Cheap additive bridge instead: a catalog→URLPattern-string *exporter* (`/ui/:name` → `/ui/:name` is already valid URLPattern syntax for these three segment kinds) for future service-worker/speculation-rules integration, with a test asserting exported patterns match iff the matcher matches — URLPattern as an *output format*, never the match authority.

## Implementation plan (phased)

1. **Engine seam (no behavior change).** Extract `HistoryEngine` from `Router`; `Router` keeps signals, matcher, redirect loop, head reconciliation, render pipeline, and (when `engine.ownsScrollRestoration`) the manual effects. Entire happy-dom suite (`router.test.ts`) must pass unmodified — that is the seam-correctness proof. Ship as a patch/minor.
2. **NavigationEngine.** Implement the sketch above behind feature detection; add a `defineRouter` option `engine: 'auto' | 'history' | 'navigation'` (default `'auto'`) as operator kill switch. Unit-test against a small in-repo Navigation API test double (happy-dom has no `window.navigation`); real confidence comes from the harness (below). Ship minor, default `'auto'`.
3. **URLPattern ruling + amendment.** Record the keep-the-matcher decision as an ADR 0026 amendment superseding §12's "until" clause with a standing position; optionally land the exporter. No matching-path code change.

## Feature detection & fallback

```ts
const supportsNavigationApi =
  typeof navigation !== 'undefined' && typeof navigation.navigate === 'function';
```

`'auto'` → NavigationEngine when detected, else HistoryEngine. Both engines ship in the bundle (runtime detection defeats tree-shaking; size below). Fallback population in Aug 2026: pre-147 Firefox ESR, Safari ≤ 26.1 / older iOS — shrinking but real for ~2 years; HistoryEngine is therefore **maintained, not deprecated**, and every behavioral test runs against both engines. SSR/SSG/Worker contexts never construct an engine (`connect()` is browser-only), so `/catalog` purity is untouched. TypeScript: the repo's TS 5.7 `lib.dom` lacks Navigation API types — add the types-only `@types/dom-navigation` (or a local ambient declaration) as a devDependency; zero runtime.

## Interactions

- **Bet 04 (view transitions):** the engine seam is the enabler. `document.startViewTransition` must wrap the DOM swap inside the intercept handler, and traversal *direction* (for reverse animations) comes from `event.navigationType === 'traverse'` + entry indices — information only NavigationEngine has natively. `EngineSink.transition` already carries `kind`; bet 04 extends it with direction and wraps `rendered.value =` assignment. Building bet 04 on the History engine would mean hand-inferring direction from the key map — do bet 03 first.
- **Bet 07 (server functions):** `event.signal` plumbed through `sink.transition` into the render context lets in-flight server-function fetches abort when a navigation is superseded — today the generation guard discards results but cannot cancel the network. Form-submission interception (`event.formData`) is the natural future action path; the engine interface deliberately doesn't preclude it (decline forms in v1).
- **SSG redirects:** unchanged division of labor (0.3.0 §5): SSG emits no redirect files, the consumer's Worker owns 308 canonicalization, the client hop is engine-internal. NavigationEngine changes only the mechanism (`navigation.navigate` replace vs `replaceState`), not the contract; the erent split (client/shared/server) is unaffected because engines live outside `/catalog`.

## Risks & open questions

1. **New-implementation bugs** in Firefox 147/Safari 26.2 (Interop 2026 exists because interop isn't done). Mitigated by `engine:'history'` kill switch and dual-engine test parity.
2. **`history.state` shape change.** Consumers that read `history.state.state` (the documented 0.2.0 wrapper) won't find state in Navigation mode (it lives in `NavigationHistoryEntry.getState()`). Proposal: add `router.state(): unknown` (engine-neutral accessor) in Phase 1 and document the direct read as deprecated. Open question: mirror state into classic `history.state` for one minor as a bridge?
3. **`sourceElement` availability** for `data-router-ignore` across all three engines' first Navigation API releases is unverified — the capture-phase recorder fallback must ship, not be optional.
4. **Hash-target timing:** with `scroll:'after-transition'`, the browser scrolls to the fragment when the handler promise resolves; the handler must not resolve before the rendered signal has flushed to DOM (resolve after the current `queueMicrotask` discipline, `router.ts:391`). Needs an explicit harness case.
5. **Double interception** if an app or library also listens to `navigate` — first `intercept()` wins per spec (handlers combine); document that nisli assumes ownership.
6. **Same-URL re-navigation** semantics differ subtly (browser converts to replace); confirm `isActive`/signal updates don't double-fire.
7. Open: should `back()`/`forward()` return `navigation.traverseTo().finished` promises (API widening) or stay `void` for parity? Recommend `void` in v1.

## Verification plan

The RTR-6 / 0.2.0 gap — "real-browser automation of scroll/focus/hash effects" — stops being deferrable: happy-dom has no Navigation API, and the whole point of the bet is pixel-level browser behavior. Spec for the harness (modeled on `packages/www`'s existing Playwright sweep discipline, subject to the repo's harness-review attestation):

- **Runner:** Playwright against a static build of a purpose-built tall-page fixture app (3 routes + redirect + hash anchors + `data-router-ignore` + external link + download link), served like the www sweep serves previews. Chromium + WebKit + Firefox projects; every scenario runs twice — `engine:'navigation'` and `engine:'history'` — asserting identical observable outcomes.
- **Scenarios:** (1) push scrolls to top and focuses outlet (`document.activeElement` is host); (2) scroll down, navigate, Back → prior offset restored within tolerance, no double-scroll; (3) Forward re-restores; (4) reload mid-stack, then Back (key-seeding/native-entry parity); (5) cross-page hash navigation lands on the fragment after async render; (6) same-document hash stays native; (7) modifier-click and `target=_blank` open tabs (context events), no SPA transition; (8) download link downloads; (9) `data-router-ignore` full-loads; (10) redirect hop lands with replace semantics (history length unchanged); (11) rapid double-navigation: first render discarded, no `navigateerror` leaked to console; (12) `location.href =` becomes SPA transition in Navigation mode and full load in History mode (the one documented engine divergence).
- **Unit layer:** Navigation API double in-repo for `router.test.ts`-grade fast tests of the engine's decline logic (canIntercept/hashChange/downloadRequest/opt-out) and info-plumbing.
- **Equivalence suites** (router/SSG/www) unchanged — they prove matcher neutrality, which this bet deliberately does not touch.

## Size estimate

Current dist (unminified ESM): `router.js` 16.7 KB, `matcher.js` 9.2 KB, package total 38.4 KB. The engine seam is roughly neutral (extraction, not addition). NavigationEngine adds ~120–180 lines; HistoryEngine retains ~100 lines the Navigation path no longer needs (scroll map, key wrapping, click eligibility) but they still ship for fallback: expect **+1.5–2 KB minified (~0.7 KB gz)** browser bundle while both engines coexist, trending *negative* (−1 KB or better vs today) if/when HistoryEngine is ever dropped. `/catalog` and SSG/Vite/Worker bundles: **zero delta**. Effort: Phase 1 ≈ 1–2 days (extraction + green suite), Phase 2 ≈ 3–5 days (engine + double + `@types/dom-navigation`), harness ≈ 3–4 days (fixture app + 12 scenarios × 3 browsers × 2 engines + attestation), Phase 3 ≈ 0.5 day (ADR amendment). **Total ≈ 8–12 engineering days**, dominated by the harness — which retires ADR 0026's oldest standing validation debt regardless of the engine's fate.

## Sources

- [web.dev — Navigation API is Baseline Newly Available](https://web.dev/blog/baseline-navigation-api) (Jan 2026; Chrome 102+, Firefox 147, Safari 26.2; Safari lacks `precommitHandler`)
- [web.dev — New to the web platform in January 2026](https://web.dev/blog/web-platform-01-2026)
- [InfoQ — Navigation API reaches Baseline](https://www.infoq.com/news/2026/05/navigation-api-browser/)
- [MDN — NavigateEvent.intercept()](https://developer.mozilla.org/en-US/docs/Web/API/NavigateEvent/intercept) (`handler`/`precommitHandler`/`focusReset`/`scroll` semantics, `SecurityError` on `canIntercept:false`, `NavigationPrecommitController.redirect`)
- [web-platform-tests — Interop 2026](https://github.com/web-platform-tests/interop/blob/main/2026/README.md) / [WebKit announcement](https://webkit.org/blog/17818/announcing-interop-2026/) (Navigation API focus area, `precommitHandler` interop)
- [Cloudflare — URLPattern in Node.js and Workers](https://blog.cloudflare.com/improving-web-standards-urlpattern/) (Ada-based; Node ≥ 23.8; workerd native)
- [MDN — Navigation API overview](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API); URLPattern Baseline Sep 15 2025 via [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/navigation/)
