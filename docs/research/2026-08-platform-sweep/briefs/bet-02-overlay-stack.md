# Bet 02 — Rebuild @nisli/ui overlays on the platform stack

**Status:** Draft investment brief (August 2026 research sweep)

## Context

@nisli/ui currently ships ~985 lines of hand-rolled overlay machinery (floating math, portals, dismissal stacks, focus traps) that re-implements what the platform now provides natively: the **popover attribute** (Baseline newly Apr 2024, widely available Oct 2026), **CSS anchor positioning** (all engines since Firefox 147, Jan 2026; Interop 2026 focus; spec still churning), **Invoker Commands** (`command`/`commandfor`, `CommandEvent` with `.source`, custom `--name` commands — Baseline newly Dec 12 2025: Chrome 135 / FF 144 / Safari 26.2), and **`<dialog closedby>`** (Chrome 134 + FF 140; Safari missing, Interop 2026 target). `dialog` `beforetoggle`/`toggle` events are cross-browser. The top layer eliminates the portal/z-index problem class outright. Notably, `popover=hint` is NOT in Safari and Interest Invokers (`interestfor`) are Chrome/Edge 142 only — both are excluded from this bet's core path.

This is not a taste call: **ADR 0019 already rules it** — "Use native `popover` for simple overlays before adding a framework abstraction" (docs/adr/0019-minimal-runtime-and-native-platform-alignment.md:114). The current libs were built before the platform stack was Baseline; they are now the framework abstraction ADR 0019 warned against. The light-DOM stance (ADR 0022 §2, docs/adr/0022-nisli-ui-component-library.md:118-133) makes migration unusually cheap: no shadow boundaries to fight, page-scope Tailwind sees everything, and anchor names resolve in one tree scope.

## Current state in nisli

All paths under `packages/ui/registry/default/` unless noted.

**Libs (the machinery to retire or shrink):**
- `lib/floating.ts` (342 LOC) — mini Floating-UI: `positionFloating()` (floating.ts:292) sets `position:fixed` + `left/top`, flips (`computePosition`, :205), clamps, positions an arrow (:260), writes `data-side`/`data-align` and per-slot `--radix-*-transform-origin` vars (:85-95, :316), repositions on capture-phase scroll + resize listeners (:336-337). `floatingHidden()` (:122) holds a closing layer visible for its exit keyframes.
- `lib/portal.ts` — `portal()` (portal.ts:63) moves the subtree to `document.body` on mount, riding the ADR 0023 move-resilient lifecycle; sole owner of removal (:74-93).
- `lib/dismissable-layer.ts` — module-level LIFO stack + capture-phase `document` keydown/pointerdown listeners (dismissable-layer.ts:42-80); topmost layer dismisses on Esc/outside-pointer.
- `lib/focus.ts` — `focusTrap()` (focus.ts:82): Tab-wrap trap, move-in on activate, restore on deactivate; `trapped:false` = non-modal move-in/restore only.
- `lib/roving-focus.ts` (:89) and `lib/typeahead.ts` (:29) — menu keyboard navigation. No platform equivalent; these stay.

