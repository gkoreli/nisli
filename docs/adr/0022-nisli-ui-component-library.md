# 0022. Nisli UI Component Library — `@nisli/ui`, Source Copy-In Distribution

**Date**: 2026-07-11
**Status**: Accepted
**Depends on**: [0017-framework-package-extraction](./0017-framework-package-extraction.md), [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md)

## Context

Nisli has a runtime (`@nisli/core`), an SSG toolkit (`@nisli/ssg`), and no
component library. Every consumer rebuilds buttons, dialogs, and form controls
from scratch. Meanwhile shadcn/ui proved a distribution model that fits Nisli's
own values better than a classic component package does:

- Components are **copied as source into the consumer's project**. Users own
  the code, edit it freely, and never wait on upstream for a variant tweak.
- The library is a **registry + CLI**, not a runtime dependency. There is no
  version-upgrade treadmill and no styling API indirection.
- Styling is **Tailwind utilities over a small CSS custom-property token
  layer** (`--background`, `--foreground`, `--primary`, …) with light/dark
  themes.

shadcn/ui is MIT-licensed, so we can port its component source — markup,
variant taxonomy, class lists, a11y patterns — directly into Nisli components,
with attribution.

**Canonical reference (added 2026-07-11).** Early ports were written from
model memory and drifted from real shadcn (pre-v4 focus rings, missing
`aria-invalid:` states). Porting from memory is now banned. The canonical
source is a local checkout of the real shadcn v4 registry:

```
/Users/goga/Documents/goga/shadcn-ref/apps/v4/registry/new-york-v4/{ui,lib,hooks}
```

Every port is a **diff against the corresponding `.tsx` there** — exact
class lists, variant maps, `data-slot` names, `aria-*`/`data-*` attributes,
icons, and behavior — and every ported file cites its source file in the
header comment (`Ported from new-york-v4/ui/button.tsx`). Architectural
translation (custom elements, light DOM, native inputs) is ours; visuals and
taxonomy are theirs, verbatim.

**Style naming**: shadcn v4 retired its old `default` style; `new-york-v4`
is upstream's canonical style. Our registry keeps its single style named
`default`, defined as **tracking shadcn `new-york-v4`** — consumers see one
obvious choice, and the mapping is recorded here.

This ADR decides how `@nisli/ui` ("shadcn for Nisli") is distributed, styled,
and authored, and what conventions keep its components consumable as plain
custom elements outside Nisli.

## Decision

### 1. Distribution: source copy-in registry + CLI

`@nisli/ui` is a new workspace package (`packages/ui`) that publishes **a CLI
and a registry of component source files** — not importable runtime components.

```
npx @nisli/ui init          # write nisli-ui.json, copy lib/utils.ts + styles/theme.css
npx @nisli/ui add button    # copy button source (+ registry deps) into the project
npx @nisli/ui list          # show available registry items
```

- `init` writes `nisli-ui.json` at the project root:

  ```json
  { "dir": "src/nisli-ui" }
  ```

  `dir` is the single install root. `init` also copies the shared registry
  items every component assumes: `lib/utils.ts` and `styles/theme.css`.

- `add <name...>` resolves the named registry items plus their
  `registryDependencies` transitively, and copies each file to
  `<dir>/<registry-relative path>` — e.g. `src/nisli-ui/ui/button.ts`.
  Existing files are skipped unless `--overwrite` is passed. If an item
  declares npm `dependencies`, the CLI prints the install command; it never
  mutates the consumer's `package.json` itself.

