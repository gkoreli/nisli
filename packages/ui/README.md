# @nisli/ui

**"shadcn for Nisli."** Accessible, themeable components for the
[Nisli](https://github.com/gkoreli/nisli) web-component framework —
distributed as **source copied into your project**, not as a runtime
dependency. You own the code.

```sh
npm install @nisli/core
npm install -D @nisli/ui tailwindcss tw-animate-css
npx nisli-ui init          # writes nisli-ui.json, copies lib/utils.ts + styles/theme.css
npx nisli-ui add button    # copies ui/button.ts (and its registry deps) into your tree
```

In a Tailwind v4 entry stylesheet, import the copied theme immediately after
Tailwind:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./nisli-ui/styles/theme.css";
```

Components are authored with `@nisli/core` (signals + `html` templates) and
compile to standard custom elements, so they work two ways:

```ts
// Nisli composition — typed factory
import { Button } from './nisli-ui/ui/button.js';

html`${Button({ variant: 'outline', children: 'Save' })}`;
```

```html
<!-- plain HTML — any framework or none -->
<ui-button variant="outline">Save</ui-button>
```

## Requirements

- `@nisli/core` >= 0.53
- Tailwind CSS v4 + `tw-animate-css` — import the copied `styles/theme.css`
  after both build-tool imports. Theming and dark mode work exactly like
  shadcn/ui: override the CSS variables; add a `.dark` class.

The networked smoke test for the currently published package runs as a separate
CI job and can be invoked locally with `pnpm --filter @nisli/ui e2e:npm`. Set
`NISLI_UI_VERSION` to verify a specific release.

## Design

Architecture and conventions are recorded in
[ADR 0022](https://github.com/gkoreli/nisli/blob/main/docs/adr/0022-nisli-ui-component-library.md); vision,
invariants, and roadmap in [NORTH-STAR.md](https://github.com/gkoreli/nisli/blob/main/packages/ui/NORTH-STAR.md). Highlights:

- **Light DOM, no shadow roots.** Hosts are layout-transparent
  (`display: contents`); styling lives on the inner elements, so Tailwind
  and design tokens just work.
- **Zero runtime npm dependencies** in copied source — vendored `cn()`/`cv()`
  replace clsx/cva.
- **Standards-consumable**: attributes as prop fallbacks, light-DOM children
  projection, native events, `data-slot`/`data-state` styling hooks.

## Attribution

Component markup, class lists, and behavior are ported from
[shadcn/ui](https://github.com/shadcn-ui/ui) (MIT) and the
[Radix Primitives](https://github.com/radix-ui/primitives) patterns they wrap
(MIT).
