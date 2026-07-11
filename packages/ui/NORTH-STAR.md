# @nisli/ui — North Star

**"shadcn for Nisli."** A component library and design system for the Nisli
web-component framework, distributed as source you copy into your project and
own forever.

Architecture decisions and rationale: [ADR 0022](../../docs/adr/0022-nisli-ui-component-library.md).

## Vision

Any web project — Nisli app, plain HTML page, or another framework — runs one
command and gets beautiful, accessible, themeable components rendered by
standard custom elements:

```
npx @nisli/ui init
npx @nisli/ui add button dialog tabs
```

The code lands in *their* tree, written in Nisli (signals + `html` templates),
compiled to custom elements, styled with Tailwind over a shadcn-compatible
token layer. Editing a component is editing your own source file.

## Tenets

1. **Source-first, own your code.** Distribution is a registry + CLI that
   copies source verbatim. No runtime package to upgrade, no styling API to
   fight. If you don't like it, edit it.
2. **Standards-consumable.** Every component is a real custom element in the
   light DOM. It must work in plain HTML with attributes and
   `addEventListener` — Nisli's typed factories are the enhancement, not the
   requirement.
3. **shadcn parity, not shadcn inspiration.** Port shadcn/ui markup, variant
   taxonomy, tokens, and Radix-derived behavior directly (MIT, attributed).
   Their docs, themes, and muscle memory should transfer to Nisli unchanged.
   Parity means **diffed against the real source, never ported from
   memory**: the canonical reference is the local checkout at
   `/Users/goga/Documents/goga/shadcn-ref/apps/v4/registry/new-york-v4/`
   (our `default` style tracks upstream `new-york-v4`), and every ported
   file cites its source `.tsx` (ADR 0022).
4. **Native platform first.** Real `<button>`, real `<input>`, real form
   participation, native event bubbling. No synthetic layers (ADR 0019).
5. **Zero runtime dependencies.** Vendored `cn()`/`cv()` instead of
   clsx/cva/tailwind-merge. Behavior primitives (focus trap, dismissable
   layer) are registry lib items, also copied as source.
6. **Accessible by construction.** WAI-ARIA roles, keyboard maps, and focus
   management ported from Radix patterns are part of a component's definition
   of done, verified in tests.

## Invariants

- Light DOM only; no shadow roots. Host elements are layout-transparent
  (`display: contents`); all styling lives on inner elements.
- Every rendered element carries `data-slot`; interactive state is exposed as
  `data-state` / `data-disabled` attributes (Radix convention).
- Component tags are namespaced `ui-*`; custom events are namespaced `ui-*`.
- Explicit props win over host attributes; attributes are a parse-time
  fallback for plain-HTML consumers.
- Copied source must typecheck and run with only `@nisli/core` installed.
- Registry file layout (`ui/`, `lib/`, `styles/`) is fixed so relative
  imports survive copying without rewriting.

## Design language

shadcn's "default" style: neutral oklch palette driven by CSS variables
(`--background`, `--foreground`, `--primary`, `--muted`, `--accent`,
`--destructive`, `--border`, `--input`, `--ring`, `--radius`), light + dark
via a `.dark` class, `text-sm font-medium` controls, `rounded-md` radii,
restrained shadows, `focus-visible` rings. Themes are variable overrides —
any shadcn theme drops in.

## Roadmap — shadcn-parity components

**Wave 1 — primitives (prove the conventions)**
- [x] button *(canonical reference)*
- [x] badge, label, separator, skeleton, card, alert

**Wave 2 — forms**
- [x] input, textarea, checkbox, switch, radio-group, select (native), form-field wiring

**Wave 3 — behavior (needs lib primitives)**
- [x] lib: roving-focus, dismissable-layer, focus trap/restore, floating, typeahead
- [x] tabs, accordion, dialog (+ standalone dialog-close)
- [ ] collapsible, alert-dialog, tooltip, popover *(in flight — UI-7)*
- [ ] dropdown-menu *(UI-8, needs submenu design)*

**Wave 4 — surfaces & feedback**
- [x] table, avatar
- [ ] progress, breadcrumb, pagination *(in flight — UI-6)*
- [ ] slider, toast (sonner-style), sheet

**Later / explicitly deferred**
- Portal primitive; live attribute observation (MutationObserver); calendar /
  date-picker; combobox/command; charts; a docs site built with `@nisli/ssg`
  (the dogfood milestone).

## "v1 done" milestone

`@nisli/ui@1.0.0` ships when **all of Waves 1–3** hold, and:

1. `init` / `add` / `list` work against the published npm package in a clean
   Vite + Tailwind v4 project — from empty dir to rendered themed dialog with
   the three commands.
2. Every component: works via factory *and* plain HTML, passes its keyboard /
   ARIA tests under happy-dom, carries `data-slot`/`data-state` hooks, and
   visually matches shadcn's default style side by side.
3. Zero runtime npm dependencies in every copied file.
4. A kitchen-sink demo page (rendered with `@nisli/ssg`) exists in-repo and is
   part of CI.
5. README documents install, theming, and attribution (shadcn/ui, Radix).

## Attribution

Component markup, class lists, and behavior are ported from
[shadcn/ui](https://github.com/shadcn-ui/ui) (MIT) and the
[Radix Primitives](https://github.com/radix-ui/primitives) behavior they wrap
(MIT). Each ported file notes its origin in a header comment.
