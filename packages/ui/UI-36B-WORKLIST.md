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
