# Bet 04 — View Transitions in Both Lanes

**Status: Draft investment brief** (August 2026 research sweep)

## Context

Same-document View Transitions became **Baseline Newly Available on October 14, 2025**, when Firefox 144 shipped `document.startViewTransition()` — joining Chrome 111 (Mar 2023) and Safari 18 (Sep 2024). Critically, the 2025 extras that fix the old ergonomic blockers are also cross-browser now: `view-transition-class` (Chrome 125+, Safari 18.2+, FF 144) styles groups of snapshots at once, `view-transition-name: match-element` (Chrome 137+, Safari 18.4+, FF 144) auto-names elements by identity so a framework never generates unique names, and `:active-view-transition-type()` scopes CSS to a typed transition (same matrix; FF 144 per the sweep — treat as the newest, least-proven slice).

The second lane is asymmetric: **cross-document** View Transitions (`@view-transition { navigation: auto }`) ship in Chrome 126+ and Safari 18.2+, but **Firefox has them only behind a flag** — they are an explicit Interop 2026 focus area, expected during 2026. **Speculation Rules** (prefetch/prerender via a JSON `<script type="speculationrules">`) are Chromium-only: Safari 26.2 has an implementation behind a flag, Firefox has a positive position on prefetch but has shipped nothing. Both are pure progressive enhancement — declarative CSS and a JSON script tag, zero runtime JS — which is exactly the SSG lane's brand.

One runtime caveat travels with Speculation Rules: **prerendered pages run framework code in a hidden document**. Any inline PE script or island mount must gate side effects on `document.prerendering` / `prerenderingchange`.

ADR 0019 (line 40) already named "View Transitions for app-level navigation transitions" as a platform-alignment target but never ruled on it. This bet is that ruling.

## Current state in nisli

Verified: **zero occurrences** of `startViewTransition`, `@view-transition`, or `speculationrules` anywhere in `packages/` or `docs/` (repo-wide grep; the only "prerender" hits are the SSG-hydration notes in `packages/www/src/client/{loader,hydrate}.ts` and ADRs 0024/0025).

- **Reactivity** — `packages/core/src/signal.ts:115-122`: writes schedule `flushPendingEffects` via `queueMicrotask`. Public synchronous `flush()` at `signal.ts:728-746` drains the whole cascade (bounded, N303-guarded); `tick()` at `:770` settles microtask-scheduled work. ADR 0015 eliminated `batch()` in favor of automatic coalescing + `flush()`. This is the exact primitive a `startViewTransition` update callback needs: mutate signals, then `flush()` synchronously inside the callback.
- **Router** — `packages/router/src/router.ts`. `navigateSameOrigin` (`:240-250`) pushes history then awaits the private `transition()` method (`:276-335`), which is **generation-guarded** (`:301`, `:322`): the async route render happens *before* the commit at `:323` (`connection.rendered.value = output`) followed by `applyMetadata` and `applyNavigationEffects` (`:390-406`, a `queueMicrotask` for scroll/focus). Navigation kind (`'initial' | 'push' | 'replace' | 'pop'`) is already threaded through. The router stamps **monotonic numeric history keys** (`:17`, `:217-219`, restored on popstate at `:163`) — a ready-made back/forward direction oracle for the History fallback.
- **Keyed lists** — `packages/core/src/template.ts:1098-1130`: `each()` mounts every entry inside a stable `<each-item>` wrapper with `style.display = 'contents'` (`:1104-1105`) and reorders by moving wrappers. **Verified platform constraint: a `display:contents` element generates no box, and elements that generate no box are ignored for view transitions** (treated as `view-transition-name: none`; MDN + css-view-transitions-1). So the wrapper itself can never carry a name — the item template's **root child** must, which `match-element` makes trivial.
- **SSG** — `packages/ssg/src/build.ts:144-185` (`buildStaticSite`) renders pages and applies an optional `shell` (`:275-280`); `StaticRouterMetadata` (`:13-32`) is the structural head contract. The www shell (`packages/www/src/shell.ts:33-69`) is the natural emission point: it already injects head CSS and inline PE scripts.

## Proposed design

### Recommended API: router-level opt-in, built on a tiny core primitive

