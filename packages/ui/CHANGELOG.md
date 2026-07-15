# Changelog

All notable changes to `@nisli/ui`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

## 0.3.0 — 2026-07-12

The typed-props + animation-fidelity release. **Requires `@nisli/core`
>= 0.53.0** — copied source now uses core's declared-type-aware
`ReactiveProps` (`ComponentAttrs` + the second `component()` type argument),
so every declared boolean/number prop is typed exactly and the registry
carries zero `as boolean` casts.

### Added
- **Sidebar: mobile off-canvas drawer** — below the breakpoint the sidebar
  renders through a Sheet (focus trap, Escape, controlled `openMobile`),
  matching upstream's mobile branch; previously a documented v1 deferral.
  `SidebarMenuButton` gains an `href` anchor mode (real `<a>` +
  `aria-current`) so sidebars can be zero-JS navigation.
- **Command: active-descendant wiring** — items carry generated ids and the
  input tracks `aria-activedescendant`, restoring the cmdk a11y contract
  (benefits combobox too).
- **`aria-invalid` delivery registry-wide** — every form control whose class
  list carries `aria-invalid:` variants now forwards the attribute to the
  class-bearing inner element (declare the prop, live attribute included),
  so invalid-state visuals are actually reachable past the
  `display: contents` host.

### Fixed
- **Floating-layer animation fidelity** — `lib/floating.ts` now sets the
  primitive's `transform-origin` variable (zoom animates from the anchored
  edge, as in Radix) and overlays keep `data-state="closed"` visible until
  `animationend`, so exit animations actually render; synchronous hide
  remains the no-animation fallback.
