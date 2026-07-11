# Changelog

All notable changes to `@nisli/ui`. Format: keep-a-changelog-lite — one
section per version, human-readable highlights. Releases happen at
checkpoints (ADR 0022); dates are release dates.

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