- **Registry format** — `registry/registry.json` in the published package:

  ```json
  {
    "style": "default",
    "items": [
      {
        "name": "button",
        "type": "ui",
        "description": "Displays a button. Port of shadcn/ui button.",
        "files": ["ui/button.ts"],
        "registryDependencies": ["utils"],
        "dependencies": []
      },
      {
        "name": "utils",
        "type": "lib",
        "files": ["lib/utils.ts"]
      },
      {
        "name": "theme",
        "type": "style",
        "files": ["styles/theme.css"]
      }
    ]
  }
  ```

  Source files live at `registry/default/<file>` in the package. `files`
  paths are registry-relative and **copied verbatim, preserving structure**:
  `ui/`, `lib/`, `styles/` under the consumer's `dir`. Because layout is
  fixed, relative imports inside component source (`../lib/utils.js`) survive
  the copy with **zero import rewriting**. Components import the framework as
  `@nisli/core`, which consumers already have.

Rationale: this is the shadcn model minus its weakest part (import-path
rewriting). One config key, verbatim file copies, fully inspectable output.

### 2. Light DOM, not shadow DOM — the pivotal call

Components render into the **light DOM**. No shadow root, anywhere.

This was nearly decided for us: `component()` in `@nisli/core` mounts
templates by appending to the host element (ADR 0001/0019) and has no shadow
DOM support. But it is also the right call on the merits:

- **Direct shadcn reuse.** shadcn styles via Tailwind utility classes in
  page-scope CSS. Shadow DOM blocks page stylesheets, so every component
  would need its styles re-injected per shadow root and Tailwind's compiler
  would not see the markup. Light DOM lets us port shadcn class lists as-is.
- **Token inheritance.** CSS custom properties do pierce shadow boundaries,
  but utility classes referencing them (`bg-primary`) do not. Light DOM makes
  the whole token + utility pipeline just work.
- **Native platform behavior.** A real `<button type="submit">` in light DOM
  participates in forms, label association, and the accessibility tree with
  zero `ElementInternals` machinery. This is the ADR 0019 native-alignment
  principle applied to UI.
- **SSG/SSR.** `@nisli/ssg` renders light-DOM HTML strings; declarative
  shadow DOM would complicate the whole static pipeline.

Cost: no style encapsulation. Mitigations: every rendered element inside a
component carries a `data-slot` attribute (shadcn v4 convention) for targeted
consumer CSS, class lists are token-driven so page CSS collisions are
Tailwind-scale unlikely, and components never rely on element selectors.

**Host transparency invariant**: the custom-element host (`<ui-button>`) is
layout-transparent — setup sets `host.style.display = 'contents'` — and all
styling lives on the component's inner root element (the real `<button>`).
The host never carries visual classes; wrappers must not distort flex/grid
layouts.

**Direct-child selector translation (ButtonGroup, UI-61):** CSS selectors do not
flatten `display: contents` custom-element hosts. UI-55's follow-up cohesion
audit found that upstream ButtonGroup's direct-child rounding/border selectors
therefore matched non-painting `ui-button` hosts. Nisli keeps the upstream rules
for native/plain children and adds parallel selectors for the painted inner
`[data-slot=button]` / `[data-slot=button-group-text]` nodes. Nested group gaps,
focus stacking, both orientations, and separator composition preserve the
upstream visual contract without abandoning transparent factory composition.
Every upstream port must mechanically classify direct-child (`>` / `*:`),
positional (`first:` / `last:`), and divide utilities against Nisli's actual
rendered DOM. Verbatim utility-token equality is not parity when a transparent
host prevents the selector from reaching the painted node. The complete census
and explicitly ticketed residuals live in `packages/ui/UI-36B-WORKLIST.md`.
UI-57 applies the same narrow translation to positional semantics: ToggleGroup
and InputOTP groups derive first/last from their transparent child-host order,
while Accordion removes the final painted item's border through its last item
host. The original primitive-local utilities remain for native/plain structure.

**Toast content rows (UI-62):** the zero-dependency Sonner-compatible toast
keeps its outer vertical stack, but groups the optional type icon and title in
a min-width-safe flex row. Default toasts omit the icon without indentation;
description and action-space remain independent rows for wrapping and controls.

**ContextMenu touch trigger (UI-63):** ContextMenu follows Radix's 700ms
touch/pen long-press contract in addition to desktop `contextmenu`. The initial
touch point is the virtual anchor; movement beyond 10px, release, cancellation,
scroll, or teardown cancels the timer, and synthetic follow-up activation is
suppressed after a successful long press.