Ship both layers, but the **router option is the recommended surface**; the core helper is the shared primitive it uses (and the escape hatch for non-router UI like tab switches and `each()` reorders).

**Core primitive** (`@nisli/core`, new `view-transition.ts`; named `viewTransition()` to avoid colliding with the router's private `transition()` method):

```ts
export interface ViewTransitionOptions {
  types?: string[];               // flows to :active-view-transition-type()
}

/** Wrap a synchronous state update in a view transition. PE: no support → run + flush. */
export function viewTransition(
  update: () => void,
  options: ViewTransitionOptions = {},
): ViewTransition | null {
  if (typeof document === 'undefined' || !document.startViewTransition) {
    update();
    flush();                       // ADR 0015: settle the cascade now, same as supported path
    return null;
  }
  return document.startViewTransition({
    update: () => { update(); flush(); },   // synchronous DOM commit inside the callback
    types: options.types ?? [],
  });
}
```

The `flush()` call is the whole trick: nisli's auto-coalescing (ADR 0015) would otherwise defer DOM mutation to the next microtask, *outside* the capture window. Because the update callback's return is awaited before the new-state capture, the router's existing `queueMicrotask` scroll/focus effects (`router.ts:391`) also land before capture — scroll position is correct in the snapshot for free.

**Router integration** (recommended surface):

```ts
// Router config (defineRouter / RouterApplicationDefinition):
interface RouterViewTransitions {
  enabled?: boolean | ((nav: NavInfo) => boolean);   // default false — opt-in
  types?: (nav: NavInfo) => string[];                // default: [direction]
}
interface NavInfo {
  from: URL; to: URL;
  kind: 'push' | 'replace' | 'pop';
  direction: 'forward' | 'back' | 'unknown';         // see Interactions/bet 03
}

// Per-navigation override:
router.navigate('/blog', { viewTransition: false });          // or true, or { types: [...] }
```

Inside `Router.transition()`, only the **commit** is wrapped — the async render stays outside so slow loaders never freeze paint (`startViewTransition` blocks rendering during capture):

```ts
const output = await renderer(ctx);                       // unchanged, pre-transition
if (generation !== connection.generation) return;         // unchanged guard
const commit = () => {
  connection.rendered.value = output;
  this.applyMetadata(match.metadata);
  this.applyNavigationEffects(connection.outlet, url, kind, scroll);
};
if (this.shouldTransition(kind, nav)) {
  this.activeTransition?.skipTransition();                // late nav wins, no queue buildup
  this.activeTransition = viewTransition(commit, { types: this.typesFor(nav) });
} else commit();
```

Never transition on `kind === 'initial'`, hash-only navigations, or when `document.hidden`.

**Rejected as default: auto-wrapping the signal flush.** A scheduler mode that wraps every microtask flush in `startViewTransition` would serialize all rendering behind transition capture, fire on trivial updates, and make concurrent transitions skip each other constantly. The explicit `viewTransition(() => { sig.value = x })` wrapper is the per-interaction opt-in for non-router cases; a global mode can be revisited if scoped (element-level) transitions go Baseline.

### each() list-transition recipe (documentation + one CSS file, no core change)

`display:contents` wrappers cannot snapshot (verified above), so names go on item **children**. `match-element` + stable per-key DOM identity (which `each()` already guarantees — wrappers and inner DOM are reused per key, `template.ts:1091-1096`) means zero name bookkeeping:

```css
/* item template root, e.g. <li class="card"> */
.card {
  view-transition-name: match-element;   /* identity-keyed, no generated names */
  view-transition-class: card;           /* style all cards as a group */
}
::view-transition-group(.card) { animation-duration: 200ms; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none !important; }  /* instant cut, types still active */
}
```

```ts
viewTransition(() => { items.value = sorted; }, { types: ['reorder'] });
```

Reduced motion answer: **keep calling `startViewTransition`** and neutralize animation in CSS (the Chrome-documented pattern above). Skipping the call in JS would also disable `:active-view-transition-type()`-scoped styles and change code paths per user preference; the CSS cut preserves atomic swap + types with zero motion. Offer `skipTransition()` via the returned handle for hard opt-outs.

### SSG lane (zero-JS)

`buildStaticSite` gains an opt-in `viewTransitions` config; the shell contract emits three things:

```html
<style>@view-transition { navigation: auto; }</style>   <!-- cross-doc opt-in, both pages need it -->

<script type="speculationrules">
{ "prefetch":  [{ "where": { "href_matches": "/*" }, "eagerness": "moderate" }],
  "prerender": [{ "where": { "href_matches": "/*",
                   "not": { "selector_matches": "[data-no-prerender]" } },
                 "eagerness": "moderate" }] }
</script>
```

Per-page names come from authoring (e.g. `view-transition-name: hero` on the article header) — optionally surfaced through a `viewTransition` block on `StaticRouterMetadata` (`build.ts:13-32`) that the shell serializes to a page-scoped `<style>`. Note `match-element` is same-document-only (identity cannot cross documents), so cross-doc names are explicit.

**Prerendering guard helper** (`@nisli/ssg` client export + inline-snippet variant for shells like `packages/www/src/shell.ts`):

```ts
export function whenActive(fn: () => void): void {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', () => fn(), { once: true });
  } else fn();
}
```

Rule: DOM wiring (listeners, upgrades) may run while prerendering; anything observable (analytics, timers, autofocus, media, island mounts with layout effects) goes through `whenActive`.

## Implementation plan

1. **Phase 1 — core primitive + router opt-in.** `viewTransition()` in core; `RouterViewTransitions` config + `NavigateOptions.viewTransition`; direction from history-key comparison (fallback) — see Interactions. Default root crossfade CSS documented, reduced-motion block included. Dogfood on a www hydrated page.
2. **Phase 2 — each() recipe.** No core change; docs page + `view-transition-class`/`match-element` recipe, `reorder`/`filter` type conventions, a www `/docs` demo with a sortable list. Regression: verify `<each-item>` reorder animates children correctly in all three engines.
3. **Phase 3 — SSG emission.** `viewTransitions` option on `StaticSiteConfig`; shell contract emits `@view-transition` CSS + speculation-rules JSON; `whenActive` helper; www adopts it (its docs pages are pure SSG — the flagship demo). Audit www's inline scripts (`shell.ts:51-65` are listener-only — safe) and the hydrate loader for prerender-gating.

## Feature detection & degradation — the PE contract

Every layer no-ops to today's behavior:

| Layer | Missing capability | Behavior |
|---|---|---|
| `viewTransition()` | no `document.startViewTransition` | `update(); flush()` — identical semantics, no animation |
| `types` | old Chrome (111-124) accepts callback-only | pass object form only when supported, else plain callback; type-scoped CSS just never matches |
| `:active-view-transition-type()` / `view-transition-class` / `match-element` | unsupported | unknown CSS — ignored; keep direction styles additive, never load-bearing |
| `@view-transition` | Firefox (flagged; Interop 2026) | normal full-page navigation |
| `speculationrules` | Safari (flagged) / Firefox | inert script tag; normal fetch on click |
| `document.prerendering` | non-Chromium | `undefined` → falsy → `whenActive` runs immediately |

No polyfills, no UA sniffing, nothing to remove later — Firefox catching up on cross-doc during Interop 2026 upgrades shipped sites in place.

## Interactions

- **Bet 03 (Navigation API engine).** With `navigation.intercept()`, direction is native: `navigateEvent.navigationType` plus `destination.index` vs `navigation.currentEntry.index` yields `back`/`forward` for traversals. Design `NavInfo.direction` as an engine-provided field so the History fallback works too: the router's existing monotonic keys (`router.ts:17,217-219`) give `Number(incomingKey) < Number(currentKey)` → `'back'` on popstate (heuristic: keys reset per session — hence the `'unknown'` member). Bet 04 must not *depend* on bet 03; it gets cleaner underneath it.
- **Bet 05 (adopt() islands).** Two couplings. (a) During a cross-doc transition, the new page is captured at `pagereveal`; a remount-style island that flickers gets its flicker *snapshotted* — adopt-in-place is what makes cross-doc VT look right, so ship the recipe caveat until adopt() lands (www's `hydrate.ts` replace-frame is already flicker-free by design). (b) Speculation-Rules prerender runs island code in a hidden document: adopt()'s mount path should route observable side effects through `whenActive` from day one.
- **ADR 0015 flush semantics.** `flush()`'s documented charter ("effects executed before the next line") is exactly the update-callback contract; `viewTransition()` is arguably the first first-class consumer beyond DOM measurement. No new scheduler mode, no `batch()` resurrection — the wrapper is a scoped, opt-in synchronous commit. N303 cascade caps still apply inside the callback (a runaway cascade degrades to a skipped transition, not a hang).
- **Router head reconciliation** (`router.ts:337-388`) runs inside the wrapped commit, so title/meta swap atomically with the DOM — correct for free.

## Risks & open questions

1. **`:active-view-transition-type()` in Firefox** — the sweep says FF 144, but release notes conclusively confirm only `:active-view-transition`. Mitigation already in the design: direction styles are additive. Verify against MDN BCD during Phase 1.
2. **Transition/generation races.** A navigation landing while a transition animates must `skipTransition()` the old one (design does); test double-click navigation and pop-during-transition explicitly.
3. **Capture freeze.** Anything slow inside the update callback freezes the page; the design keeps async renders outside, but a pathological synchronous effect cascade is still user code — document it.
4. **Duplicate `view-transition-name`s skip the transition.** `match-element` avoids generated-name collisions, but user-authored names can still collide (e.g. two `hero`s). Recipe warning; possible dev-mode diagnostic (a new N-code) later.
5. **Prerender resource cost / correctness.** Moderate eagerness limits it, but `data-no-prerender` escape hatch and the `whenActive` discipline need to be in the first docs cut, not retrofitted.
6. **Open:** should `StaticRouterMetadata` grow a `viewTransition` block (per-page names/types) in Phase 3, or stay authoring-side CSS? Leaning metadata — it matches the managed-head philosophy — but it widens the router/ssg structural contract; decide in the ADR.
7. **Open:** expose the returned `ViewTransition` (for `finished`/`updateCallbackDone` chaining) on the router — a `router.navigate()` that resolves at commit vs at `finished`? Proposal: resolve at commit (today's contract), expose the handle on a `router.currentTransition` signal.

## Verification plan

- **Unit (vitest/jsdom):** jsdom lacks `startViewTransition`, so the default test suite *is* the no-op-path guard — assert `viewTransition()` updates + flushes synchronously without it. Mock `document.startViewTransition` to assert callback wrapping, `types` pass-through, and skip-on-new-navigation. `whenActive`: mock `document.prerendering` both ways.
- **E2E (Playwright, extending the www `pnpm sweep` guard — rebuild dist first per the vitest-wipes-assets gotcha):** Chromium: navigate, assert a transition ran (`:active-view-transition` matched / `transition.finished` resolved) and the each() demo animates on reorder; `page.emulateMedia({ reducedMotion: 'reduce' })` asserts the instant-cut path; assert speculation-rules tag emission and, via CDP `Preload` domain, that a prerender activates with `whenActive` firing post-activation. Firefox run doubles as the same-doc-only degradation check. Any new harness carries the pre-rev cleanup-checklist attestation.
- **Manual matrix:** Safari 18.2/26 cross-doc pass on nisli.dev preview before the www deploy (deploy after verdict, per convention).

## Size estimate

**M overall.** Core `viewTransition()` ~40 LOC + tests (S); router config/threading/direction ~80-120 LOC + tests (S/M); SSG emission + `whenActive` + shell changes ~100 LOC (S); the bulk is docs/recipes and the E2E additions. Zero new dependencies, zero bytes on the no-opt-in path. One ADR (graduating ADR 0019's line-40 deferral), landable in the three phases independently; Phase 1 is shippable alone.

---
*Sources: [web.dev — same-document VT Baseline](https://web.dev/blog/same-document-view-transitions-are-now-baseline-newly-available), [Firefox 144 release notes](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/144), [MDN view-transition-name](https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name) (no-box elements ignored), [w3c css-view-transitions-1](https://www.w3.org/TR/css-view-transitions-1/), [Chrome — cross-document VT](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document), [WebKit — Interop 2026](https://webkit.org/blog/17818/announcing-interop-2026/), [Mozilla — Interop 2026](https://hacks.mozilla.org/2026/02/launching-interop-2026/), [MDN Speculation Rules](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API), [Chrome — SPA view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/same-document), [MDN :active-view-transition-type()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:active-view-transition-type).*