**Components:**
- `ui/popover.ts` — attribute-as-truth `open` (PATTERN A: popover.ts:89-119 — attribute is the uncontrolled state, `isPinned` discriminates controlled, reflect effect at :117-119), `ui-open-change` CustomEvent (:102), portal + dismissable-layer + non-modal focusTrap (:247-259), rAF-deferred `positionFloating` (:270-298).
- `ui/dialog.ts` — same PATTERN A root (dialog.ts:91-134); content renders a portaled overlay `<div>` + panel `<div role="dialog" aria-modal>` (:292-313) with hand-built z-50 overlay classes (:199-206), dismissable-layer + modal focusTrap (:256-273). `ui/alert-dialog.ts` (:45-47), `ui/sheet.ts` (:53-55), `ui/drawer.ts` (:39-41) clone this machinery.
- `ui/tooltip.ts` — module-level provider manager (one-open + 300 ms skip window, tooltip.ts:56-98), hover/focus events, portal + floating + arrow.
- `ui/hover-card.ts` — open/close delay timers (700/300 ms), floating + portal only.
- `ui/dropdown-menu.ts` — the full stack: floating, portal, layer, trap, roving-focus (:280), typeahead (:285), plus a DOM-nested submenu family (:738+) that portals sub-content separately (:933).
- `ui/context-menu.ts` — same, positioned at the pointer via a **virtual anchor rect** (`getBoundingClientRect` shim over the cursor point, context-menu.ts:444; `openAt(clientX, clientY)` :241).
- `ui/menubar.ts` — dropdown machinery × N triggers with hover-across-open.
- `ui/select.ts` — **native `<select>`** (select.ts:1-9); no overlay code; already the ADR 0022 §5 endpoint. `ui/combobox.ts` composes `Popover` + `Command` (combobox.ts:57-58). `ui/navigation-menu.ts` positions inline with `absolute top-full` (navigation-menu.ts:348), no portal. `ui/toast.ts` is a fixed-position stack, no libs.

**Zero** native `<dialog>`, `popover`, `showPopover`, `commandfor`, or `anchor-name` usages exist anywhere in the registry today (verified by grep).

## Proposed design

### One sync seam: `lib/native-overlay.ts`

The key reconciliation problem: nisli's `open` attribute-as-truth (PATTERN A) vs. the popover/dialog internal toggle state machine. Solution — **`beforetoggle` is the single ingestion point; the reflect effect is the single emission point.** One code path serves both element kinds because both now fire `beforetoggle`/`toggle`:

```ts
// lib/native-overlay.ts
export interface NativeOverlayOptions {
  open: ReadonlySignal<boolean>;
  setOpen(next: boolean): void;          // the existing PATTERN A setter
  kind: 'popover' | 'modal-dialog' | 'dialog';
}
export function syncNativeOpen(el: Ref<HTMLElement>, opts: NativeOverlayOptions): void {
  // Emission: signal → platform. Runs in the same effect that reflects the
  // host attribute today (popover.ts:117), guarded by current native state.
  effect(() => {
    const node = el.current; if (!node) return;
    const want = opts.open.value;
    if (opts.kind === 'popover') want ? node.showPopover() : node.hidePopover();
    else want ? (node as HTMLDialogElement).showModal() : (node as HTMLDialogElement).close();
  });
  // Ingestion: platform → signal. Light dismiss, Esc, closedby, and native
  // invoker commands ALL funnel through beforetoggle; sync the attribute-as-
  // truth state and fire ui-open-change from the existing setter.
  // Re-entrancy guard: skip when newState already matches open.value.
  on(el, 'beforetoggle', (e: ToggleEvent) => {
    const next = e.newState === 'open';
    if (next !== opts.open.value) opts.setOpen(next);
  });
}
```

Controlled-mode veto (parent pins `open`, user light-dismisses): `setOpen` already refuses to write the attribute when pinned (popover.ts:100); the reflect/emission effect then re-shows the popover. Whether to instead `preventDefault()` the hide inside `beforetoggle` (cancelability differs by direction and browser) is an open question — the re-show fallback is correct either way, just one frame later.

### Lib replacement map

| Today | Replacement | What remains JS |
|---|---|---|
| `floating.ts` (342 LOC) | `anchor-name: --ui-anchor-N` on trigger, `position-anchor` + `position-area` + `position-try-fallbacks: flip-block, flip-inline` on content; `sideOffset` via `margin`; scroll/resize listeners deleted (compositor tracks the anchor) | A ~30-LOC resolved-side observer (see Risks); arrow keeps a static per-side recipe |
| `portal.ts` | Top layer (popover/dialog escape overflow/transform/z-index by definition) | Nothing — retire from overlay path |
| `dismissable-layer.ts` | `popover=auto` light dismiss + native LIFO nesting; `<dialog closedby="any">` | Slim outside-pointerdown shim for **dialogs on Safari only** (closedby gap) |
| `focus.ts` | `showModal()` = native inert-background containment + initial focus + restore | Non-modal move-in/restore for popover panels; `initialFocus` opt-in (autofocus attr where possible) |
| `roving-focus.ts`, `typeahead.ts` | — | Stay unchanged (no platform equivalent) |
| `floatingHidden()` | `transition-behavior: allow-discrete` + `@starting-style` exit transitions | Deleted |