**Carousel drag settle (UI-65):** the zero-dependency Embla translation uses
pointer identity, an 8px axis lock, bounded velocity/distance projection, and
mandatory snap cleanup. Step size comes from rendered slide-to-slide geometry
so upstream spacing utilities cannot accumulate drift. The settled index is
the single source for active/hidden/current ARIA and navigation state.

**MessageScroller post-layout pin (UI-66):** replace hydration cannot treat
setup-time zero geometry as the final scroll position. Initial bottom pinning,
sticky mutations, and resize changes settle after two animation frames; user
scroll intent cancels a pending initial pin and remains authoritative away from
the bottom. Mutation/resize observers and queued frames are lifecycle-owned.

### 3. Styling and theming: Tailwind v4 + shadcn token layer

- Consumers are expected to use **Tailwind CSS v4** (CSS-first config). The
  registry's `styles/theme.css` ships the shadcn token layer: `:root` and
  `.dark` blocks defining `--background`, `--foreground`, `--primary`,
  `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`,
  `--input`, `--ring`, `--radius`, … in oklch, plus an `@theme inline` block
  mapping them to Tailwind color names (`--color-background: var(--background)`).
- Upstream `new-york-v4` declares `tw-animate-css` as a **development/build
  dependency** and imports it before the theme layer. Nisli mirrors that
  contract: `init` reports `npm install -D tw-animate-css` and the required CSS
  order (`tailwindcss` → `tw-animate-css` → copied `theme.css`). The package is
  never imported by copied TypeScript and is not a runtime dependency; no
  animation CSS is vendored.
  **Proof (UI-49)**: `packages/www/scripts/animation-proof.mjs` drives the
  production `/ui/popover` preview in Chromium and checks computed enter/exit
  animation names and nonzero durations across real open/close interaction.
- Theming = overriding the CSS variables. Dark mode = a `.dark` class on any
  ancestor. Identical mental model to shadcn, so their theme ecosystem ports
  directly.
- Upstream's v4 style also applies `border-border outline-ring/50` to every
  element in the base layer. **UI-55** mirrors that rule so Tailwind's bare
  `border` and `outline` utilities resolve the design tokens instead of CSS
  `currentColor`. `packages/ui/scripts/theme-e2e.mjs` compiles the real copied
  theme with Tailwind v4 and compares bare versus explicit token utilities in
  Chromium; the packed-CLI E2E also asserts the rule survives distribution.
- `@nisli/ui` itself has **zero runtime npm dependencies**. Instead of
  `class-variance-authority` + `clsx` + `tailwind-merge`, the registry ships
  a vendored `lib/utils.ts`:
  - `cn(...inputs)` — clsx-style class joiner (strings, arrays, records).
  - `cv(base, config)` — cva-style variant resolver: `variants`,
    `defaultVariants`, `compoundVariants`. shadcn variant maps port onto it
    one-to-one.

  Trade-off accepted: without `tailwind-merge`, conflicting consumer
  overrides (`className: 'px-8'` against a base `px-4`) rely on CSS order
  rather than being deduplicated.
  **Resolved-composition doctrine (added 2026-07-11, from the calendar
  remediation)**: when porting an upstream element that COMPOSES another
  component's variants (e.g. `<Button variant=ghost size=icon className=…>`),
  do not emit the raw composition — our `cn` cannot resolve its conflicts.
  Inline the **tailwind-merge resolution** of upstream's exact composition,
  itemize every shadowed class in the header, and lock it with assertions
  (retained tokens present, shadowed tokens absent). Pitfall: tailwind-merge
  scopes conflicts to the SAME modifier chain — `has-[>svg]:px-3` survives an
  unmodified `p-0`; verify survivals per modifier chain. That matches Nisli's zero-dependency ethos
  and keeps copied source dependency-free; the registry format still supports
  npm `dependencies` per item if a future component genuinely needs one, and
  a consumer can swap `cn`'s body for `twMerge(clsx(...))` in their own copy.

