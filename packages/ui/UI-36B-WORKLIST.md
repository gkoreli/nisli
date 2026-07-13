# UI-36B visual-parity worklist

Audit source: `/Users/goga/Documents/goga/shadcn-ref/apps/v4/registry/new-york-v4/ui`.
Scope: registry component names beginning with `m` through `z` (boundary confirmed
with eng2; wave B begins at `marker`). Each entry compares the checked-in upstream
TSX against the Nisli component's rendered markup and class lists.

## Batch 1 — marker through progress

- [x] `marker` — markup, slots, variants, and class lists match. Intentional:
  Nisli factories replace React `asChild`/prop spreading.
- [x] `menubar` — rendered primitives, slots, indicators, icons, and class lists
  match. Intentional: plain-DOM ARIA/menu state, focus, positioning, portal, and
  dismissable-layer behavior replace Radix primitives; transparent provider/group
  hosts render `display: contents` wrappers.
- [x] `message-scroller` — rendered slots and all upstream class lists match.
  Intentional: Nisli context and scroll listeners replace Base UI hooks; the
  provider has a transparent `data-slot="message-scroller-provider"` wrapper.
- [x] `message` — six rendered parts, alignment/variant data attributes, slots,
  and class lists match. Intentional: Nisli factories replace React prop spreading.
- [x] `navigation-menu` — root/list/item/trigger/link class lists match. Intentional
  platform divergence: the current plain-DOM implementation is fixed to
  `data-viewport="false"`; content uses the upstream no-viewport visual treatment,
  while Radix motion variables, `NavigationMenuViewport`, and
  `NavigationMenuIndicator` are not implemented. Nisli supplies hover/click state,
  ARIA correlation, roving focus, and delayed close directly.
- [x] `pagination` — native element structure, slots, ARIA, icons, and class lists
  match. Intentional: links are always native anchors and use Nisli's copied
  `buttonVariants` rather than React/Radix `asChild` composition.
- [x] `popover` — content/header/title/description markup, slots, and class lists
  match. Intentional: plain-DOM state, positioning, focus trap, portal, and
  dismissable layer replace Radix; trigger/anchor wrappers follow Nisli factory
  composition.
- [x] `progress` — root/indicator slots and class lists match. Intentional: the
  plain-DOM implementation supplies the Radix progressbar ARIA contract and a
  configurable `max`; transform is calculated from normalized value/max.

No real visual drift found in batch 1; no registry source changes required.

## Batch 2 — radio-group through switch

- [x] `radio-group` — group slot/class matches. Intentional native-first
  divergence: a real radio input adds `appearance-none` and a radial-gradient
  checked mark instead of Radix's separate indicator/span/SVG tree; this preserves
  native forms, keyboard behavior, and validation while matching the visual.
- [x] `resizable` — group/panel/handle slots, orientation selectors, handle box,
  grip icon size, and class lists match. Intentional: pointer/keyboard sizing and
  separator ARIA values are implemented locally instead of `react-resizable-panels`.
- [x] `scroll-area` — root and viewport visual classes match. Intentional
  native-first divergence: `overflow-auto` and local cross-browser scrollbar CSS
  replace Radix's separate scrollbar/thumb DOM; those upstream-only slots/classes
  are therefore absent.
- [x] `select` — this registry's native-first `Select` corresponds to upstream
  `native-select.tsx`, not Radix `select.tsx`. Wrapper/select/icon markup, slots,
  and every visual class match that source. Intentional: option/optgroup remain
  projected native elements rather than separate factories.
- [x] `separator` — orientation sizing, slot, semantic/decorative ARIA, and class
  lists match. Intentional: real div replaces the Radix separator primitive.
- [x] `sheet` — overlay/content/header/footer/title/description/close markup,
  slots, variants, icon, and class lists match. Intentional: plain-DOM dialog
  state, focus trap, portal, and dismissable layer replace Radix; transparent
  root/portal wrappers remain in the rendered Nisli tree.
- [x] `sidebar` — desktop frame and all part-family visual classes/data attributes
  match, including variants, rail, inset, menu variants/actions/badges/skeletons,
  and submenus. Intentional documented v1 divergences: upstream's dedicated mobile
  Sheet tree is deferred, collapsed menu tooltips are absent, and `asChild` is not
  supported; Nisli context/events replace React provider callbacks.
