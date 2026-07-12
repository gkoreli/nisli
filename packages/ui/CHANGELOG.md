# Changelog

All notable changes to `@nisli/ui`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

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