### 4. Headless behavior and a11y: port, as registry lib items

Nisli has no Radix. Rather than adopting a React-bound or class-based headless
library, we **port Radix/shadcn behavior into small Nisli primitives**,
distributed as `lib/` registry items that behavior-heavy components declare in
`registryDependencies`:

- `lib/utils.ts` — `cn`, `cv`, attribute/children interop helpers (below).
- `lib/dismissable-layer.ts` — escape-key + outside-pointer dismissal stack.
- `lib/focus.ts` — focus trap, focus restore, roving tabindex.
- (grown as components need them: presence/animation-exit, floating
  positioning, etc.)

They are source-copied like everything else — users own their focus trap.
ARIA wiring (roles, `aria-*`, keyboard maps) is done per component, copied
from the WAI-ARIA patterns Radix implements, using Nisli lifecycle
(`useHostEvent`, `onMount`/`onCleanup`, signals) per the nisli-framework
skill rules.

### 5. Component API conventions (standards-consumable)

Every component must work both ways:

```ts
// Nisli composition (typed factory)
Button({ variant: 'outline', children: 'Save', onclick? — no: native events })
```

```html
<!-- plain HTML / any framework -->
<ui-button variant="outline">Save</ui-button>
```

Conventions, all proven by Button:

- **Tag namespace**: `ui-*` (`ui-button`, `ui-dialog`). One custom element
  per registry `ui` item.
- **Props**: typed factory props per ADR 0009 (`PropInput<T>`), signals for
  reactivity. Enumerated string unions for variants (`variant`, `size`).
- **Attribute fallback**: setup reads host attributes once as fallback for
  unset props (`attr(props.variant, host, 'variant')` helper; camelCase prop
  ↔ kebab-case attribute). For booleans, `boolAttr(prop, host, name,
  defaultValue = false)`: an absent attribute yields `defaultValue`, the
  literal string `"false"` coerces to `false`, and any other present value
  (including empty) is `true`. This lets default-`false` flags opt in with a
  bare attribute (`<ui-button disabled>`) and default-`true` flags opt out
  with `="false"` (`<ui-separator decorative="false">`); an explicit prop
  always wins. Live attribute observation is deliberately out of scope for
  v1 — plain-HTML consumers set attributes at parse time; JS consumers should
  set properties.
- **Form controls render real native inputs.** Every form control
  (`ui-input`, `ui-textarea`, `ui-checkbox`, `ui-switch`, …) renders a real
  `<input>`/`<textarea>` in the light DOM — native form participation is the
  differentiator over shadcn/Radix. `form.elements`, `form.reset()`,
  constraint validation, and label association all work natively. For this,
  `id` and `name` must live on the **inner control**, not the transparent
  host: `forwardedAttr(prop, host, name)` reads the host attribute once and
  **removes it from the host**, so a plain-HTML `<ui-input id="email"
  name="email">` yields a single `<input id="email" name="email">` that
  `form.elements.namedItem('email')` and `<ui-label for="email">` resolve to.
  `value`/`checked` are one-way `PropInput`s (signal-able) with native
  `input`/`change` events bubbling out — no synthetic events, no two-way
  binding. They mirror the native attribute/property split: the `value`/
  `checked` **attribute** is the initial value and the `form.reset()` target,
  while later signal updates are applied to the **property**.
- **Children**: factories take a `children` prop (`string | TemplateResult`).
  For plain-HTML usage, setup **captures pre-existing host child nodes**
  before mounting and re-appends them into the inner root element (light-DOM
  projection helper `projectChildren(host, ref)`), so `<ui-button>Save</ui-button>`
  renders the label inside the real `<button>`.