- [x] `skeleton` — markup, slot, and complete class list match.
- [x] `slider` — intentional native-first rendering: one real range input uses
  browser track/thumb pseudo-elements and a gradient fill instead of Radix's
  root/track/range/thumb tree. It preserves the upstream muted track, primary
  range, bordered 4-unit thumb, shadow, ring, and disabled visuals; vertical and
  multi-thumb modes are explicitly deferred.
- [x] `spinner` — SVG path, role/label, slot, and `size-4 animate-spin` match.
  Nisli additionally permits role/label overrides and projected SVG children.
- [x] `switch` — intentional native-first rendering: a real checkbox plus absolute
  thumb replaces Radix spans while preserving upstream sizes, colors, rings,
  shadows, checked translation, slots, and disabled visuals. The extra wrapper is
  required to position the thumb and is recorded as `switch-wrapper`.

No real visual drift found in batch 2; no registry source changes required.

## Batch 3 — table through tooltip (arch)

- [x] `table` — all 9 class strings, slots, and table elements verbatim-match
  (mechanical containment check). Intentional: declared colspan/rowspan attrs
  replace prop spreading. Manual side-by-side: ☐
- [x] `tabs` — root/list/trigger/content class strings byte-identical incl. the
  line-variant `after:` indicator; variant taxonomy identical. Nits (inert):
  extra `data-value` on trigger (roving plumbing); Radix's `data-orientation`/
  `data-disabled` on trigger absent — no shipped selector depends. Manual
  side-by-side: ☐
