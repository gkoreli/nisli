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
  tokens, 356px width, radius. Not implemented (documented v1 scope): per-type
  icons, loading/promise toasts, swipe/exit animations. FIXED this batch:
  `visible-toasts` declared as a live number attr (was factory-only). Manual
  side-by-side: ☐
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