### CommandEvent placement and API

**Ruling: ui lib, not core.** ADR 0019:115-116 is explicit — framework code only helps "when repetition proves real." Core's `component()` class internals are deliberately hidden (core/src/component.ts:11); adding a command hook there before the registry proves the shape would repeat the mistake this bet unwinds. Sketch:

```ts
// lib/commands.ts — typed custom-command dispatch on a component's root
export type CustomCommand = `--${string}`;
export function commands<C extends CustomCommand>(
  el: Ref<HTMLElement>,
  map: Record<C, (e: CommandEvent) => void>,   // e.source = the invoker button
): void; // setup-time; listens for 'command', dispatches by e.command
```

Built-ins need no JS at all: `ui-dialog-trigger` renders `<button commandfor="${baseId}-content" command="show-modal">`; `ui-popover-trigger` renders `command="toggle-popover"`. The `beforetoggle` seam ingests the result — trigger click handlers (popover.ts:167, dialog.ts:162) become declarative attributes. `CommandEvent.source` replaces the tracked-`previouslyFocused` heuristic for focus return. Promote a typed `commands:` option into core `component()` only if ≥3 registry families demand identical wiring.

### Tailwind v4 / top-layer animation

`display:none` toggling breaks today's tw-animate-css exit keyframes (that's why `floatingHidden` exists). Move overlay enter/exit to **discrete transitions** (theme.css already imports tw-animate-css after tailwindcss, styles/theme.css:7-8; keep it for non-overlay animation):

```html
class="transition-[opacity,transform,display,overlay] transition-discrete duration-200
       opacity-0 scale-95 open:opacity-100 open:scale-100
       starting:open:opacity-0 starting:open:scale-95
       backdrop:bg-black/50 backdrop:transition-discrete backdrop:starting:opacity-0"
```

Tailwind v4's `open:` variant matches `[open]` and `:popover-open`; `starting:` emits `@starting-style`; `backdrop:` styles `::backdrop` (replacing the hand-built overlay div, dialog.ts:199-200). Include `overlay` in the transition list so closing elements stay in the top layer through their exit.

### Per-component migration matrix (risk-ranked order)