- [x] `textarea` — class string byte-identical. Gap: `aria-invalid` cannot reach
  the class-bearing inner element (lands on the display:contents host) →
  **UI-44** (registry-wide sweep, eng2's input-otp mechanism). Manual
  side-by-side: ☐
- [x] `toast` — NO-UPSTREAM (sonner.tsx is a theming shim over the sonner npm
  package; no upstream DOM exists). Shim's visual contract honored: popover
  tokens, 356px width, radius. **UI-50 IMPLEMENTED/EVIDENCED** the shim's five
  inline Lucide icons: success/info/warning/error use `size-4`, loading uses
  `size-4 animate-spin`, persists until dismissed by default, and default
  intentionally has no icon. Loading is now a first-class toast type/API;
  promise toasts, swipe, and exit animations stay out of scope. Earlier parity
  work declared `visible-toasts` as a live number attr (was factory-only).
  Tests assert every type/icon path, default omission, and loading lifetime.
  **UI-62** groups the optional icon and title in a semantic flex row, keeping
  default no-icon titles flush while descriptions and action-space remain
  separate vertical rows; built CSS/Chromium covers desktop and 390px wrapping.
  Manual side-by-side (including icon/content row layout): ☐
- [x] `toggle` — variant taxonomy + all class strings byte-identical. Same
  `aria-invalid` delivery gap → UI-44. Manual side-by-side: ☐
- [x] `toggle-group` — class strings byte-identical (incl. upstream's own
  never-matching `data-[spacing=default]` quirk, kept verbatim). FIXED this
  batch (real drift): dead group-level `disabled` prop now disables every item
  (Radix Root semantics, live attr); per-item `variant`/`size` added (group
  wins when set, upstream `context.variant || variant`); `data-variant`/
  `data-size` now omitted when unset (upstream DOM contract; nothing targeted
  `="default"`). `aria-invalid` gap → UI-44. Manual side-by-side: ☐
- [x] `tooltip` — content class string byte-identical; drift FIXED this batch:
  default delay 700 → 0 (shadcn's TooltipProvider pins `delayDuration={0}`,
  tooltip.tsx:9 — Radix's raw 700 was wrong); `delay-duration`/`side-offset`
  declared as live number attrs; BUG found+fixed: per-call close-closure broke
  the module manager's identity tracking, so open→close→reopen self-closed —
  one stable `close` per tooltip now. Arrow parity **resolved in UI-46**:
  upstream SVG/class DOM is rendered and shared floating positioning follows
  collision-flipped side while clamping toward the anchor;
  `origin-(--radix-tooltip-content-transform-origin)` var unset +
  exit animations unreachable (**UI-45**, registry-wide, architect); trigger
  state/ARIA parity **resolved in UI-51**: `data-state` distinguishes
  `closed|delayed-open|instant-open` from the timer/skip manager's real path,
  and `aria-describedby` exists only while content is open. Manual
  side-by-side: ☐

Cross-cutting (recorded): the `aria-invalid:` variants in textarea/toggle/
toggle-group class lists have no delivery path onto the inner element —
ticketed **UI-44** (cdx2), reference mechanism = eng2's input-otp (70c0bb2).

Cross-cutting base-style drift **implemented in UI-55**: the copied theme now
faithfully includes upstream's `* { @apply border-border outline-ring/50; }`
base rule. Bare Tailwind v4 borders no longer fall back to near-black
`currentColor`; wave-B border holds share this registry-level fix. A real
Tailwind build + Chromium computed-style proof covers both coupled defaults.
The three manual holds below remain open until post-deploy human recheck.

Button-group cohesion **translated for Nisli transparent hosts (UI-61)**: pinned
new-york-v4 correctly targets direct painted children, but Nisli's direct
children are layout-transparent `ui-button` / `ui-button-group-text` hosts.
The registry retains the upstream selectors for native/plain children and adds
parallel selectors for the inner painted slots, including focus stacking,
horizontal/vertical corner + shared-border collapse, and nested-group gap.
This is intentional platform translation, not byte-verbatim drift. Built CSS
and Chromium geometry at desktop + 390px cover the joined control; separator
composition remains supported.

### Transparent-host child-selector census

**ContextMenu touch parity (UI-63):** the trigger retains desktop
`contextmenu` behavior and adds Radix's 700ms touch/pen long press, anchored at
the initial touch point. A 10px movement threshold permits finger jitter;
release, cancellation, scroll, and disconnect clear pending timers. Synthetic
click/native-menu follow-ups are suppressed. Unit and actual-component CDP
touch proofs cover positive duration plus short-tap/move/cancel negatives and
desktop right-click at 390px.

**Carousel touch settle parity (UI-65):** pointer identity/capture plus document
fallback now owns the complete drag lifecycle. An 8px axis lock yields
cross-axis scrolling; distance and velocity project to the nearest bounded
slide; edge offsets clamp; up/cancel/scroll/disconnect always snap. Slide step
uses actual rendered item spacing (the upstream `-ml-4` / `pl-4` geometry), not
viewport width, eliminating cumulative 16px drift. `data-active`, `aria-hidden`,
`aria-current`, and navigation controls update with the settled index. An actual
compiled registry component at 390px proves CDP swipe/tap/cross-axis negatives,
painted-slide bounds, track clamp, buttons, and keyboard.

**MessageScroller hydration pin (UI-66):** initial replace hydration now pins
after two layout frames, once projected rows have real geometry. Mutation and
resize changes share that post-layout scheduler only while the viewport remains
within the bottom threshold; a user scroll cancels a pending initial pin and
disables sticky updates until they return to the end. Observer and RAF resources
are disconnected/cancelled on teardown. Unit and actual compiled Chromium 390px
proofs cover initial late layout, appended rows, resize, user scroll preservation,
and the explicit scroll-to-end control.

Mechanical audit of registry class lists for direct-child arbitrary variants,
`*:` variants, positional first/last rules, and `divide-x/y` utilities. The
classification is about the actual rendered target, not token similarity.
`REACHABLE` means the selector reaches a native/projected painted child; `N/A`
means the candidate is internal or does not cross a transparent host;
`TRANSLATED` means Nisli already supplies the required descendant path; `DEAD`
means a transparent component host intercepts the selector. No `divide-x/y`
candidate exists in the registry at this census.

| File | Selector family / intended target | Class | Reason / disposition |
| --- | --- | --- | --- |
| `sidebar.ts` | `>button`, `>svg`, `>span:last-child` | REACHABLE | Rules live on painted native nodes and target their native children. |
| `menubar.ts`, `context-menu.ts`, `dropdown-menu.ts` | destructive `*:[svg]` | REACHABLE | Menu item inner nodes receive projected raw SVG children. |
| `avatar.ts` | overlap and ring on avatar boxes | TRANSLATED | Explicit-depth overlap and `**:` ring paths already cross the transparent avatar hosts. |
| `item.ts`, `empty.ts`, `marker.ts` | direct projected anchors | REACHABLE | Text/content inner nodes own projected native anchors. |
| `form-field.ts` | `&>*`, direct field label/content | DEAD — UI-58 | Field root sees transparent field component hosts rather than their painted slots. |
| `input-otp.ts` | slot `first:` / `last:` rounding and border | TRANSLATED — UI-57 | Group-owned selectors carry host-sequence position to the painted slot. |
| `button-group.ts` | nested gap, focus, shared border, first/last corners | TRANSLATED — current change | Parallel explicit paths target button/text painted slots while retaining upstream native-child rules. |
| `message.ts` | direct self-end message child | TRANSLATED — UI-60 | An explicit descendant path reaches the slot-bearing painted node behind its transparent host. |
| `breadcrumb.ts` | separator `>svg` | REACHABLE | The separator inner node directly owns its SVG. |
| `input-group.ts` | direct textarea/input/alignment/addon button/kbd | DEAD — UI-58 | Composition interposes input/addon/button hosts; descendant raw-SVG rules remain reachable. |
| `alert.ts`, `badge.ts`, `alert-dialog.ts` | direct/projected SVG and alert description | REACHABLE | The styled inner nodes directly own the native/projected targets. |
| `table.ts` | footer `>tr`, cell/header direct checkbox | DEAD — UI-59 | Table section/cell hosts interpose between styled inner elements and painted row/control; descendant `tr:last-child` remains reachable. |
| `attachment.ts` | attachment, spinner, and direct image | MIXED / TRANSLATED — UI-60 | AttachmentGroup attachment slots and AttachmentMedia spinner slots use translated descendant painted paths; the real direct `img` selector remains REACHABLE / UNCHANGED. |
| `calendar.ts` | cell/button/span first/last and direct descendants | N/A | DayPicker generates the native table/button/span structure within the painted calendar root. |
| `toggle-group.ts` | item `first:` / `last:` corners and border | TRANSLATED — UI-57 | Group-owned selectors carry host-sequence position to zero-spacing painted items. |
| `command.ts` | `**:` command descendants | TRANSLATED | Descendant variants intentionally cross transparent command hosts. |
| `accordion.ts` | item `last:border-b-0` | TRANSLATED — UI-57 | The accordion root now targets the painted descendant of its last item host. |
| `bubble.ts` | direct bubble-content variants and hover paths | TRANSLATED — UI-60 | Descendant variant and hover paths reach bubble content behind its transparent host. |
| `pagination.ts` | compositional-root child contract | N/A | No direct-child utility targets a component-hosted painted child; icon rules live on native controls. |

UI-61 fixed ButtonGroup. UI-57 closes toggle-group, input-OTP, and accordion
positional semantics with DOM and built Tailwind/Chromium first/middle/last
coverage at desktop and 390px. UI-58 owns form-field/input-group; UI-59
owns table; UI-60 closes attachment/message/bubble. The census is deliberately
ticketed rather than silently broadening this parity fix.

## Manual side-by-side pass — wave B (arch, 2026-07-12, vs live 39a8d36 + UI-53 contact sheets)

**Baseline correction (process-significant):** ui.shadcn.com now defaults to
the "Base UI" (nova) style — the LIVE SITE is no longer our parity baseline.
Judgments below use the pinned `new-york-v4` CHECKOUT (class-verified in the
batches above) as truth; site comparisons annotated where nova drift explains
a visible delta. ADR 0022's manual-pass wording is amended accordingly (same
commit as this correction).

**VERIFIED ☑ (13 — 10 clean + 3 nova-annotated):** pagination, separator,
select (native-first baseline), slider, spinner, switch, tabs, textarea,
toggle-group, menubar (open-state verified) — no visible differences;
radio-group ☑ (classic dot indicator per new-york-v4; site shows nova donut
= baseline drift, not ours), progress ☑ (h-2 per checkout; site's thinner
bar = nova), skeleton ☑ (demo-markup delta only).

**RECHECK POST-UI-55 ⏸ (3):** table, scroll-area, resizable — class parity
verified; the observed near-black borders are the missing base-layer
border-color compat rule (UI-55, theme.css), a global token bug, not
component drift. Flip after the UI-55 fix deploys. (scroll-area: also
confirm the local scrollbar-thumb CSS actually paints a thumb.)

**DEFECT — OPEN ✗:** sheet (UI-54: style-attr feedback loop paints
display:contents onto the fixed panel; open state visibly broken on live).

**INVESTIGATE → ticketed UI-56:** popover open-state renders right-shifted
vs centered under its trigger (floating `align` math or preview-frame
interference — needs a browser look; fix-or-disposition, queued behind
UI-54 in the codex lane).

**CURATION → ticketed WWW-14 (eng3, after WWW-13):** six wave-B items —
toggle (auto-default renders empty/invisible — needs an iconed example),
navigation-menu (demo is links-only; dropdown surface unassessable), sidebar
(preview container inflated ~965px by min-h-svh; header clips demo top),
marker + message + message-scroller (NO-UPSTREAM; current examples render
bare/undesigned — human call: needs a designed example, not a component
fix). WWW-14 also carries the two wave-A recaptures (empty, input-group) —
those are eng2's ledger, listed here only for the ticket's scope.

**DEFERRED (stale live copies — next resync+deploy):** tooltip (UI-46 arrow
+ UI-51), toast (UI-50 icons).

**Criterion-2 closure equation (wave B stays OPEN until every term is
VERIFIED, not merely fixed/deployed):**
13 ☑ (above)
+ 3 held → verified only by a post-UI-55 recheck against the deployed fix
+ 1 sheet → verified only by a post-UI-54 recheck (open panel, real box)
+ 1 popover → verified only after UI-56 resolves (fix-or-disposition)
+ 6 curation → verified only against the WWW-14-curated examples
+ 2 stale → verified only against the next resync+deploy generation
= 26 wave-B surfaces. Planned fixes, landings, and deploys close NOTHING
here — only performed rechecks flip a term. (Wave A's parallel equation:
27 ☑ + avatar-batch-2 visual + 2 recaptures + sidebar mobile, per 0c64b71.)

## Recheck round 1 — vs payoff deploy bca6c5d1 / origin 5f0a76d (arch, 2026-07-12)

Method: headless-chromium computed values + screenshots per term (evidence in
session scratchpad `recheck/`).

- **sheet ☑** — UI-54 verified live: `[data-slot=sheet-content]` fixed to the
  right edge (x=1056..1440, full height), `w-3/4` capped by `max-width:384px`,
  opaque bg, hairline left border, close X inside the panel at top-4/right-4;
  `getAttribute('style')` = null (no display:contents), computed `flex`.
- **table ☑** — UI-55 verified live: row borders `oklch(0.922 0 0)` =
  rgb(229,229,229) 1px hairline (our token, exact).
- **resizable ☑** — frame/handle borders + bg-border all rgb(229,229,229).
- **tooltip ☑** — UI-46/UI-51 verified live: opens ~67ms after hover (no 700ms),
  arrow present (`size-2.5 rotate-45 bg-foreground`, 45° matrix, ~9.7px) at the
  trigger-facing edge, content above trigger.
- **scroll-area — separators ☑, scrollbar term RE-SCOPED:** border rgb(229,229,229)
  ✓; the thin themed scrollbar is INJECTED AT RUNTIME by the component
  (scroll-area.ts once-per-document stylesheet) and the static preview never
  runs the injector — registry correct, preview needs hydration → **WWW-14**.
- **toast ✗ RE-SCOPED — live demo INERT:** `ui-button`/`ui-toaster` never
  defined on /ui/toast (sidebar-* defined; hydrate.js 200; zero errors; 4 clicks
  → zero DOM change). Root class: the RC3 curation gave toast an interactive
  example WITHOUT hydrate-set membership. UI-50 icons therefore UNVERIFIABLE
  this generation → **WWW-14** (hydrated toast example + the inert-island guard
  extension: every ui-* element present in a preview must be DEFINED
  post-hydration — toast passed 67/67 while dead, a guard class-miss now named).

**Equation after recheck round 1:**
17 ☑ (the original 13 + four completed flips: sheet, table, resizable,
tooltip — scroll-area is NOT among them: only its separator/border sub-check
verified; the surface itself stays open on the scrollbar sub-check and is
counted once, below, among the re-scoped two)
+ 1 popover → UI-56 landed, recheck vs the WWW-14 generation
+ 2 re-scoped (toast icons, scroll-area scrollbar) → WWW-14 generation
+ 6 curation → WWW-14 generation
= 26. Every remaining wave-B term closes against exactly ONE event: the
WWW-14 deploy. (Wave A: closed at 75d77da, avatar residual also on WWW-14.)

## Recheck round 2 — vs live (WWW-14 generation, Version eec3b3e8) (arch, 2026-07-12)

- **popover ☑** — UI-56 verified live: panel centered under trigger to
  0.008px (centerX 767.992 vs 767.984), body-portaled, unclipped. Preview
  cosmetic note: panel overhangs the preview frame's bottom border ~20px
  (frame sizing, not component drift).
- **navigation-menu ☑ (curation term)** — dropdown opens on hover
  (data-state=open, 338×204) with three designed link entries.
- **marker ☑ (curation term)** — designed checklist demo (leading icons
  inline with labels), reads as intended.
- **scroll-area ☑ (scrollbar sub-check, platform note)** — the injected CSS
  resolves post-hydration (`scrollbar-width: thin`,
  `scrollbar-color: var(--border) transparent` computed on the viewport);
  no at-rest thumb in headless macOS = overlay-scrollbar platform behavior,
  not a defect. Surface closed.
- **toast — STAYS OPEN, defect named → UI-62:** typed toasts fire with
  correct `size-4` icons (UI-50 works), but the icon renders on its own
  line ABOVE the title (toast `li` is flex-col; icon is a direct sibling) —
  the icon+title row wrapper is missing. The UI-50-era layout flag is now a
  confirmed live defect. (Demo also lacks a default-type button; the
  default-no-icon contract is test-covered only.)
- **toggle / message-scroller — on the WWW-15 wave:** both inert/static on
  live (toggle's `ui-toggle` never registered; scroller not pinned to
  bottom) — the exact class the derived-hydration flip eliminates.
- **sidebar — DISPOSITION RULED: iframe preview.** The hydrated demo
  fixed-positions to the VIEWPORT (x0 y0 256×900), painting over the site's
  own docs nav, while the preview box shows only "Main content"; wrapper
  duplicated (double-render class — dies with the derivation refactor). A
  full-viewport app-shell component cannot render honestly in a bounded
  box; upstream previews sidebar via iframe (`/view/sidebar-07`, recorded
  in UI-53's manifest). Routed to the wave.
- **message — curation term stays open:** designed demo with real nits —
  align-end avatar detaches to bottom-right (possibly UI-60's
  projected-slot class, noted to eng2), full-width code block splits a
  sentence with an orphaned period, name/timestamp lack a gap.

**Equation after round 2:** 21 ☑ (17 + popover + nav-menu + marker +
scroll-area) + 5 open: toast (UI-62 row fix), toggle + message-scroller +
sidebar-iframe (all on the WWW-15 wave deploy), message (curation polish)
= 26. Every open term rides the wave or its named ticket; only performed
rechecks flip.

## Recheck round 3 — vs live 02dfe720 (arch, 2026-07-12 evening)

- **toast ☑** — UI-62 verified live by rect geometry: icon and title share
  y=823 in a `gap-2` heading row (was stacked); typed toasts fire with
  correct icons. Note: the demo offers no untyped trigger, so the
  default-no-icon contract remains test-covered only (UI-50 suite).
- **toggle ☑ (component)** — interactivity verified live: the uncontrolled
  toggle flips on↔off with accent bg both directions. The demo's FIRST
  toggle stays pinned (`pressed: true` controlled example) — the approved
  `defaultPressed` example fix rides the next www batch (queued, eng3).
- **message — avatar sub-check ☑** (UI-60 verified live: align-end avatar
  beside content, 8px gap, self-end — mirror of align-start). Two nits
  ticketed **UI-67**: name/timestamp 0px gap (flex swallows whitespace);
  inline `code` computes display:block and orphans the period.
- **message-scroller ✗ → UI-66**: hydrated but NOT pinned to bottom on load
  (scrollTop=0, 206px from bottom) — stick-to-bottom inactive under
  replace-hydration; registry fix + hydrated-mount regression.

**Wave-B FINAL equation:** 24 ☑ of 26 surfaces. Open: message-scroller
(UI-66, owned) + sidebar PREVIEW presentation (iframe strategy, cdx2
queued — the component itself is class-audited + desktop-live-verified +
mobile-drawer-proven; only the /ui/sidebar preview box remains dishonest).
Plus three named polish items with owners: UI-67 ×2, toggle example.
Every open item is ticketed, owned, and none blocks a truthful 1.0 call —
they are the exact known-opens the go/no-go package presents.
