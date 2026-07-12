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
- [x] lib: roving-focus, dismissable-layer, focus trap/restore, floating, typeahead, portal
- [x] tabs, accordion, dialog (+ standalone dialog-close)
- [x] collapsible, alert-dialog, tooltip, popover
- [x] dropdown-menu (incl. submenus), context-menu, menubar

**Wave 4 — surfaces & feedback**
- [x] table, avatar
- [x] progress, breadcrumb, pagination
- [x] slider, toast (sonner-style), sheet

**Beyond the waves (shipped)** — the registry now carries **58 `ui` items**,
all tested: the waves above plus calendar, carousel, combobox, command,
drawer, hover-card, input-otp, navigation-menu, resizable, scroll-area,
select (custom), sidebar, toggle/toggle-group, and the chat/composition set
(attachment, bubble, empty, item, kbd, marker, message, message-scroller,
spinner, button-group, input-group, direction).

**Not ported (by design)**
- `form` — upstream's form.tsx is react-hook-form context wiring with no
  portable surface; our `form-field` provides the id/aria mechanism.
- `chart` — upstream's chart.tsx is a recharts theming shim; recharts is a
  React-scale charting product, not a portable component. Charting in nisli
  is a potential post-v1 initiative (original, dataviz-first), not a port.

**Later / explicitly deferred**
- Charts (original, dataviz-first — post-v1); named/multiple projection slots;
  SVG/namespaced tags in `el()`. *(Formerly deferred, since shipped: portal →
  `lib/portal.ts` + all 8 overlay families; live attribute observation →
  `attrs{}` declarations, ADR 0025 §3; calendar; combobox/command; the docs
  site → `packages/www`, live at nisli.dev; `form-field`'s `responsive`
  orientation + `horizontal` checkbox/radio token → UI-52 ported the full
  `field.tsx` family (`FieldGroup`/`FieldContent`/`FieldLabel`/…).)*

## "v1 done" milestone

`@nisli/ui@1.0.0` ships when **all of Waves 1–3** hold, and:

1. `init` / `add` / `list` work against the published npm package in a clean
   Vite + Tailwind v4 project — from empty dir to rendered themed dialog with
   the three commands.
2. Every component: works via factory *and* plain HTML, passes its keyboard /
   ARIA tests under happy-dom, carries `data-slot`/`data-state` hooks, and
   visually matches shadcn's default style side by side.
3. Zero runtime npm dependencies in every copied file.
4. `packages/www` installs the complete registry and enforces preview coverage
   for every registry item in CI (superseded the duplicate consumer fixture on
   2026-07-11).
5. README documents install, theming, and attribution (shadcn/ui, Radix).

**Status (audited 2026-07-12, `@nisli/ui@0.3.0` on npm):** Waves 1–4 all
hold. (1) done — the UI-48 live run installed the published `0.3.0` package
into a clean Vite + Tailwind v4 application, exercised `list` / `init` /
`add`, built and rendered the themed dialog, and passed the complete copied
registry through stock strict TypeScript. The CI script now derives its
default from `packages/ui/package.json`, so a checkpoint proves its own
published artifact; only the explicit `0.2.0` override permits that version's
exact four known diagnostics. (2) open — keyboard/ARIA tests,
`data-slot`/`data-state`, dual factory/plain-HTML use, and the source-level
wave-A/wave-B parity audits are landed; the manual side-by-side checkboxes
remain open until the corrected www gallery is deployed (UI-36A/B). (3) done
— registry integrity fails on any bare runtime npm dependency (UI-37), and
the current 58-item package passes it. (4) done — www installs all 58, its
static coverage test and Playwright browser guard both derive the complete
preview set. CI enumerates every built page, requires preview-bearing pages to
upgrade, visibly paint, and load their assets, and additionally requires every
hydrate-set page to set its success marker and open its interactive example;
primitive pages are cross-checked by their badge and skipped. The WWW-11
landing passed all 66 built `/ui` pages (58 components plus registry
primitives). (5) done.

## Attribution

Component markup, class lists, and behavior are ported from
[shadcn/ui](https://github.com/shadcn-ui/ui) (MIT) and the
[Radix Primitives](https://github.com/radix-ui/primitives) behavior they wrap
(MIT). Each ported file notes its origin in a header comment.