- **`className` prop** (not `class`): merged last into the root element's
  class list via `cn()`. The name avoids colliding with the template engine's
  host-`class` handling (ADR 0007/0009); plain HTML may use a `class-name`
  attribute. Host-level `class` (second factory arg) remains framework
  behavior but is useless on a `display: contents` host — documented as such.
- **Events**: native events bubble from real light-DOM elements (`click`,
  `input`, `submit`); no synthetic event layer. Component-specific
  notifications use `CustomEvent` dispatched from the host with a
  `ui-`-prefixed name (`ui-open-change`) — consumable by `addEventListener`
  anywhere, no Nisli required.
- **Styling hooks**: `data-slot="<name>"` on every rendered element; state
  exposed as data attributes (`data-state="open"`, `data-disabled`) exactly
  like Radix, so shadcn selectors (`data-[state=open]:...`) port unchanged.

### 6. Package shape

Per AGENTS.md package architecture:

```
packages/ui/
  package.json          # @nisli/ui — bin "nisli-ui", zero runtime deps
  tsconfig.json         # typechecks src/ + registry/ + tests
  tsconfig.build.json   # compiles src/ → dist/ (CLI only)
  vitest.config.ts      # happy-dom, like core
  NORTH-STAR.md
  src/                  # the CLI: cli.ts, add.ts, init.ts, config.ts, registry.ts, index.ts
  registry/
    registry.json
    default/
      ui/button.ts          + button.test.ts (tests beside source, not published… see files)
      lib/utils.ts          + utils.test.ts
      styles/theme.css
```

- Dev exports point at TS source (`"." → ./src/index.ts`); `publishConfig`
  points at `dist/` — same pattern as core and ssg.
- `files`: `dist`, `registry`, `README.md`, `LICENSE`. Registry `.ts` ships
  as **source** (that is the product); `*.test.ts` files are excluded via
  `.npmignore`-style `files` granularity at publish time (tests live beside
  source in the repo per house rules).
- `@nisli/core` is a `peerDependency` (>=0.48.0) + workspace devDependency:
  the package's own code (CLI) never imports it, but registry source and its
  tests do.
- Publishing joins the existing `auto-tag.yml` trusted-publisher flow with
  `directory: packages/ui` repository metadata.
- **Release policy: checkpoint releases on 0.x semver (supersedes the
  per-batch cadence briefly in effect after 0.1.0)**. We stay 0-based until
  the NORTH-STAR "v1 done" milestone holds; `0.x.y` patch = additive
  components/fixes, `0.x` minor = breaking changes to component APIs,
  registry format, or CLI. Releases happen at **checkpoints** — coherent
  milestones the architect calls (a wave completes, a behavior family lands,
  the CLI changes), not per landed batch. The checkpoint ritual: bump
  version → update `packages/ui/CHANGELOG.md` (keep-a-changelog-lite:
  human-readable highlights per version, never commit-log dumps) → push
  `origin main` (auto-publishes via trusted publishing; also triggers site
  deploys once Workers Builds is connected). Between checkpoints, work lands
  on local main with no bump/push. Engineers never touch versions. The same
  checkpoint policy governs `@nisli/core` and `@nisli/ssg` releases.

## Consequences

- A consumer goes from zero to a themed, accessible button with
  `npm i -D @nisli/ui && npx @nisli/ui init && npx @nisli/ui add button` —
  and owns every line that lands in their tree.
- Ported components stay visually and behaviorally in lockstep with shadcn,
  so shadcn documentation, themes, and muscle memory transfer to Nisli.
- Light DOM means no style encapsulation; we accept Tailwind-scale class
  hygiene as the isolation mechanism, with `data-slot` hooks as the escape
  hatch.
- Without `tailwind-merge`, consumer class overrides that conflict with base
  utilities are last-write-wins by CSS order; revisit if it bites in
  practice (the registry supports per-item npm deps as the escape hatch).
- No live attribute reactivity for plain-HTML consumers in v1; acceptable
  for parse-time attributes, revisit with `MutationObserver` if demanded.