| # | Component | Today | Target | Stays JS | Risk |
|---|---|---|---|---|---|
| 1 | tooltip | floating+portal+manager | `popover=manual` (+anchor CSS). NOT `hint` (Safari) and not `auto` (auto would light-dismiss-close a sibling popover) | provider manager, delay/skip timers, hover events | Low |
| 2 | hover-card | floating+portal | `popover=manual` + anchor CSS | open/close delay timers | Low |
| 3 | dialog | portal+layer+trap | `<dialog>` `showModal()` + `::backdrop` + `closedby="any"` | Safari outside-click shim | Low-med |
| 4 | alert-dialog | same | `<dialog>` + `closedby="none"` (matches Radix no-outside-dismiss) | none | Low |
| 5 | sheet | same | `<dialog>` + side-variant transitions | none | Low-med |
| 6 | drawer | same | `<dialog>` | drag/snap gesture code | Med |
| 7 | popover | full stack | `popover=auto` + anchor CSS + `command="toggle-popover"` | non-modal focus move-in/restore | Med |
| 8 | combobox | composes popover | inherits #7 | Command list keyboarding | Med |
| 9 | dropdown-menu | full stack + submenu | nested `popover=auto` (sub-content stays DOM-nested — no portal → native ancestor chain works) | roving-focus, typeahead, submenu hover intent | High |
| 10 | menubar | same × N | per-menu `popover=auto`, hover-across-open in JS | roving, typeahead, hover logic | High |
| 11 | context-menu | virtual pointer anchor | `popover=manual` + a 1×1 `position:fixed` anchor element placed at `clientX/Y` (anchor CSS can't target a point), or keep JS positioning here only | open-at-point, long-press | High |
| 12 | toast | fixed stack | `popover=manual` on the region — **required** once dialogs are top-layer, else toasts render under modals | queue/timers | Med |
| — | select | native `<select>` | none needed (future: `appearance: base-select`, out of scope) | — | — |
| — | navigation-menu, sidebar | inline absolute / composes sheet | defer to modern-CSS pass / inherits sheet | — | — |

## Implementation plan (phased)

- **Phase 0 — seams + recipes.** `lib/native-overlay.ts`, `lib/commands.ts`, theme.css transition recipes, feature-detect module, browser-guard harness (see Verification). No component changes.
- **Phase 1 — tooltip + hover-card.** Proves anchor CSS recipes, `popover=manual`, deletion of `floatingHidden`, scroll-listener removal. Smallest blast radius.
- **Phase 2 — dialog family** (dialog → alert-dialog → sheet → drawer). Proves `<dialog>`/`showModal`, `::backdrop`, `closedby` + Safari shim, declarative `commandfor` triggers. Deletes portal/trap/layer from four files.
- **Phase 3 — popover + combobox.** Proves `popover=auto` light dismiss against the sync seam and trigger-click exclusion (popover.ts:252-255 becomes native behavior).
- **Phase 4 — menus** (dropdown-menu, menubar, context-menu). Nested popover chains, point-anchor trick, roving/typeahead retention.
- **Phase 5 — toast to top layer; retirement.** Mark `floating.ts`/`portal.ts`/`dismissable-layer.ts` deprecated-fallback in the registry for one release, then remove; update registry.json deps and SSG notes (portaled-content caveat in dialog.ts:30-35 dies — native markup stays in the static snapshot and even works pre-hydration via `commandfor`).

Each phase lands as its own batch per the repo's landing conventions (arch-routed, ff-able), one family per commit: `refactor(ui): <family> on native overlay stack (BET02 batch N)`.

## Feature detection & fallback

**Support floor (document in registry README):** Chrome/Edge 135+, Firefox 147+, Safari 26.2+ — i.e. every engine's early-2026 release. Rationale: popover is widely-available Baseline (Oct 2026); Invoker Commands and anchor positioning are Baseline-newly with an ~18-month tail at likely land time.

- **Popover/dialog:** hard-require (`HTMLElement.prototype.showPopover`, `showModal`). No JS fallback — below-floor browsers get non-overlay content, and the registry is copy-source: consumers who need older support keep the current files (they own them; that is the registry model's escape hatch).
- **Anchor CSS:** `CSS.supports('anchor-name: --a')`. Recipes wrapped so the OddBird polyfill can be layered by consumers; do not bundle it. Spec-churn hedge: keep recipes to the stable core (`position-area`, `position-try-fallbacks` — already renamed once from `inset-area`/`position-try-options`).
- **Invoker Commands:** detect `'commandForElement' in HTMLButtonElement.prototype` at setup; if absent, attach the current `@click` handler instead (branch, don't double-wire — native support would double-fire click + CommandEvent).
- **`closedby`:** detect `'closedBy' in HTMLDialogElement.prototype`; if absent (Safari, Interop 2026 target), activate the slim outside-pointerdown shim for dialogs only. Delete the shim when Safari ships.

## Interactions with other bets

- **moveBefore bet** (ADR 0030.2:220-226): top layer removes the overlay reparenting that made `portal.ts` the hairiest ADR 0023 consumer; `moveBefore()` adoption then only needs to serve `each()`. The bets are complementary — this one shrinks that one's scope.
- **Modern-CSS pass:** anchor recipes, `@supports` gating conventions, and discrete-transition idioms should be co-designed there; navigation-menu's `absolute top-full` positioning is that pass's natural anchor-CSS candidate.
- **Agent-native CommandEvent legibility** (ADR 0029/0030): this bet is that bet's substrate. `<button commandfor="x" command="show-modal">` makes overlay wiring **statically legible** in a serialized DOM — an agent reading the page knows what every trigger does without executing JS; `ui-open-change` remains the reactive channel. Choose custom command names (`--open`, `--dismiss`) as a stable, documented vocabulary.

## Risks & open questions

1. **`@position-try` cannot set `transform-origin` or custom properties** (only inset/margin/size/position-area). The flip-aware `data-side` slide/origin animations (floating.ts:85-106) have no pure-CSS equivalent. Mitigation: a one-shot resolved-side observer on `toggle` (compare rects, set `data-side`) — ~30 LOC, runs once per open, not per scroll. Fallback: accept center-origin zoom (minor fidelity loss vs upstream shadcn).
2. **Light-dismiss semantics delta:** native `popover=auto` closes the entire chain above the clicked level; today's LIFO stack closes only the topmost per click (dismissable-layer.ts:57-65). Menus mostly want the native behavior, but it's a documented behavior change.
3. **Controlled-open veto timing** — `beforetoggle` cancelability on hide varies; verify per engine, otherwise rely on the one-frame re-show (see design).
4. **Anchor spec churn** — Interop 2026 focus reduces but doesn't eliminate risk; one rename cycle already happened.
5. **Submenu hover-intent + nested top layer** — safe-triangle logic must coexist with native popover nesting; menubar is the stress test.
6. **happy-dom cliff** — the entire unit suite (packages/ui/vitest.config.ts:6) lacks popover/dialog/CommandEvent/anchor support; behavior coverage must shift to browser guards (below) with thin shims for state-machine unit tests.
7. **`open` attribute name collision** on `<dialog>`: never author native `open` directly (spec footgun — skips top layer); the seam only calls `showModal()`/`close()`; ui-host `open` attribute and native dialog state stay distinct layers.

## Verification plan

- **Unit (vitest/happy-dom):** keep testing the signal/attribute state machine through a minimal `showPopover`/`beforetoggle` shim in test setup; existing PATTERN A tests (popover.test.ts, dialog.test.ts) stay green with the shim.
- **Per-family browser regression guards** (repo convention, per the UI-30 precedent): a Playwright spec per migrated family asserting open/close, light-dismiss, Esc, nested LIFO/chain close, anchor flip at viewport edge (viewport resize), focus move-in/restore, exit-transition completion, and toast-above-modal stacking. Run chromium + **webkit** (webkit exercises the closedby-shim path).
- **www previews:** the repo's `preview-sweep.mjs` guard (packages/www/package.json:13, `pnpm --filter www test:previews`) already sweeps every /ui preview — it must pass unchanged after each phase. Gotcha: vitest wipes dist assets; rebuild before sweeping. Any new harness lands with the cleanup-checklist attestation in the review request (repo review convention).
- **SSG:** a render test asserting overlay markup now appears in static snapshots (the portal-escape caveat inverts).

## Size estimate

Net **deletion** bet: ~600-700 LOC of lib machinery removed (floating/portal/dismissable-layer + most of focus.ts) against ~250-350 LOC added (native-overlay seam, commands helper, Safari shim, side observer, CSS recipes). Component diffs across 12 families are mostly template + wiring changes. Estimate: **5-8 engineer-weeks** across the six phases including guards, parallelizable per family across the fleet after Phase 0-1 establish the recipes (Phases 2-4 are three independent tracks). Registry docs + support-floor documentation: ~2 days. Recommend a sub-ADR (0031-native-overlay-stack) capturing the support floor and the `beforetoggle` seam before Phase 1 lands.
