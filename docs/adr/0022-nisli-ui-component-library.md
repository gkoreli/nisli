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

### 3. Styling and theming: Tailwind v4 + shadcn token layer

- Consumers are expected to use **Tailwind CSS v4** (CSS-first config). The
  registry's `styles/theme.css` ships the shadcn token layer: `:root` and
  `.dark` blocks defining `--background`, `--foreground`, `--primary`,
  `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`,
  `--input`, `--ring`, `--radius`, … in oklch, plus an `@theme inline` block
  mapping them to Tailwind color names (`--color-background: var(--background)`).
- Theming = overriding the CSS variables. Dark mode = a `.dark` class on any
  ancestor. Identical mental model to shadcn, so their theme ecosystem ports
  directly.
- `@nisli/ui` itself has **zero runtime npm dependencies**. Instead of
  `class-variance-authority` + `clsx` + `tailwind-merge`, the registry ships
  a vendored `lib/utils.ts`:
  - `cn(...inputs)` — clsx-style class joiner (strings, arrays, records).
  - `cv(base, config)` — cva-style variant resolver: `variants`,
    `defaultVariants`, `compoundVariants`. shadcn variant maps port onto it
    one-to-one.

  Trade-off accepted: without `tailwind-merge`, conflicting consumer
  overrides (`className: 'px-8'` against a base `px-4`) rely on CSS order
  rather than being deduplicated. That matches Nisli's zero-dependency ethos
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
- **Release cadence (added after 0.1.0 shipped)**: the published package must
  track the registry. Arch bumps the **patch version as part of landing any
  batch that adds or changes registry items** (engineers never touch the
  version); every push to origin then auto-publishes the newest registry via
  `auto-tag.yml`. Minor bumps are reserved for convention/CLI changes,
  major for breaking copied-source conventions.

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

**Update 2026-07-11**: the registry has grown to 25 items (7 lib primitives,
18 component files through dialog/table/avatar), all verified against the
canonical shadcn checkout, plus the committed SSG kitchen-sink demo fixture
(`packages/ui/demo`) enforcing registry↔fixture byte-equality in CI. Current
roadmap state lives in `packages/ui/NORTH-STAR.md`.

The component roadmap and v1 milestone live in
[`packages/ui/NORTH-STAR.md`](../../packages/ui/NORTH-STAR.md).