- DOM structural convenience APIs (`table.rows`, `table.tHead`, etc.) don't
  traverse the `display: contents` hosts between structural elements;
  `querySelector` and `data-slot` do, and CSS layout + the a11y tree collapse
  the hosts, so semantics/styling are unaffected. Same class of trade-off as
  `form.elements` working because native inputs are leaves.
- The framework gains a second downstream consumer (after the blog), which
  will pressure-test `component()`/`template.ts` — expect upstream gap ADRs.
- MIT attribution to shadcn/ui (and Radix, for ported behavior) is carried in
  `packages/ui/README.md` and in the header comment of ported files.

## Implementation Checkpoint

Shipped with this ADR (branch `arch/ui`):

- `packages/ui` scaffold exactly as §6.
- Registry v1: `utils` (lib), `theme` (style), `button` (ui) — Button is the
  canonical end-to-end proof: authored in Nisli → registry entry → `add`
  copies it → renders under happy-dom with variants, attribute fallback,
  children projection, native click.
- CLI: `init`, `add` (transitive registry deps, `--overwrite`), `list`.
- Tests: Button rendering/interop, `cn`/`cv` unit tests, CLI copy round-trip
  into a temp dir.

**Update 2026-07-11**: the registry has grown beyond its initial 25 items, all
verified against the canonical shadcn checkout. The former duplicate consumer
fixture and registry-copy equality check were superseded on 2026-07-11 by
`packages/www`, which installs the complete registry and enforces preview
coverage for every registry item in CI. Current roadmap state lives in
`packages/ui/NORTH-STAR.md`.

**Amendment 2026-07-11 — visual-parity verification process (v1 criterion 2).**
"Visually matches shadcn's default style side by side" is verified by two
artifacts, both recorded in the repo, chosen as the cheapest honest check
over a screenshot-diff pipeline (deferred post-v1 — brittle under font/AA
rendering deltas for marginal signal):

1. **Class-list parity sweeps** (UI-36A/B): every registry component's
   markup + Tailwind class lists diffed against the canonical checkout at
   `shadcn-ref/apps/v4/registry/new-york-v4/ui`, divergences logged in
   `UI-36{A,B}-WORKLIST.md` — real drift fixed, intentional platform
   divergences annotated and kept. Since both sides are Tailwind over the
   same token layer, identical class lists on identical structure IS visual
   parity up to browser rendering.
2. **Manual side-by-side checklist**: each worklist entry gets a final
   eyeball pass — the www gallery preview (`nisli.dev/ui/<name>`) against
   the parity baseline — recorded as a checkbox per component in the same
   worklist file, covering what class diffs cannot (stacking, focus rings,
   animation feel). **Baseline correction (2026-07-12)**: ui.shadcn.com now
   defaults to the "Base UI" (nova) style, so the live site is NO LONGER
   the baseline — the pinned `new-york-v4` checkout remains the sole parity
   truth (NORTH-STAR tenet 3 already pins it). Site demos may still serve
   as a rendered visual aid where they match the checkout era (use the
   Radix tab where offered), but any site-vs-ours delta must be checked
   against the CHECKOUT before it counts as drift; nova-only deltas are
   annotated, not fixed. A checkbox additionally requires the live copy to
   be the CURRENT sync generation (the stale-artifact rule — verify which
   registry generation the deployed www copy renders before judging).
   **Rubric correction (2026-07-12, from Goga's phone findings):** the
   original rubric verified appearance only — and a static preview
   screenshots identically to a hydrated one, so waves A/B verified pages
   whose interactive components did not respond to input at all. The manual
   pass now has an INTERACTION dimension: for every component that is
   interactive in the upstream docs, the checkbox additionally requires
   observing the interaction work on the live page (tap/click drives the
   state change), on a phone-width viewport for touch-first components.
   Screenshots prove paint; only interaction proves the component.

The component roadmap and v1 milestone live in
[`packages/ui/NORTH-STAR.md`](../../packages/ui/NORTH-STAR.md).