- **Sheet: content `style` passthrough** restored (upstream prop-spread
  parity; the sidebar's mobile width var rides it).

### Setup
- **`tw-animate-css` is now a documented requirement** (upstream parity:
  the shadcn v4 style injects `@import "tw-animate-css"`). `init` surfaces
  it and the README install steps carry it — without it, the registry's
  `animate-in/out` utilities resolve to no animation. Dev-tooling only;
  copied source still has zero runtime dependencies.

## 0.2.1 — 2026-07-12

The published-consumer hardening release: the copy-in flow is now proven
against the real npm package end to end, and the first systematic
visual-parity sweep against the shadcn `new-york-v4` checkout landed its
fixes. No API breaks; requires `@nisli/core` >= 0.52.0 (unchanged).

### Fixed
- **Published break**: `lib/utils.ts` carried a stale `@nisli/core` import
  that failed a stock Vite strict `tsc` in consumer projects — the npm-e2e
  gate caught it against the live 0.2.0 package. Also swept the three other
  stock-strict offenders (calendar, carousel, input-otp).
- **Tooltip**: default delay is now 0 (shadcn's `TooltipProvider` pins
  `delayDuration={0}` — the Radix raw 700ms was wrong), and a re-opening
  tooltip no longer closes itself (per-call close closures broke the
  module manager's identity tracking).
- **Toggle-group**: group-level `disabled` now actually disables every item
  (it was a dead prop); `data-variant`/`data-size` are omitted when unset,
  matching upstream's DOM contract.
- **Resizable**: panels deregister on disconnect and live `min-size` writes
  re-clamp the current layout (previously stale membership + inert
  constraint changes).
- **Input-OTP**: ported the missing active+invalid state tokens and made
  `aria-invalid` actually reach the class-bearing slot element — the
  reference mechanism for delivering ARIA state past a `display:contents`
  host (registry-wide sweep in flight).
- **Command dialog**: upstream `h-12` input height; sr-only DialogTitle/
  Description restore the Radix-required dialog a11y contract.
- **Checkbox**: background `url()` arbitrary value no longer trips
  lightningcss (entity-encoded quotes).

### Added
- **Portal adoption completed to upstream parity** (audit of all floating
  surfaces): hover-card, drawer, and the composed combobox now portal to
  `<body>` by default (with the uniform `portal="false"` opt-out); native
  select, toast, and navigation-menu stay inline because upstream does.
- **Per-item `variant`/`size` on toggle-group items** (group wins when set,
  upstream precedence) and **group `disabled` as a live attribute**.
- **More live attributes**: tooltip `delay-duration`/`side-offset`, toaster
  `visible-toasts` (declared `number` attrs; were factory-only).
- **Toast**: Escape dismisses the newest toast without stealing focus.

### Infrastructure
- CI now runs on every push to `main`, runs the hermetic tarball e2e in the
  test job, and runs a **published-npm consumer e2e** (real registry install
  → init/add → rendered themed dialog → all-registry strict typecheck with
  exact known-diagnostic gating) in an isolated job.
- A registry-integrity test bans bare npm imports in every shipped registry
  file (TS AST + CSS `@import`/`url()` scan) — zero-runtime-deps is now
  enforced, not conventional.
- Visual-parity worklists
  ([UI-36A](../../docs/worklists/ui/UI-36A-WORKLIST.md) /
  [UI-36B](../../docs/worklists/ui/UI-36B-WORKLIST.md)) record the per-component
  audit against the shadcn reference checkout, per the ADR 0022 process
  amendment.

## 0.2.0 — 2026-07-11

The registry rides the new core primitives end to end. Component names,
tags, and props are unchanged — but every attribute is now LIVE, state
roots follow the native `dialog[open]` model, and the userland helper
layer is gone. **Requires `@nisli/core` >= 0.52.0.**

### Added
- **Live attributes everywhere** — all 58 components declare their
  attributes via core's `attrs` option: `setAttribute()` after mount now
  updates the component (previously parse-time-only). Boolean semantics
  unchanged (bare = true, literal `"false"` = false, declared defaults);
  numeric attributes (slider, progress, resizable, table spans, calendar)
  are parsed live with garbage-behaves-as-absent semantics.
- **Attribute-as-truth state roots** — overlays (`open`), selection roots
  (`value`, comma-separated when multiple), and toggle (`pressed`) treat
  the attribute as the uncontrolled state, exactly like native
  `<dialog open>`: plain-HTML authoring, live toggling, and CSS attribute
  selectors all work; controlled (factory-signal) usage still wins and
  reflects.
- **subtree context migration** — registry families now use the core
  `createContext` flow instead of the `__uiX`/`closest()` convention. Misuse
  errors are actionable element-language — `<ui-dialog-content> must be used
  inside <ui-dialog>` — at every family.
- **table** — `colSpan`/`rowSpan` on `TableHead`/`TableCell` (live).
- **label** — `htmlFor` maps to the native `for` attribute.

### Changed
- Content projection is core's `children()` primitive; the copied
  `captureChildren`/`projectChildren` dance is gone from every component.
- **Removed from `lib/utils.ts`**: `attr`, `boolAttr`, `forwardedAttr`,
  `projectChildren` — the registry no longer uses them. If your copied
  code calls them, migrate to the `attrs` option / `children()`
  (`captureChildren` remains for native text-value capture).

## 0.1.3 — 2026-07-11

The largest release since 0.1.0: the registry reaches the complete portable
shadcn surface, every overlay escapes clipping ancestors by default, and the
whole library is now dogfooded by nisli.dev instead of a demo fixture.

### Added
- **calendar** — original Intl month-grid engine under exact v4 visuals:
  single + range selection, full WAI-ARIA date-grid keyboard navigation,
  month-clamped focus entry. Hardened across four review rounds; birthplace
  of the resolved-composition porting doctrine (ADR 0022).
- **Chat family** — message, bubble, attachment, and message-scroller
  (stick-to-bottom with scroll-position awareness; parser children replace
  default content).
- **sidebar** — the full ~23-part composite: provider state with cookie
  persistence and Cmd/Ctrl+B, rail + icon-collapse variants, the complete
  menu/group family.
- **input-otp** — one-time-code input on a single native `<input>`.
- **combobox** — Popover + Command composition with trigger-width matching.
- **carousel**, **resizable**, **drawer** — pointer-drag behavior ports.
- **toggle**, **toggle-group**, **scroll-area**, **aspect-ratio**, **kbd**,
  **spinner**, **button-group**, **input-group**, **empty**, **item**,
  **direction**, **marker**, **hover-card**, **navigation-menu**,
  **context-menu**, **menubar**, **pagination**, **breadcrumb**, **table**,
  **avatar**, **progress**, **toast**, **command** *(those not already in
  0.1.2)* — completing every portable item in the reference; `form` and
  `chart` are deliberate non-ports (see NORTH-STAR).
- **portal** (lib) — reparent overlays to `<body>` with preserved reactivity
  and disposal ownership; **adopted by every overlay** (dialog, alert-dialog,
  sheet, tooltip, popover, all menus) — the transformed-ancestor caveat is
  gone, with a `portal="false"` opt-out.
- **use-mobile** (lib) — viewport signal helper.

### Changed
- `@nisli/core` gains awaitable `tick()` (bounded settle contract) and
  cascade-draining `flushEffects()`; `@nisli/ssg` snapshots after microtask
  settling — plain-HTML-authored content is now reliable in static output.
- `query()` — **`refetch()` now bypasses `staleTime`** (an explicit refetch
  is a force; it still joins a same-key in-flight request).
- Template slots now mount primitives after `undefined` starts and factory
  results in static arrays; `component<P>` accepts interfaces; typed
  template event handlers exported.

### Removed
- **packages/ui/demo** — superseded by nisli.dev (`packages/www`), which
  renders a live preview of every registry item under a CI guard.

## 0.1.2 — 2026-07-11

### Added
- **resizable** — panel groups with pointer + keyboard resizing, min-size
  clamping, nesting (react-resizable-panels visuals, original behavior).
- **carousel** — transform-track slider with drag-settle and edge-aware nav
  (embla visuals/conventions, original behavior).
- **input-otp** — one-time-code input on a single native `<input>` (full
  form participation, native paste/backspace, OS autofill) under verbatim
  slot visuals.
- **button-group** and **input-group** — grouped control containers with
  upstream variant maps.
- **empty** and **item** — content-layout primitives.
- **use-mobile** (lib) — viewport signal helper backing responsive
  components.
- **sidebar** — the full ~23-part composite: provider state with cookie
  persistence and Cmd/Ctrl+B, desktop rail + icon-collapse variants, the
  complete menu/group family (mobile off-canvas deferred; documented).

### Fixed
- `spinner` now carries `data-slot` per the house styling-hook invariant.
- theme.css gains the `caret-blink` keyframe (input-otp's caret).

## 0.1.1 — 2026-07-11

### Added
- **drawer** (vaul-convention drag-to-dismiss), **spinner**, **combobox**
  (classic Popover + Command composition; upstream migrated to @base-ui,
  unvendorable — deviation documented). These landed between the initial
  tarball and the bump.

## 0.1.0 — 2026-07-11

Initial release: "shadcn for nisli".

### Added
- **Source copy-in distribution**: the `nisli-ui` CLI (`init`, `add`,
  `list`) copies component source into your project — you own the code.
  Registry ships in the package; transitive dependency resolution; fixed
  layout so relative imports survive verbatim.
- **Design tokens**: shadcn-compatible CSS variable theme (upstream
  `new-york-v4` neutral), light + dark, Tailwind v4.
- **Behavior primitives** (lib items, also copied as source): roving-focus,
  dismissable-layer, focus (trap + non-modal), floating, typeahead, and the
  zero-dependency `cn()`/`cv()` utilities.
- **~45 components** at shadcn v4 parity, verified against the canonical
  source: button, badge, label, separator, skeleton, alert, card, input,
  textarea, checkbox, switch, radio-group, select (native), form-field,
  tabs, accordion, collapsible, dialog, alert-dialog, sheet, tooltip,
  popover, hover-card, dropdown-menu (with submenus), table, avatar,
  progress, breadcrumb, pagination, slider, toggle, toggle-group,
  scroll-area, toast (sonner-conventions), command (cmdk-conventions),
  navigation-menu, context-menu, menubar, hover-card, aspect-ratio, kbd.
- Every component works as a typed Nisli factory **and** as a plain custom
  element (light DOM, native form participation, real ARIA).

### Attribution
Ported from [shadcn/ui](https://github.com/shadcn-ui/ui) (MIT) and the
[Radix Primitives](https://github.com/radix-ui/primitives) patterns it
wraps (MIT).
