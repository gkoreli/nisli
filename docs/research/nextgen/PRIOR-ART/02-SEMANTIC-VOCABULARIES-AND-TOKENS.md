# Semantic vocabularies and token systems — what "closed" and "derived" actually cost

**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: systems that hand authors a *semantic vocabulary* (`size`, `variant`, `scale`, `density`, tokens) instead of raw values — the direct competitors to `data-appearance`/`data-role` and to the resolution table.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — new package `@nisli/next`

> **Method.** Every load-bearing claim was read out of a repository cloned at the commit
> named in [`## Sources`](#sources), or out of a first-party doc page. Unverifiable claims
> are marked `[UNVERIFIED]`. Adoption numbers come from
> `api.npmjs.org/downloads/point/last-week` and the GitHub REST API, fetched 2026-08-25/26.

---

## Verdict in five bullets

1. **The maintainer's objection is half right, and the right half is worse than he stated.**
   Radix Themes is not merely "`size`/`variant` props". It already ships an inherited
   custom-property multiplier — `--space-1: calc(4px * var(--scaling))` — set by a
   `data-scaling` attribute on a **nestable** `<Theme>`. That is structurally the same
   mechanism as our `--unit`. React Spectrum goes further: it ships a **density axis that
   auto-detects from the input device** (`useScale`: `(any-pointer: fine)` → `medium`,
   else `large`) and **inherits it down the provider tree**
   (`scale = prevContext ? prevContext.scale : autoScale`). **Derivation is not novel.**
   What is novel is only **exclusivity** — and the survey shows exclusivity is rare because
   it is *expensive*, not because nobody thought of it.

2. **Exactly one shipped system has real closure, and it is Meta's.** React Strict DOM
   deletes `className` at runtime — not by convention, by an allowlist that `delete`s the
   prop and logs an error. It is the only entry here where the second channel is genuinely
   closed. It has **3,550 stars**, sits at **v0.0.55 after ~3 years**, and its last push was
   **2026-06-23** — the quietest repo in this survey, despite Meta backing and production
   use. Closure is achievable, and has not by itself produced adoption.

3. **Adobe explicitly abandoned derive-from-one-unit, and their reason is our F9.**
   `spectrum-medium.css` and `spectrum-large.css` declare
   `--spectrum-global-dimension-scale-factor: 1` and `: 1.25` — and then **never reference
   it again**. Both files contain **zero `calc()`** and **136 / 169 hand-typed px literals**.
   The largest shipped density axis in the industry is a **duplicated hand-authored table
   per density**. Our own F9 ("derivation from one unit is NOT automatically
   self-consistent") is the finding that explains why.

4. **Escape hatches are load-bearing, not exceptional.** Radix Themes' own JSDoc advertises
   `p="100px"` as supported; **40 of its 59 layout prop defs accept arbitrary CSS strings**.
   React Spectrum's `UNSAFE_className` appears in **304 issues** on `adobe/react-spectrum`.
   Tailwind v4 moved tokens into CSS custom properties — our mechanism — and then emitted
   them **only at `:root, :host`**, which is the exact architectural decision that makes
   context-derivation impossible in Tailwind and possible for us.

5. **The commercial signal cuts against "semantic vocabulary" as a product.**
   `Shopify/polaris` is **archived** and titled *"React implementation (Deprecated)"* — the
   most design-system-committed vendor in the survey retired its React library. Meanwhile
   `class-variance-authority` — the *mapping* approach that C11 §3.1 names as the enemy —
   does **64.8M downloads/week**, and `tailwindcss` does **126.4M**. The incumbent is not
   Radix Themes. The incumbent is `cva` + Tailwind, at roughly **1000×** Radix Themes'
   distribution.

---

## Systems surveyed

Three questions per system:
**(a) CLOSED** — can the author write an arbitrary value or class at all?
**(b) DERIVED** — does any value resolve from an ancestor/context rather than map 1:1 from a prop?
**(c) ESCAPE** — what is the hatch, and how often is it reached?

| system | what it does | adoption (dl/wk · stars · last push) | status | (a) closed | (b) derived | (c) escape |
|---|---|---|---|---|---|---|
| **Polaris Web Components** (`<s-button>`, Shopify) | semantic custom-element vocabulary; no CSS reaches it at all | `@shopify/ui-extensions` **254k**/wk · repo not public | **shipped 2025‑10‑01**; replaced React Polaris | **YES** — *"the CSS can't be altered or overridden"* | **YES** — `variant="auto"`, `tone="auto"`, headings size *by nesting depth* | **none documented**; remote‑dom sandbox, non‑DOM |
| **React Strict DOM** (Meta) | closed prop allowlist over StyleX; no `className` | **656k**/wk · **3,550**★ · 2026‑06‑23 | v0.0.55, alive but slow | **YES** for props — allowlist `delete`s unknown props | partial — StyleX `createTheme` vars cascade | `style` (StyleX only) + `data-*` passthrough |
| **Radix Themes** | `size`/`variant`/`color` props → static classes; `--scaling` multiplier | **975k**/wk · **8,645**★ · 2026‑04‑11 | maintained | **NO** — `className` merged last; `p="100px"` documented | **partial** — `--scaling` inherits through nested `<Theme>`; sizes do not | `className`, `style`, arbitrary prop strings (40/59 props) |
| **React Spectrum** (Adobe) | `scale="medium\|large"` density axis, inherited via Provider | **1.20M**/wk · **15,817**★ · 2026‑08‑26 | maintained | **NO** — `UNSAFE_className` / `UNSAFE_style` | **YES** — `scale` inherits from parent Provider; auto‑detected from `(any-pointer: fine)` | `UNSAFE_*` — **304 issues** mention `UNSAFE_className` |
| **Material Web / M3 tokens** | ref → sys → comp, three CSS‑custom‑property layers | `@material/web` **135k**/wk · **11,199**★ · 2026‑08‑21; `material-tokens` **284**★ · **ARCHIVED 2023‑08‑15** | maintained (tokens repo dead) | **NO** — any `--md-*` at any selector, any value | **YES** by construction — scoped custom properties cascade | set `--md-*-token` on any selector; **no density scale exists** (roadmap item) |
| **Tailwind v4** (`@theme`) | tokens as CSS custom properties + per‑callsite utilities | **126M**/wk · **97,339**★ · 2026‑08‑14 | dominant incumbent | **NO** — `p-[7px]`, `[color:red]` are first‑class | **NO** — `@theme` is hoisted to `:root, :host`, always | arbitrary values are not an escape, they are the API |
| **StyleX** (Meta) | statically‑analyzable object style API, atomic output | **1.77M**/wk · **9,892**★ · 2026‑08‑25 | active | **opt‑in** — ESLint `propLimits` can close a property to a value list | **YES** — `createTheme` overrides vars for a subtree | plain CSS values are the default; lint is opt‑in |
| **vanilla‑extract / Sprinkles** | generates a *closed* atomic vocabulary from a config | `@vanilla-extract/css` **3.05M**/wk; `sprinkles` **1.05M**/wk · **10,411**★ · 2026‑08‑07 | active | **YES within Sprinkles** — types admit only configured values | **NO** — conditions are media/selector, not ancestor | drop to `style()` any time, same file |
| **Panda CSS** | recipes + `strictTokens` | **439k**/wk · **6,158**★ · 2026‑08‑25 | active | **type‑only, opt‑in** — `strictTokens` changes *TypeScript definitions*, default `false` | **NO** | `css({...})` with any value; `// @ts-expect-error` |
| **Tamagui** | `$size` tokens; `createStyledContext` propagates `size` | **239k**/wk · **14,153**★ · 2026‑08‑26 | active | **NO** — `size={44}`, `paddingHorizontal={7}` legal | **YES** — `context` propagates `size` to descendants; `getButtonSized` derives padding/height/radius from one token | any raw style prop |
| **Primer** (GitHub) | `data-size`/`data-variant` attributes + CSS Modules + stylelint token rules | `@primer/react` **57k**/wk · **3,892**★; `primitives` **127k**/wk | active | **NO** — `clsx(classes.ButtonBase, className)` | partial — token layer, not ancestor‑derived | stylelint disables: **502** across 203 CSS modules (209 `primer/spacing`, 97 `primer/colors`); **572** raw px vs 3,257 token refs |
| **Carbon** (IBM) | `kind` + `size` enums | `@carbon/react` **166k**/wk · **9,385**★ · 2026‑08‑26 | active | **NO** — `extends React.ButtonHTMLAttributes` | **NO** | `className`, `style`, any DOM attr |
| **Fluent UI** (Microsoft) | `makeStyles` + `tokens.*` | `@fluentui/react-components` **394k**/wk; `@fluentui/tokens` **428k**/wk · **20,226**★ | active | **NO** | **NO** (theme via `FluentProvider` vars) | `className` merged via `mergeClasses` |
| **Polaris React** (Shopify) | `variant`/`tone` props, `stylelint-polaris` | **269k**/wk · **6,174**★ | **ARCHIVED — "deprecated"** | n/a | n/a | replaced by web components |
| **Salesforce DSR** | Lightning class names in React | **11k**/wk · **981**★ · 2026‑06‑02 | minimal maintenance | **NO** | **NO** | `className` |
| **Figma variables + auto‑layout** | design‑side vocabulary: modes, hug/fill | product, not a package · n/a | shipped, dominant | **YES** inside the tool | **YES** — mode **`Auto` = "take on the mode of their parent container"**, walking up the layer tree | detach/override; documented failure mode is **mode conflicts** across library versions |
| **`cva` + Tailwind** (the actual incumbent) | maps a variant name to a hand‑written class string | `class-variance-authority` **64.8M**/wk | dominant | **NO** | **NO** | there is nothing to escape from |

---

## What each one actually does

### 1. Polaris Web Components — the one that has *both*, shipped eleven months ago

This is the finding that most threatens our novelty claim, so it goes first.

On 2025‑10‑01 Shopify replaced its React design system with custom elements. The
archived repo says so in its own README:

> **This repository is archived and unmaintained.** […] The **Shopify Polaris React
> library** is deprecated. […] On October 1, 2025, we released our **Polaris Web
> Components** for Shopify app development. […] Polaris Web Components provide a more
> **technology-agnostic foundation**. They work with every framework as well as plain
> JavaScript and server-rendered sites […]
> — `Shopify/polaris-react-archive/README.md`

The styling policy is stated flatly, and it is exclusivity:

> **Styling** — Components automatically apply styling based on the properties you set
> **and the context in which they're used**. For example, **headings display at
> progressively less prominent sizes based on nesting depth within sections**. All
> components inherit merchant brand settings, and **the CSS can't be altered or
> overridden**.
>
> Component styling is controlled by the merchant's branding settings and **can't be
> overridden with custom CSS**. Extensions render using Shopify's custom HTML elements
> (like `<s-banner>` or `<s-button>`) rather than standard DOM elements like `<div>` or
> `<script>` tags.
> — [shopify.dev · Using Polaris web components](https://shopify.dev/docs/api/polaris/using-polaris-web-components.md)

Read that middle sentence again. *Headings size by nesting depth* is our
C11 §3.4 sketch (`[data-surface] [data-surface] { --ui-bg: … }`) written as product
documentation. And the derivation goes further than depth — the `<s-button>` API has **no
`size` prop at all**, and its two appearance props both default to context:

> * **variant** — `"auto" | "primary" | "secondary" | "tertiary"` · Default: `'auto'`
>   * `auto`: **The variant is automatically determined by the button component's context.**
> * **tone** — `"critical" | "auto" | "neutral"` · Default: `'auto'`
>   * `auto`: **Automatically determined based on context.**
> — [shopify.dev · Button](https://shopify.dev/docs/api/app-home/web-components/actions/button.md)

The scale is closed, named and *middle-out* — no numbers anywhere:

```ts
export type Scale =
  | 'small-500' | 'small-400' | 'small-300' | 'small-200' | 'small-100'
  | 'small'  // alias of small-100
  | 'base'
  | 'large'  // alias of large-100
  | 'large-100' | 'large-200' | 'large-300' | 'large-400' | 'large-500';
```

**(a) closed: yes. (b) derived: yes. (c) escape: none.** The mechanism that buys the
closure is not politeness — it is `remote-dom`: extensions run in a sandbox and never
touch a real DOM, so there is no surface on which to write a class.

**What this costs, and why it is not the end of our idea.** Polaris WC's closure is
bought with a *sandbox*, and its scope is *Shopify's own admin*. It is a
platform-vocabulary for building inside one company's product, not a general framework
for the component you write tomorrow: `s-stack`, `s-grid`, `s-box` are the layout
primitives and there is no way to author a *new* semantic role. It also has no fit
solver — nothing collapses by declared priority, nothing truncates by declared priority.
So it validates §C10 (the vocabulary + derivation half) almost completely, and says
nothing about §C11 (the resolver half). **Treat Polaris WC as proof that C10 is
buildable and shippable — and as proof that C10 alone is not a framework.**

### 2. React Strict DOM — closure by allowlist, and what it looks like in code

RSD is the only entry where a `className` is *deleted at runtime*:

```js
// react-strict-dom/packages/react-strict-dom/src/web/modules/createStrictDOMComponent.js:21-29
function validateStrictProps(props: any) {
  Object.keys(props).forEach((key) => {
    const isValid = isPropAllowed(key);
    if (!isValid) {
      errorMsg(`invalid prop "${key}"`);
      delete props[key];
    }
  });
}
```

```js
// react-strict-dom/packages/react-strict-dom/src/shared/isPropAllowed.js:159-160
export function isPropAllowed(key: string): boolean {
  return strictAttributeSet.has(key) || key.indexOf('data-') > -1;
}
```

`strictAttributeSet` holds **144 entries** (`isPropAllowed.js:10-157`). `'style'` is in it
(`isPropAllowed.js:137`). **`'className'` is not in it, anywhere in the file.** Note the second
clause: **every `data-*` attribute passes through unchecked** — the exact channel our
design uses for its declarations.

**(a) closed: yes for props.** **(b) derived: partly** — RSD styles are StyleX, and
StyleX `createTheme` cascades variables to a subtree; RSD itself derives nothing from
ancestry. **(c) escape:** `style` (StyleX objects only) and `data-*`.

**Adoption is the lesson.** 656k dl/wk sounds large but is dominated by Meta-internal and
transitive installs; the repo has **3,550 stars**, is at **v0.0.55 after ~3 years**, and
its last push (2026‑06‑23) is the oldest in this survey apart from two archived repos.
`repo:react/react-strict-dom "invalid prop"` returns **6 issues** and `className` returns
**1** — i.e. almost nobody is hitting the wall, because almost nobody is at the wall.
**Closure did not cause adoption failure, but it very clearly did not cause adoption.**

### 3. Radix Themes — the maintainer's named competitor, read line by line

`className` is not merely present, it is merged *last* so it always wins:

```tsx
// radix-ui/themes packages/radix-ui-themes/src/components/button.tsx:9-11
  ({ className, ...props }, forwardedRef) => (
    <BaseButton {...props} ref={forwardedRef} className={classNames('rt-Button', className)} />
  ),
```

```ts
// …/src/helpers/extract-props.ts:120
  extractedProps.className = classNames(className, props.className);
```

`size` is a pure 1:1 map to a static class — the "mapping" of C11 §3.1:

```ts
// …/src/components/_internal/base-button.props.ts:21
size: { type: 'enum', className: 'rt-r-size', values: sizes, default: '2', responsive: true },
```

```css
/* …/src/components/_internal/base-button.css (SIZES block) */
&:where(.rt-r-size-1) { --base-button-height: var(--space-5); border-radius: max(var(--radius-1), var(--radius-full)); }
&:where(.rt-r-size-2) { --base-button-height: var(--space-6); … }
```

**But — and this is the part the objection understates — Radix Themes already derives.**

```css
/* …/src/styles/tokens/space.css:1-11 */
.radix-themes {
  --space-1: calc(4px * var(--scaling));
  --space-2: calc(8px * var(--scaling));
  …
}
```
```css
/* …/src/styles/tokens/scaling.css */
.radix-themes {
  &:where([data-scaling='90%'])  { --scaling: 0.9; }
  …
  &:where([data-scaling='110%']) { --scaling: 1.1; }
}
```
`<Theme scaling>` is nestable — **every** `Theme`, root or nested, renders `className={classNames('radix-themes', …)}` **and** `data-scaling={scaling}` (`theme.tsx:195-212`), so the selector `.radix-themes:where([data-scaling='90%'])` matches at any depth and a nested
`<Theme>` rescales its subtree through an inherited custom property. **That is our
`--unit` mechanism, shipped, at 975k dl/wk.** The differences that matter:
- the axis is **±10 % cosmetic**, not a density axis (`scalings = ['90%','95%','100%','105%','110%']`, `theme.props.tsx:9`);
- **only spacing/type/radius scale.** `size="2"` is still a per-callsite eyes-decision;
- and the whole thing is voidable by one `className`.

**Openness, quantified.** Of the 59 prop defs in `src/props/`, **25 are
`type: 'enum | string'` and 15 are `type: 'string'` — 40 accept arbitrary CSS.** The
library's own JSDoc advertises it:

```ts
// …/src/props/padding.props.ts:5-22
/**
 * Sets the CSS **padding** property.
 * Supports space scale values, CSS strings, and responsive objects.
 * @example
 * p="4"
 * p="100px"
 …
 */
p: { type: 'enum | string', className: 'rt-r-p', customProperties: ['--p'], values: paddingValues, responsive: true },
```

**(a) closed: no.** **(b) derived: partly — spacing/type/radius only, one global-ish knob.**
**(c) escape: `className` + `style` + 40 arbitrary-string props; 81 issues mention `className`.**

### 4. React Spectrum — the shipped density axis, and Adobe's rejection of derivation

Scale inherits down the provider tree, and is **auto-detected from the pointer**:

```tsx
// adobe/react-spectrum packages/@adobe/react-spectrum/src/provider/Provider.tsx:63
scale = prevContext ? prevContext.scale : autoScale,
```
```ts
// …/src/provider/mediaQueries.ts:49-59
export function useScale(theme: Theme): Scale {
  let matchesFine = useMediaQuery('(any-pointer: fine)');
  if (matchesFine && theme.medium) { return 'medium'; }
  if (theme.large) { return 'large'; }
  return 'medium';
}
```

Our prototype's `touch` axis (`--unit: 4px × 1.25`) is this, and Adobe shipped it in 2020.

**Now the adversarial half.** Look at how the two scales are *produced*:

```css
/* packages/@adobe/spectrum-css-temp/vars/spectrum-medium.css:13-37 */
.spectrum--medium {
  --spectrum-global-dimension-scale-factor: 1;
  --spectrum-global-dimension-size-100: 8px;
  --spectrum-global-dimension-size-200: 16px;
  --spectrum-global-dimension-size-300: 24px;
  --spectrum-global-dimension-size-400: 32px;
```
```css
/* …/vars/spectrum-large.css:14,23,30 */
  --spectrum-global-dimension-scale-factor: 1.25;
  --spectrum-global-dimension-size-100: 10px;
  --spectrum-global-dimension-size-200: 20px;
```

Measured over the two files: **`calc(` appears 0 times**; **136 and 169 literal `px`
values** are typed out; and **`--spectrum-global-dimension-scale-factor` is referenced
exactly once each — its own declaration.** Adobe declares the multiplier and then refuses
to compute with it. Every value in the large scale is authored by hand.

**(a) closed: no** — `UNSAFE_className` / `UNSAFE_style` are the documented hatch, threaded
through `Provider` itself (`Provider.tsx:112`). **(b) derived: yes**, for the density axis,
by inheritance. **(c) escape: `UNSAFE_className`, mentioned in 304 issues on the repo.**

### 5. Material Design 3 — a three-layer table, and what it costs

The layering is real and documented:

> Each component token maps to a system token, which has a concrete reference value. On
> the web, design tokens are CSS custom properties **and can be scoped with CSS
> selectors**.
> ```css
> .square-buttons {
>   /* Changes all <md-filled-button> instances matching the selector */
>   --md-filled-button-container-shape: 0px;
> }
> ```
> — `material-components/material-web/docs/theming/README.md:36-48`

That snippet is simultaneously M3's *derivation* mechanism and its *escape hatch*: a
scoped custom property cascades to descendants (derivation) and can be any value at any
selector (no closure). There is nothing else. **(a) no. (b) yes. (c) the same feature.**

Two numbers that matter for our vocabulary-size risk:

- **49 component-token files, 2,204 declared component tokens.** M3's answer to "give the
  author a semantic vocabulary" is a per-component token surface roughly two orders of
  magnitude larger than "fits on one page".
- **There is no density scale.** The only `density` hits in the entire repo are a
  deprecation note and a roadmap entry: *"Density allows components to take up less
  vertical space for larger displays. While we have some spacing tokens already, we need a
  comprehensive spacing system to fully support density across components."*
  (`docs/roadmap.md:68-72`). Google has not shipped the axis Adobe shipped in 2020 and our
  prototype treats as table stakes.

And the byte cost of the shipped result, from their own tracking page: **72.1 kB gzip for
all components; 7.0 kB gzip for a single filled button** (`docs/size.md`). Our whole core
budget is 10 kB.

`material-foundation/material-tokens` — the standalone pipeline — is **archived**, last
pushed **2023‑08‑15**, **284 stars**. The token pipeline as a shareable artifact did not
survive.

### 6. Tailwind v4 — our mechanism, wired to the opposite architecture

`@theme` collects custom properties and nothing else:

```ts
// tailwindlabs/tailwindcss packages/tailwindcss/src/index.ts:566-588
      // Record all custom properties in the `@theme` declaration
      walk(node.nodes, (child) => {
        if (child.kind === 'at-rule' && child.name === '@keyframes') { … }
        if (child.kind === 'declaration' && child.property.startsWith('--')) {
          theme.add(unescape(child.property), child.value ?? '', themeOptions, child.src)
          return
        }
        …
        throw new Error(
          `\`@theme\` blocks must only contain custom properties or \`@keyframes\`.\n\n${snippet}`,
        )
      })
```

And then the single most decision-relevant line in the file:

```ts
// …/src/index.ts:591-597
      // Keep a reference to the first `@theme` rule to update with the full
      // theme later, and delete any other `@theme` rules.
      if (!firstThemeRule) {
        firstThemeRule = styleRule(':root, :host', [])
        firstThemeRule.src = node.src
        return WalkAction.ReplaceSkip(firstThemeRule)
      } else {
        return WalkAction.ReplaceSkip([])
      }
```

**Every `@theme` block, wherever it appears, is hoisted into one `:root, :host` rule and
all others are deleted.** Tailwind v4 therefore has *tokens as custom properties* — our
substrate — and has structurally **forbidden itself context-derivation**: there is exactly
one scope. A Tailwind author who wants a compact toolbar writes different utilities at the
callsite; there is no mechanism by which the same markup resolves differently by position.

Arbitrary values are not an escape hatch in Tailwind, they are a first-class candidate
kind (`src/candidate.ts:17,69,95,112,177` — arbitrary utilities, arbitrary modifiers,
arbitrary variants, arbitrary properties). **(a) no, emphatically. (b) no, architecturally.
(c) n/a.**

**What this means for the pitch.** Against Tailwind our differentiator is *not* "tokens in
CSS variables" — they got there in v4. It is: **one scope vs. every scope**, and
**per-callsite authoring vs. per-element declaration**. Say that precisely or the pitch
reads as "Tailwind, later".

### 7. StyleX — the closest thing to a published rationale for closure

StyleX's stated principles are worth reading as an adversary, because two of them are
aimed straight at our mechanism:

> **Encapsulation** — *All styles on an element should be caused by class names on that
> element itself.*
> — `facebook/stylex packages/docs/content/docs/learn/thinking-in-stylex.mdx:277-279`

> Inheritable styles such as `color` will still be inherited, but that is the **only** form
> of style-at-a-distance that StyleX allows.
> — same file, `:301-304`

Meta looked at "styles at a distance", called it fragile, and designed it out — replacing
descendant selectors with `stylex.when.*` markers that the *observing* element must opt
into. Our derivation model is style-at-a-distance by design. (The narrow reprieve: custom
properties *are* inheritable properties, so StyleX's own carve-out technically covers
them, and `createTheme` uses exactly that:)

> A "theme" is a style object similar to the ones created with `create()`. They can be
> applied to an element using `props()` **to override variables for that element and all
> its descendants.**
> — `…/docs/learn/theming/creating-themes.mdx:39-42`

**The most stealable thing in this whole survey is StyleX's `propLimits`.** The ESLint
plugin can close a property to an explicit value list, with an author-supplied reason:

```json
{ "@stylexjs/valid-styles": ["error", { "propLimits": {
    "mask+([a-zA-Z])": { "limit": null,     "reason": "Use the `mask` shorthand property instead." },
    "fontSize":        { "limit": "number", "reason": "Only numeric font values are allowed" },
    "padding":         { "limit": [0, 4, 8, 16, 32, 64],
                         "reason": "Use a padding that conforms to the design system" } } }] }
```
— `…/docs/api/configuration/eslint-plugin.mdx:75-89`

That is a shipped, documented, off-scale-value guard — our N601 "7px is not on the 4px
scale" diagnostic, minus the derivation. **(a) opt-in closed, per property, via lint.
(b) yes, via `createTheme`. (c) the default is open; the closure is a config file.**

Also worth stealing: `StyleXStylesWithout<{ margin: unknown, … }>` — a component can
**type-forbid** a set of properties on the styles it accepts, at zero runtime cost
(`thinking-in-stylex.mdx`, "Type-Safe styles"). That is per-component, opt-in exclusivity
expressed in the type system rather than by deleting a prop.

### 8. Sprinkles, Panda, Tamagui — three partial answers

**Sprinkles** (`vanilla-extract`, 1.05M dl/wk) generates a closed atomic vocabulary from a
config: *"Create your own custom set of atomic classes with declarative config"*,
*"Type-safe functional API"* (`packages/sprinkles/README.md`). Within a Sprinkles call the
vocabulary genuinely is closed — the generated types admit only configured values. It has
no ancestor-derivation (its conditions are media queries and selectors) and you can drop to
`style()` in the same file, so the closure is local, not systemic.

**Panda** has `strictTokens`, and its own type definition tells you the limit:

```ts
// chakra-ui/panda packages/types/src/config.ts:398-404
  /**
   * Change generated typescript definitions to be more strict for property having a token or utility.
   */
  strictTokens?: boolean
  /**
   * Change generated typescript definitions to be more strict for built-in CSS properties to only allow valid CSS values.
   */
  strictPropertyValues?: boolean
```

"Change generated **typescript definitions**" — the enforcement is types, opt-in, default
off, and erased at runtime.

**Tamagui** is the closest *component-framework* analogue of C10. It has a styled context
that propagates a size token to descendants:

```ts
// tamagui/tamagui code/core/sizable-context/src/index.ts
export const SizableContext = createStyledContext({ size: undefined as SizeTokens | undefined })
```
```tsx
// code/ui/button/src/Button.tsx:27-42
const context = createStyledContext<ButtonContextStyles>({ size: undefined, variant: undefined, … })
const Frame = styled(View, { context, name: 'Button', … })
```

…and it derives geometry from a single token, in a function, exactly as we propose:

```ts
// code/core/get-button-sized/src/index.ts
export const getButtonSized = (val: SizeTokens | number, { tokens, props }) => {
  if (typeof val === 'number') {
    return { paddingHorizontal: val * 0.25, height: val, borderRadius: props.circular ? 100_000 : val * 0.2 }
  }
  const xSize = getSpace(val)
  const radiusToken = tokens.radius[val] ?? tokens.radius['$true']
  return { paddingHorizontal: xSize, height: val, borderRadius: props.circular ? 100_000 : radiusToken }
}
```

**Tamagui already implements "derive padding/height/radius from one size token, inherited
from an ancestor".** Its numeric branch is literally `val * 0.25`. What it does not have is
closure — `size={44}` and `paddingHorizontal={7}` are legal — nor a fit solver.

### 9. Primer — the best available measurement of "enforce tokens with a linter"

Primer is the closest shipped thing to nisli's *declaration channel*: GitHub's Button emits
semantic data attributes and selects on them from a CSS Module.

```tsx
// primer/react packages/react/src/Button/ButtonBase.tsx:103-117
        data-component="Button"
        data-block={block ? 'block' : null}
        data-inactive={inactive ? true : undefined}
        data-loading={Boolean(loading)}
        data-no-visuals={!LeadingVisual && !TrailingVisual && !TrailingAction ? true : undefined}
        data-size={size}
        data-variant={variant}
        data-label-wrap={labelWrap}
```

The CSS module is almost entirely tokens (`ButtonBase.module.css`: 165 `var(--…)` refs, 4
px literals), and Primer enforces this with custom stylelint rules — visible in the source
as the escapes they authorise:

```css
  /* stylelint-disable-next-line primer/spacing */
  padding: 0 var(--control-medium-paddingInline-normal);
```

**Measured across `packages/react/src`:**

| metric | count |
|---|---|
| CSS Modules | 203 |
| `stylelint-disable` lines | **502** |
| …of which `primer/spacing` | **209** |
| …of which `primer/colors` | **97** |
| raw `px` literals in `*.module.css` | **572** |
| `var(--…)` references | 3,257 |

So in the *reference implementation* of a token system, written by the team that wrote the
linter, roughly **15 % of length values are off-token and 502 escapes are checked in**.
`className` remains fully open (`clsx(classes.ButtonBase, className)`, `ButtonBase.tsx:107`).

### 10. Carbon, Fluent, Salesforce — semantic props, zero closure

- **Carbon**: `ButtonKinds` (8) × `ButtonSizes` (6), and
  `interface ButtonBaseProps extends React.ButtonHTMLAttributes<HTMLButtonElement>`
  (`@carbon/react@1.114.0/lib/components/Button/Button.d.ts`) — which admits `className`,
  `style` and every DOM attribute by inheritance. There is no policy to quote because
  there is no policy.
- **Fluent UI** ships `@fluentui/tokens` (428k dl/wk) and `makeStyles`; `mergeClasses`
  composes a caller's `className`. Theme values come from `FluentProvider`, so themes are
  scoped — but nothing about a component derives from *where it sits*.
- **Salesforce `design-system-react`**: 11k dl/wk, 981★, last push 2026‑06‑02. The
  smallest adoption in the survey; a thin React wrapper over Lightning class names, i.e.
  the mapping model with the class channel wide open.

### 11. Figma — the design-side vocabulary, and the cost of modes

Figma's variable **modes** are context-derivation, in the tool that most UI is designed in:

> **Set to auto mode (objects only)** — Objects with variables have their modes set to
> **Auto** by default. This means they **take on the mode of their parent container**. If
> their parent container is also set to Auto, objects continue up their layer hierarchy
> until they reach a container with a specified mode. If no parent containers have a mode
> specified, then the objects fallback to the collection's default mode.
> — [Figma Help · Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables)

And the modes explicitly cover our density axis:

> Account for multiple device sizes, like watch, mobile, and desktop, to see how elements
> respond to varying **spacing and padding** sizes using number variables […] you might
> have a variable collection that contains spacing values for different screen sizes. The
> variable collection might have three modes: desktop, tablet, and mobile.
> — same page

**The recorded cost is worth more than the mechanism.** Figma documents an entire failure
class called **mode conflicts**, with a multi-file, publish-order remediation:

> Conflicts occur when objects in a file use different versions of the same variable. If
> you select a mode with a conflict, the mode is only applied to layers that can render
> it. […] you will need to publish and accept updates to all files involved **in the order
> of the chain**.
> — same page

Translated to our design: **the set of context axes is a versioned contract.** Add a
density and every consumer that was pinned to the old axis set silently keeps the old
resolution. Our escape-ratio manifest (C11 §2.2) has no story for this yet.

---

## Ideas worth stealing

1. **`variant="auto"` as the *default*, not `variant="primary"`.** *(Polaris Web
   Components.)* Every other system defaults a semantic prop to a concrete value
   (Radix: `variant: 'solid'`, `size: '2'`; Carbon: `kind` required). Shopify defaults it
   to *"determined by context"*. For an agent-authored framework this is the single
   highest-leverage default in the survey: the shortest program an agent can write —
   `<ui-button>Save</ui-button>` — is the one where the engine makes the decision. Our
   sketch already omits `size`; it should go further and make **`role` optional with a
   context-derived default**, so that omitting a declaration is *stronger* than making one.

2. **Middle-out named scales (`small-300 … base … large-300`).** *(Polaris WC.)* An
   ordinal scale with a named centre is more agent-legible than `1|2|3|4` (Radix) or
   `xs|sm|md|lg|xl|2xl` (Carbon) because *the default is nameable and the direction is
   obvious*. It also makes "one step quieter" expressible without knowing the absolute
   position — which is exactly the operation an attention-ranking agent wants.

3. **`propLimits` — a value allowlist with an author-written `reason`.** *(StyleX
   ESLint.)* `"padding": { "limit": [0,4,8,16,32,64], "reason": "Use a padding that
   conforms to the design system" }`. Our N601 already reports "7px is not on the 4px
   scale"; StyleX's shape adds the thing we lack — **the message is authored next to the
   rule, so the diagnostic explains the *policy*, not just the arithmetic.** Steal the
   `{ limit, reason }` pair verbatim for the resolution-table consistency checker that F9
   demands.

4. **`StyleXStylesWithout<{ margin: unknown, … }>` — per-component, type-level property
   bans.** *(StyleX.)* Zero runtime, opt-in, composable. This is the *gradual* form of
   exclusivity that our §2.2 escape hatch is groping toward: instead of one global
   "escaped/not escaped" bit, a component can declare *which* properties it refuses to
   surrender. Pairs naturally with T3's value-level prop schema.

5. **`data-*` as the one channel that survives a strict allowlist.** *(React Strict DOM,
   `isPropAllowed.js:160`: `strictAttributeSet.has(key) || key.indexOf('data-') > -1`.)*
   Meta closed every prop channel and deliberately left `data-*` open. That is
   independent confirmation that the declaration channel we chose is the one a closed
   system can afford to keep — and it means an RSD-shaped host could carry our
   declarations unmodified.

6. **Semantic data attributes as the CSS selector surface.** *(Primer,
   `ButtonBase.tsx:103-117`.)* `data-size`, `data-variant`, `data-block`,
   `data-no-visuals`, `data-label-wrap` — GitHub already ships the exact channel shape,
   at scale, and it selects from CSS Modules rather than concatenating class strings.
   Concretely stealable: `data-no-visuals` and `data-label-wrap` are **derived** flags the
   component computes from its own children, not props the caller sets. That is a cheap,
   zero-measurement form of "the engine decides", and we should enumerate more of them.

7. **Auto-detect the density axis from the input device, not from a prop.** *(React
   Spectrum, `mediaQueries.ts:49`.)* `(any-pointer: fine)` → `medium`, else `large`. Our
   prototype's `touch` axis is an authored context; Spectrum's is *sensed*. Sensing costs
   one media query and removes one more eyes-decision from the author.

8. **`Auto` mode inheritance with an explicit walk-up-and-fallback rule.** *(Figma.)*
   Figma states the resolution order precisely — object's own mode, else nearest ancestor
   with a specified mode, else collection default. Our cascade gets this for free from CSS
   inheritance, but Figma also *shows it in the UI*: a tag next to the layer name naming
   the mode in force. The equivalent for us is `explain()` reporting **which ancestor
   supplied `--unit`**, not just the resolved value.

9. **Publish the byte cost per component as a tracked doc.** *(Material Web
   `docs/size.md`.)* A checked-in, autogenerated table of gzip/minified/%CSS per component.
   For a project with a 10 kB core ceiling this is free credibility and an anti-regression
   ratchet.

10. **Bank the "technology-agnostic foundation" argument.** *(Shopify's own stated reason
    for killing React Polaris.)* A major vendor publicly retired a React design system in
    favour of custom elements because custom elements *"work with every framework as well
    as plain JavaScript and server-rendered sites"*. That is nisli's architecture,
    validated by someone else's migration, and it is a better opening line for the pitch
    than anything about pixels.

---

## Where the prior art says we are wrong

### 1. The direct verdict on *"isn't this just a component library?"*

**The objection is wrong about Radix Themes and right about the category — and the reason
it is right is worse than the maintainer stated.**

Wrong about Radix: `size="2"` is a 1:1 map to `.rt-r-size-2`
(`base-button.props.ts:21`), the caller still makes the eyes-decision, and `className` is
merged last so nothing is guaranteed (`extract-props.ts:120`, `button.tsx:9-11`). Our
answer holds *against that specific system*.

Right about the category: **a system already exists with both exclusivity and
derivation, and it is not a library — it is Shopify's Polaris Web Components, shipped
2025‑10‑01.** No `className`. No CSS. *"the CSS can't be altered or overridden."*
`variant="auto"` and `tone="auto"` resolve from context by default. Headings size by
**nesting depth**. So the honest position is:

> **Exclusivity + derivation is not novel. It shipped eleven months ago, from a vendor
> with 254k weekly installs of the host package, and it works.**

What Polaris WC does *not* have, verified against its own docs and component API:
- **no way to author a new semantic role** — `s-box`/`s-stack`/`s-grid` and a fixed
  component set; the component *you* write tomorrow has no vocabulary;
- **no fit solver** — nothing collapses or truncates by declared priority;
- **no checker** — no assertion that nothing overflows, overlaps, or is invisible;
- **closure bought by sandbox** — `remote-dom`, inside one vendor's admin, not a general
  web framework.

**Therefore: C10 must stop being pitched as the differentiator.** C10 is now *table
stakes with a shipped precedent*. The differentiator has to be C11 — the resolver plus
the checker plus *user-authored* roles — or there is no pitch. Anyone can now answer
"someone already did that" with a link.

### 2. Adobe measured our F9 and concluded the opposite of what we concluded

Our F9 says: *"a floor must propagate through every derivation that bounds it"* — i.e.
fix the table. Adobe, with a decade and a full-time design-systems org, shipped the other
answer: **two hand-authored tables, 305 literal px values between them, and a declared
`--…-scale-factor` that is never used in a single `calc()`.**

If derive-from-one-unit were tractable at product scale, `spectrum-large.css` would be
twelve lines of `calc(… * 1.25)`. It is 515 lines of typed numbers. That is not
ignorance; it is the record of someone who tried the elegant thing and shipped the boring
thing. **Our prototype found the same contradiction at 4 pages and 13 components. Assume
it gets worse superlinearly.**

### 3. Enforcement leaks at exactly the rate you'd fear — measured on the enforcers

Primer is the strongest available natural experiment: a design system with custom
stylelint rules (`primer/spacing`, `primer/colors`) forbidding raw values, applied to its
own source. Result: **502 checked-in `stylelint-disable` lines across 203 CSS modules**,
**306 of them disabling the spacing and colour rules specifically**, and **572 raw px
literals against 3,257 token references (~15 % off-token)**.

Our C11 §2.2 pitch is "the escape is countable, so gate it in CI: *the registry ships
zero escapes*." Primer's numbers say the achievable steady state for the *authors of the
system*, under lint, is ~15 %, not 0 %. A zero-escape registry is possible only if the
vocabulary genuinely covers the surface — and Primer's 502 disables are evidence that at
GitHub's surface area, it does not.

### 4. Meta's published position is that our derivation mechanism is an anti-pattern

> *All styles on an element should be caused by class names on that element itself.*
> […] All of these patterns, while powerful, make styles **fragile, less predictable and
> harder to debug**. An element could be styled without having any classes applied to it.
> — `thinking-in-stylex.mdx:277-296`

StyleX's carve-out (*"Inheritable styles such as `color` will still be inherited, but that
is the only form of style-at-a-distance that StyleX allows"*) technically covers custom
properties. But the principle is aimed at our design: **in nisli, an element's padding
will be caused by an attribute on an ancestor.** Meta considered that shape, named it,
and built `stylex.when.*` markers specifically to avoid it. We should be able to say why
they are wrong, or scope the disagreement to "inherited custom properties are debuggable
in a way descendant selectors are not — and we ship `explain()` to prove it."

### 5. The vocabulary-size risk has a measured worst case, and it is 2,204

M3 — the most carefully designed token system in the industry, with a three-layer
ref→sys→comp architecture — needed **2,204 component tokens across 49 components** to
express one design language on the web. Our §0.1 risk statement says *"if it needs
hundreds of entries […] the idea is weaker than it sounds."* M3 is two orders of
magnitude past "one page". Radix Themes needed **59 prop defs**, of which it had to open
**40 to arbitrary strings** to stay usable. Both are evidence that a *closed* vocabulary
small enough to fit in an agent's context is not obviously reachable — and neither of
those systems even attempts a fit solver.

### 6. Closure has never correlated with adoption, and the correlation is inverted

| | closure | dl/wk |
|---|---|---|
| `class-variance-authority` (pure mapping, no closure) | none | **64.8M** |
| `tailwindcss` (arbitrary values are the API) | none | **126.4M** |
| `@radix-ui/themes` (40/59 props open) | none | 975k |
| `react-strict-dom` (real closure) | **full** | 656k, **3.5k★**, v0.0.55 |
| `@salesforce/design-system-react` | none | 11k |

The two most-installed things in the survey are the two with the *least* closure. The one
system with real closure has 3,550 stars after three years of Meta backing. This does not
prove closure repels users — RSD's target is cross-platform React, not web styling — but
it does destroy any claim that closure is *itself* an adoption argument. **The adoption
argument has to be the loop (verify/debug), not the purity.**

### 7. Shopify killed a React design system, but it did not kill the mapping model

Worth stating so we do not over-read finding #1: Polaris React is deprecated because
Shopify wanted framework-agnostic *distribution* (their words: *"a more technology-agnostic
foundation"*), **not** because `size`/`variant` mapping failed. `@shopify/polaris` still
does 269k dl/wk while archived. The industry did not reject the mapping model; one vendor
changed its delivery vehicle.

### 8. Tailwind v4 already owns "tokens are CSS custom properties"

If our pitch leads with *"values come from CSS custom properties in one theme file"*, the
reply is `@theme`, at 126M dl/wk, since v4. The load-bearing difference is one line of
their compiler — `styleRule(':root, :host', [])` at `index.ts:594` — and it is a
difference in **scope count**, not in mechanism. If we cannot demonstrate a *user-visible*
win from per-subtree resolution (the same component source rendering correctly in a
sidebar and a hero), we have no differentiator against the incumbent at all.

---

## Open questions for the maintainer

1. **Given Polaris WC shipped exclusivity + derivation, is C10 still part of the pitch, or
   only part of the implementation?** *Tradeoff:* keeping C10 in the pitch is honest about
   what the framework does but invites "Shopify did it"; dropping it to an implementation
   detail sharpens the pitch onto C11 (author-your-own roles + fit solver + checker) but
   makes the elevator sentence harder — "the engine makes every decision that needs eyes"
   requires the listener to already believe eyes-decisions are the problem.

2. **Do we derive from one unit (our F9 path) or ship one authored table per density
   (Adobe's path)?** *Tradeoff:* one unit gives provenance, a tiny table and free axis
   composition, and demands a table-consistency checker we have not built. Per-density
   tables are boring, guaranteed self-consistent, beautiful-by-hand — and reintroduce
   exactly the duplicated maintenance burden C11 §1 indicts `buttonVariants` for. Adobe
   chose duplication with far more resources than we have.

3. **Is the escape ratio target 0 % or a budget?** *Tradeoff:* Primer's measured 15 %
   under lint suggests 0 % is only achievable by shrinking the covered surface. A budget
   (say ≤2 % for the registry, app-configurable) is credible and gateable; 0 % is a
   marketing number that will be met by widening the vocabulary until it stops being
   enumerable — which is how M3 got to 2,204 tokens.

4. **Does `role` get a context-derived default (Shopify's `variant="auto"`) or stay
   required?** *Tradeoff:* an `auto` default makes the shortest agent program the correct
   one and removes another eyes-decision — but "the first button in a `<ui-toolbar>` is
   primary" is a *guess about intent*, and a wrong guess is invisible in exactly the way
   this whole project exists to prevent. Wrong-but-consistent may be worse than absent.

5. **Do we sense the touch axis or declare it?** *Tradeoff:* Spectrum senses it
   (`any-pointer: fine`), which deletes an author decision but makes SSG output
   client-dependent and makes the checker's 240-cell matrix a *conditional* claim. Our
   prototype declares it, which is deterministic and pre-solvable but leaves one more
   decision with the author.

6. **How is the context-axis set versioned?** Figma has a named failure class for this
   (mode conflicts) with a documented multi-file remediation. If an app pins `@nisli/next`
   and we add a density, what happens to already-resolved SSG output and to third-party
   registry components? *Tradeoff:* freezing the axis set early protects consumers and
   caps expressiveness; leaving it open invites Figma's chain-of-stale-versions problem
   into a build system.

7. **Do we answer Meta's encapsulation principle, or scope our disagreement?**
   *Tradeoff:* claiming inherited custom properties are safe where descendant selectors
   are not requires us to *prove* debuggability — which means `explain()` must name the
   supplying ancestor, which means provenance is a runtime feature with a byte cost
   against the 10 kB ceiling.

---

## Belongs to another slice

- **`remote-dom` as a closure mechanism** (Shopify's sandbox that makes "no CSS" possible)
  is an architecture/packaging question, not a vocabulary one.
- **Material Web's per-component gzip budget table** (`docs/size.md`) is a byte-budget
  input for whoever owns the 10 kB ceiling / packaging slice.
- **Figma auto-layout hug/fill and `penpot`** as *fit* precedents (rather than as
  vocabulary) belong to the constraint-layout slice; I only covered Figma **variables and
  modes** here, which is the token/vocabulary half.
- **`stylex.when.*` markers** as an alternative to container style queries is a mechanism
  question for whoever owns the CSS-mechanism slice.

---

## Sources

### Repositories read (clone commit)

| repo | commit | date | paths cited |
|---|---|---|---|
| `radix-ui/themes` | `1faff10ac26ae17f09944d418c6949b93fc6b566` | 2026‑04‑11 | `packages/radix-ui-themes/src/components/button.tsx:9-11`; `.../components/_internal/base-button.props.ts:8-31`; `.../components/_internal/base-button.css` (SIZES); `.../components/theme.tsx:195-212`; `.../components/theme.props.tsx:9,62`; `.../helpers/extract-props.ts:120`; `.../props/padding.props.ts:5-22`; `.../styles/tokens/space.css:1-11`; `.../styles/tokens/scaling.css` |
| `adobe/react-spectrum` | `dabbd0dd43fe9de132ef47bdddb47330f0e755c2` | 2026‑08‑26 | `packages/@adobe/react-spectrum/src/provider/Provider.tsx:63,112`; `.../src/provider/mediaQueries.ts:49-59`; `packages/@adobe/spectrum-css-temp/vars/spectrum-medium.css:13-37`; `.../vars/spectrum-large.css:14,23,30` |
| `material-components/material-web` | `cac97678831d48d4eb4a606ca50f92673a1dc20c` | 2026‑08‑21 | `docs/theming/README.md:29-48`; `docs/roadmap.md:68-72`; `docs/size.md`; `tokens/_md-comp-*.scss` (49 files, 2,204 tokens) |
| `tailwindlabs/tailwindcss` | `90f8ff41c8e2a4d17bc76921e23e9d672123da76` | 2026‑08‑15 | `packages/tailwindcss/src/index.ts:546-599`; `packages/tailwindcss/src/candidate.ts:17,69,95,112,177` |
| `facebook/stylex` | `5f7acaa4b332e2cf8352e95e5bc83efd70904fd4` | 2026‑08‑25 | `packages/docs/content/docs/learn/thinking-in-stylex.mdx:277-304`; `.../learn/theming/creating-themes.mdx:39-42`; `.../api/configuration/eslint-plugin.mdx:17,75-89`; `packages/@stylexjs/eslint-plugin/src/stylex-valid-styles.js:241,387` |
| `react/react-strict-dom` (was `facebook/react-strict-dom`) | `c877f5c19b141e25c089d993b4cc584e669b6e39` | 2026‑06‑23 | `packages/react-strict-dom/src/shared/isPropAllowed.js:10-160` (144 entries, `className` absent); `packages/react-strict-dom/src/web/modules/createStrictDOMComponent.js:21-29,45-46` |
| `vanilla-extract-css/vanilla-extract` | HEAD @ 2026‑08‑26 | 2026‑08‑07 | `packages/sprinkles/README.md`; `packages/sprinkles/src/types.ts` |
| `chakra-ui/panda` | HEAD @ 2026‑08‑26 | 2026‑08‑25 | `packages/types/src/config.ts:398-404` |
| `tamagui/tamagui` | `ae9f930b86b77fca563b2ab4799fbae7e4e395d4` | 2026‑08‑25 | `code/core/sizable-context/src/index.ts:3`; `code/ui/button/src/Button.tsx:27-42,114-130`; `code/core/get-button-sized/src/index.ts:4-24` |
| `primer/react` | HEAD @ 2026‑08‑26 | 2026‑08‑26 | `packages/react/src/Button/ButtonBase.tsx:103-117`; `packages/react/src/Button/ButtonBase.module.css`; counts over `packages/react/src/**/*.module.css` |
| `Shopify/polaris-react-archive` | `main` | archived | `README.md` |

### Package metadata read (not cloned)

- `@carbon/react@1.114.0` — `lib/components/Button/Button.d.ts` (via unpkg)
- `@fluentui/react-button@9.6.4` — `lib/components/Button/useButtonStyles.styles.js:538,548` (via unpkg)

### First-party documentation

- [shopify.dev · Using Polaris web components](https://shopify.dev/docs/api/polaris/using-polaris-web-components.md) — §Styling, §Scale, §Execution model
- [shopify.dev · Button (`s-button`)](https://shopify.dev/docs/api/app-home/web-components/actions/button.md) — `variant`/`tone` `auto` semantics
- [Figma Help · Modes for variables](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables) — Auto mode inheritance, mode conflicts

### Adoption figures (fetched 2026‑08‑25/26)

npm `downloads/point/last-week`: `tailwindcss` 126,443,545 · `class-variance-authority`
64,794,507 · `@vanilla-extract/css` 3,047,304 · `@stylexjs/stylex` 1,772,690 ·
`@adobe/react-spectrum` 1,195,606 · `@vanilla-extract/sprinkles` 1,051,975 ·
`@radix-ui/themes` 974,514 · `@stylexjs/eslint-plugin` 703,903 · `react-strict-dom`
655,676 · `@fluentui/tokens` 427,853 · `@fluentui/react-components` 394,167 ·
`@pandacss/dev` 439,034 · `@shopify/polaris` 269,175 · `@shopify/ui-extensions` 254,090 ·
`@shopify/polaris-tokens` 241,506 · `tamagui` 238,670 · `@carbon/styles` 190,171 ·
`@carbon/react` 165,952 · `@material/web` 134,690 · `@primer/primitives` 126,773 ·
`@primer/react` 57,345 · `@salesforce/design-system-react` 11,282.

GitHub REST (`stargazers_count` / `pushed_at` / `archived`): `tailwindlabs/tailwindcss`
97,339 · 2026‑08‑14 · false — `penpot/penpot` 59,190 · 2026‑08‑25 · false —
`microsoft/fluentui` 20,226 · 2026‑08‑26 · false — `adobe/react-spectrum` 15,817 ·
2026‑08‑26 · false — `tamagui/tamagui` 14,153 · 2026‑08‑26 · false —
`material-components/material-web` 11,199 · 2026‑08‑21 · false —
`vanilla-extract-css/vanilla-extract` 10,411 · 2026‑08‑07 · false — `facebook/stylex`
9,892 · 2026‑08‑25 · false — `carbon-design-system/carbon` 9,385 · 2026‑08‑26 · false —
`radix-ui/themes` 8,645 · 2026‑04‑11 · false — `Shopify/polaris-react-archive` 6,174 ·
2026‑08‑11 · **true** — `chakra-ui/panda` 6,158 · 2026‑08‑25 · false — `primer/react`
3,892 · 2026‑08‑26 · false — `react/react-strict-dom` 3,550 · 2026‑06‑23 · false —
`salesforce/design-system-react` 981 · 2026‑06‑02 · false — `primer/primitives` 402 ·
2026‑08‑18 · false — `material-foundation/material-tokens` 284 · 2023‑08‑15 · **true**.

GitHub issue-search totals (`api.github.com/search/issues`, 2026‑08‑26):
`repo:adobe/react-spectrum UNSAFE_className` → **304**;
`repo:radix-ui/themes className` → **81**;
`repo:material-components/material-web customization` → **25**;
`repo:adobe/react-spectrum "custom styling"` → **23**;
`repo:react/react-strict-dom "invalid prop"` → **6**;
`repo:react/react-strict-dom className` → **1**.

### Counts computed from the clones

| claim | command shape | result |
|---|---|---|
| Radix Themes prop-def openness | `grep -ho "type: '[^']*'" src/props/*.ts \| sort \| uniq -c` | 25 `enum \| string`, 15 `string`, 14 `enum`, 4 `boolean`, 1 `ReactNode` = **59** |
| Spectrum scale files are hand-typed | `grep -oE '[0-9]+px' spectrum-{medium,large}.css \| wc -l`; `grep -c 'calc(' …` | **136 / 169** px literals; **0 / 0** `calc(` |
| `scale-factor` unused | `grep -n scale-factor spectrum-*.css` | one hit per file — its own declaration |
| M3 component tokens | `ls tokens/_md-comp-*.scss \| wc -l`; `grep -h "^  '" tokens/_md-comp-*.scss \| wc -l` | **49** files, **2,204** tokens |
| M3 density | `grep -rn density tokens/ docs/` | 1 deprecation note + 1 roadmap entry; **no density scale** |
| Primer escapes | `grep -rh 'stylelint-disable' src --include='*.css' \| wc -l` | **502** (`primer/spacing` 209, `primer/colors` 97) |
| Primer off-token lengths | `grep -rhoE '[0-9]+px' src --include='*.module.css' \| wc -l` vs `var(--` | **572** px vs **3,257** token refs |
| RSD allowlist size | `grep -cE "^  '" isPropAllowed.js` | **144** entries; `className` absent |

### `[UNVERIFIED]`

- Shopify's Polaris Web Components implementation source is **not public**; every claim
  about it comes from Shopify's own developer documentation, not from reading code. In
  particular I could not verify *how* `variant="auto"` resolves (ancestor query? slot
  position? sibling count?), nor whether the "no custom CSS" guarantee is enforced by the
  `remote-dom` sandbox alone or by additional checks.
- `@shopify/ui-extensions` weekly downloads (254,090) are a **proxy** for Polaris Web
  Components adoption; the components ship inside that package's surface but the number
  also covers non-Polaris extension APIs.
- `react-strict-dom`'s 655,676 weekly downloads are almost certainly dominated by
  CI/transitive installs rather than distinct applications; I could not separate them.
- I did not read `penpot` source. It appears in the roster for the sibling constraint
  layout slice; its 59,190 stars / 2026‑08‑25 push are recorded above for completeness only.
