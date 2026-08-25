# BET 08 — A Modern-CSS Pass Through @nisli/ui

**Status: Draft investment brief** (August 2026 research sweep)

## Context

@nisli/ui is a shadcn-style copy-source registry: light-DOM custom elements styled by Tailwind v4 utility strings, with `display:contents` transparent hosts (ADR 0022 §2, host-transparency invariant, `docs/adr/0022-nisli-ui-component-library.md:145-149`). Between Dec 2025 and mid-2026 five CSS features crossed (or approached) Baseline that map directly onto this architecture's pain points: `@scope` incl. donut scoping (Baseline newly Dec 2025 — Chrome 118 / Safari 17.4 / FF 146), container **style** queries (Baseline newly ~May 2026, FF 151; Interop 2026 focus), `field-sizing: content` (Baseline newly Jun 16 2026), `light-dark()` (+ `@property`, widely available), and customizable `<select>` (`appearance: base-select`, Chromium-only — pure progressive enhancement over a native select). Typed `CSS attr()` (Chrome 133+, Interop 2026) is the sixth, speculative track.

The registry already ships Baseline-newly CSS — `field-sizing-content` sits in the textarea class list today, `@container` size queries in card/form-field, `:has()` throughout, `content-visibility` in message-scroller — so the support-floor precedent is set by upstream shadcn tracking, not by us. This bet asks: which of these features pay down real debt (notably the UI-36B transparent-host selector debt) versus merely modernize syntax.

## Current state in nisli

- **Tokens**: `packages/ui/registry/default/styles/theme.css:13-47` (`:root` light block) and `:49-82` (`.dark` override block), `@theme inline` mapping at `:84-124`, UI-55 base rule `* { @apply border-border outline-ring/50 }` at `:147-156`. Dark mode = `.dark` class on any ancestor (ADR 0022 §3, `0022:210-212`).
- **www theme toggle**: `packages/www/src/shell.ts:47` — inline head script adds `.dark` to `<html>` from `localStorage.theme` or `prefers-color-scheme`; toggle at `:52-55` flips the class and persists. After the head script runs, **the class is the single truth**; absence of `.dark` means light.
- **Modern CSS already in use**: `field-sizing-content` (`textarea.ts:35`), `@container/card-header` (`card.ts:71`), `@container/field-group` (`form-field.ts:286`, with the boxed-element physics note at `:273-278` — a `display:contents` host cannot be a container), `:has()` (`table.ts:122,142`, `input-group.ts:45`), `content-visibility` (`message-scroller.ts:282`).
- **UI-36B debt (the key liability)**: `docs/worklists/ui/UI-36B-WORKLIST.md:184-219` census — `>` combinators and positional selectors do not flatten `display:contents` hosts, so every upstream direct-child rule needs per-component translation. Dispositions: TRANSLATED (button-group `button-group.ts:26-39` — doubled parallel selectors like `[&>ui-button:not(:first-child)>[data-slot=button]]:rounded-l-none`; form-field `form-field.ts:80-111` `[&>*>*]:w-full`; toggle-group/input-otp/accordion via UI-57), and **still-open DEAD rows**: form-field/input-group → **UI-58** (`input-group.ts:37-45,67-73` document the dead upstream selectors), table → **UI-59** (`table.ts:89` `[&>tr]:last:border-b-0` through `ui-table-row` hosts; `:122,:142` `[&>[role=checkbox]]`). ADR 0022 §2 (`0022:151-168`) mandates mechanical classification of every direct-child/positional selector per port — a permanent tax on every future component.
- **State plumbing today**: sidebar root reflects `data-state/data-collapsible/data-variant/data-side` (`sidebar.ts:273-276`) and descendants select via ancestor-attribute arbitrary variants (`sidebar.ts:345-348`); form-field reflects `data-invalid` on the field div and JS-effects `aria-invalid` onto the found control (`form-field.ts:190-195`); toggle-group hands variant to items through JS context.
- **Select** is already native-first: a real `<select>` + wrapper + themed chevron SVG (`select.ts:1-30,136-160`), corresponding to upstream `native-select.tsx` (worklist `:53-56`). There is **no ARIA-listbox select to keep** — the PE story is unusually clean here.
- **Progress** computes the indicator transform in JS (`progress.ts:49,65`) — an `attr()` candidate.

## Proposed design

### 1. `@scope` — ownership boundaries, honestly assessed against UI-36B

**Precise analysis of the debt fit:** UI-36B's problem is that `>` fails because a real DOM node (the host) interposes; `@scope` operates on DOM ancestry and does **not** flatten `display:contents` either — `:scope > *` still matches the host. So `@scope` is *not* a drop-in fix for direct-child translation. But most translated selectors don't actually mean "literal child" — they mean **"the painted node this group owns, not one inside a nested instance."** Direct-child was upstream's *encoding* of ownership. Donut scoping expresses ownership directly, depth-independently:

**Before** (button-group nested-gap + focus stacking, `button-group.ts:27`, doubled paths):

```css
.has-\[\>ui-button-group\>\[data-slot\=button-group\]\]\:gap-2:has(...) { gap: .5rem }
[&>ui-button>[data-slot=button]]:focus-visible:z-10 ...   /* + the plain-child twin */
```

**After** (one depth-independent rule, nested groups excluded by the donut):

```css
@scope ([data-slot=button-group]) to ([data-slot=button-group]) {
  :scope :is([data-slot=button], [data-slot=button-group-text]):focus-visible {
    position: relative; z-index: 10;
  }
}
```

**Example 2 — table UI-59 (open DEAD row).** Upstream `tfoot > tr:last-child` intent through `ui-table-row` hosts:

```css
@scope ([data-slot=table-footer]) to ([data-slot=table]) {
  :scope ui-table-row:last-child [data-slot=table-row] { border-bottom: 0; }
}
```

(Note the positional half still lives on the *host* — `:last-child` counts hosts, which is exactly UI-57's translation; `@scope` contributes the "this footer, not a nested table" boundary.)

**Example 3 — dropdown/menu content bleed.** A menu item's `[&_svg]` descendant rules currently reach into anything projected inside an item (e.g. a nested badge's icon). `@scope ([data-slot=dropdown-menu-item]) to ([data-slot])` fences icon sizing to un-slotted raw SVGs — the nested-component-bleed class that descendant translation (the UI-52 child→descendant rule) systematically widens.

**Verdict:** `@scope` is **orthogonal to the mechanical `>` translation but directly addresses its worst side effect** — the doubled selectors and over-broad descendant rewrites. It cannot replace positional host-counting (UI-57 stands). **Cost:** `@scope` blocks cannot be expressed as Tailwind utility strings, so adopting it introduces a second styling channel — a small `styles/components.css` registry item (or fenced additions to theme.css). That is a real architectural change for a copy-source registry and the main reason to keep adoption narrow: the UI-58/UI-59 open rows plus button-group/menu cohesion, nothing else in v1.

### 2. Container style queries — CSS-only state propagation

Key physics: **custom properties inherit straight through `display:contents`**, and every element can answer style queries without `container-type`. So a group's painted div sets `--ui-*`, and any painted descendant — regardless of interposed hosts — queries it. This replaces the *styling half* of data-attribute/JS-context plumbing.

Delivery stays inside the utility-string world via Tailwind v4 custom variants shipped in theme.css:

```css
@custom-variant field-invalid (@container style(--field-invalid: true));
@custom-variant sidebar-collapsed (@container style(--sidebar-state: collapsed));
```

**Concrete example — form-field invalid propagation.** Today: `data-invalid` on the field div drives `data-[invalid=true]:text-destructive` (`form-field.ts:96`), while the control's destructive ring needs the JS effect that sets `aria-invalid` on the located control (`:190-195`). After: the field div also sets `--field-invalid: true` (one style binding), and input/textarea/select class lists gain `field-invalid:border-destructive field-invalid:ring-destructive/20` — the control styles react with **no querySelector wiring**. The `aria-invalid` effect **stays** (it is semantics, not styling; UI-44's delivery gap is about a11y truth) — but the visual path no longer depends on the wiring having found the control.

**Sidebar:** replace ancestor-path variants like `[[data-side=left][data-state=collapsed]_&]:cursor-e-resize` (`sidebar.ts:345`) with `--sidebar-state`/`--sidebar-side` set once at the root and queried by rail/menu descendants — names instead of DOM paths, robust to future wrapper changes. **Toggle-group/button-group:** `--toggle-variant` propagates group variant to item *styles* CSS-only; the JS context handoff remains only for the DOM-contract `data-variant` attributes upstream selectors key on.

Timing caveat: Baseline newly ~May 2026 (FF 151) — the youngest feature we'd depend on for visuals. Keep the data-attributes during a deprecation window (below).

### 3. `field-sizing` — mostly already banked

`textarea.ts:35` already ships `field-sizing-content`; with Baseline Jun 2026, FF/Safari users now actually get autogrow. **There is no autogrow JS to delete in nisli** — the win is documenting the newly-true behavior. New adoption: an opt-in `w-fit field-sizing-content` recipe for `ui-input` (self-sizing inline inputs, e.g. tag editors) and `ui-select` (`field-sizing: content` sizes a select to its selected option — pairs with §5). Small, additive, no migration.

### 4. theme.css modernization — `light-dark()` + `@property`

Collapse the 34-token duplicate `.dark` block into single declarations:

```css
:root { color-scheme: light; }
.dark  { color-scheme: dark; }

:root {
  --background: light-dark(oklch(1 0 0), oklch(0.145 0 0));
  --border:     light-dark(oklch(0.922 0 0), oklch(1 0 0 / 10%));
  /* … */
}
```

The www toggle (`shell.ts:47,52-55`) keeps working unchanged: it only flips `.dark`, and `color-scheme` is what `light-dark()` reads — the class remains the single truth, no FOUC change (the head script still resolves system preference synchronously). **shadcn theme-ecosystem compatibility holds**: a consumer pasting a stock `:root { … } .dark { … }` theme after our import simply overrides our `light-dark()` declarations wholesale, and their own `.dark` block flips values exactly as today (equal-specificity/later-order semantics are unchanged from the current file). The `@theme inline` block and UI-55 base rule are untouched. Bonus: `color-scheme` finally makes scrollbars/form chrome/`::backdrop` follow theme — check the scroll-area injected scrollbar CSS still matches.

Add `@property` registration for the semantic color tokens:

```css
@property --background { syntax: "<color>"; inherits: true; initial-value: oklch(1 0 0); }
```

Typed tokens make theme flips transition-capable (`transition: background-color` now interpolates across the class flip instead of snapping) and reject garbage values at parse time. Register only the flat color tokens (not `--radius` calc chains); keep the registrations in a fenced, deletable section since consumers own the copied file. `contrast-color()` (Baseline Apr 2026): **decline for now** — shadcn's explicit `*-foreground` pairs are the compat API, and `contrast-color()` currently resolves only to black/white; revisit for chart/badge autocontrast.

### 5. Customizable `<select>` — progressive enhancement on an already-native select

nisli's select is a real `<select>` (`select.ts`), so this is pure styling, no behavioral fork and **no ARIA listbox to maintain** (that correction to the sweep's framing matters: the deletion-trigger question mostly evaporates). Plan, in a fenced `@supports (appearance: base-select)` block (real CSS — `::picker` cannot be a utility string; co-locate with the §1 `components.css` or a `styles/select-picker.css` registry item that `select`'s registry entry lists):

```css
@supports (appearance: base-select) {
  [data-slot=native-select] { appearance: base-select; }
  [data-slot=native-select]::picker(select) {
    appearance: base-select;
    background: var(--popover); color: var(--popover-foreground);
    border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / .1));
  }
  [data-slot=native-select] option {
    padding: .375rem 2rem .375rem .5rem; border-radius: calc(var(--radius) - 4px);
  }
  [data-slot=native-select] option:checked { background: var(--accent); }
}
```

Non-Chromium renders the OS popup exactly as today — zero risk. **Defer `<selectedcontent>`/`<button>`-in-select markup**: the parser relaxation is not cross-browser, and injecting that markup would change the DOM contract for a Chromium-only win; the trigger to add it (and to un-fence the `@supports` block) is **Safari + Firefox shipping `base-select` as stable** — record that trigger in the file header so the copy-source stays readable: one native baseline path + one clearly-fenced enhancement block with its own deletion/graduation condition. Keep the existing themed chevron SVG (it already works in both worlds).

### 6. Typed CSS `attr()` — speculative, attribute-as-truth pairing

Chromium-only (Chrome 133+, Interop 2026) → PE-only. Constraint: `attr()` reads attributes of the *styled element*, and hosts are boxless — so candidates are attributes nisli already places on painted nodes. Best candidate: progress — `--progress-value: attr(aria-valuenow type(<number>), 0)` on the painted root, indicator width from `calc()`, deleting the JS transform string (`progress.ts:49`) *behind* `@supports`. With T3 (`docs/adr/0030.2:103-135`) making attributes the declared single truth and reflecting them onto painted roots, `attr()` becomes the zero-JS bridge from schema attributes into styles (e.g. numeric `size`/`span` attributes). Hold as a one-component pilot; do not spend batch budget here.

## Implementation plan (worklist-cadence batches, per-family regressions each)

- **Batch 0 — theme.css modernization (§4)**: `light-dark()` + `color-scheme` + fenced `@property` block; extend `packages/ui/scripts/theme-e2e.mjs` (the UI-55 precedent) to assert both modes' computed tokens and a transition interpolation; verify www toggle + scroll-area scrollbar. No component files touched.
- **Batch 1 — style-query variants, forms family (§2)**: `@custom-variant field-invalid/field-disabled` in theme.css; form-field sets `--field-invalid`; input/textarea/select/checkbox/radio class lists adopt the variant alongside (not replacing) `aria-invalid:` rules. Closes the visual half of the UI-44 exposure.
- **Batch 2 — style-query variants, structure family (§2)**: sidebar `--sidebar-*`, toggle-group/button-group `--*-variant`; data-attributes retained (DOM contract + fallback).
- **Batch 3 — `@scope` pilot on the open DEAD rows (§1)**: UI-58 (form-field/input-group) and UI-59 (table) implemented as donut scopes in the new `styles/components.css`; then button-group cohesion consolidation (delete the doubled parallel paths once the scope rules are proven). Update ADR 0022 §2 doctrine: census dispositions gain a `SCOPED` disposition.
- **Batch 4 — select PE (§5)** + field-sizing recipes (§3, docs/examples only).
- **Batch 5 (optional) — `attr()` progress pilot (§6)**.

## Feature detection & degradation

- Unknown at-rules/declarations are dropped whole: `@scope`, `style()` queries, `light-dark()`, `::picker` degrade silently. Policy per feature: **light-dark** — hard requirement (widely available; no fallback kept). **Style queries** — dual-path during a deprecation window: data-attribute selectors stay until FF 151 penetration clears the project's floor (~Q1 2027 review), then the attribute *selectors* (not the attributes) are deleted. **@scope** — for the UI-58/59 rows there is no working fallback today (they're DEAD), so @scope-only is strictly better than the status quo; for button-group the doubled selectors are only deleted after a support-floor ruling. **base-select / attr()** — `@supports`-fenced, cosmetic-only. Record the support floor as a one-line policy in the registry README (mirrors upstream shadcn's Baseline-newly posture already implied by `field-sizing-content` at `textarea.ts:35`).

## Interactions

- **Bet 02 (overlay/top-layer styling)**: `color-scheme` from Batch 0 is a prerequisite for correct `::backdrop`/top-layer theming; the select `::picker` styling (§5) and any popover-API migration should share one popover-token surface (`--popover`, `--border`, `--radius`). The @scope menu-content boundary (§1 ex. 3) applies to whatever DOM bet 02 lands.
- **T3 attr schema (ADR 0030.2)**: style-query custom props and `attr()` reads become part of a component's declared contract; `p.state()` reflection onto painted roots is what makes `attr()` viable.
- **Bet 06 (manifest)**: the manifest should document the **CSS API** this bet creates — custom variants (`field-invalid:`), settable `--ui-*` props, `@property`-registered tokens, and the fenced-enhancement blocks with their graduation triggers. Without that, copy-source consumers can't discover the CSS-only surface.

## Risks & open questions

1. **Second styling channel**: `components.css` breaks the "everything is a class string" purity; mitigated by capping its scope (UI-58/59 + cohesion + select PE) — but it needs an ADR ruling (0022 amendment) before Batch 3.
2. **Specificity/proximity**: `@scope` proximity tie-breaking interacts with consumer `className` overrides differently than utility classes; needs explicit override tests.
3. **Style-query youth**: FF 151 is ~3 months old; the dual-path window is mandatory, which temporarily *increases* selector surface.
4. **@property + consumer themes**: a registered `<color>` token rejects a consumer's malformed override *entirely* (falls back to initial-value) where an unregistered var would fail soft at use sites — document in the fenced block.
5. **Tailwind v4 confirmation**: verify `@custom-variant` accepts `@container style(...)` bodies in the pinned Tailwind version before Batch 1 (spike, day 1).
6. Open: should the census's TRANSLATED rows (already working) migrate to @scope, or freeze? Recommendation: freeze; only DEAD/doubled rows migrate.

## Verification plan

- **Visual regression**: the www preview sweep (`packages/www/scripts/preview-sweep.mjs`, `pnpm test:previews`) over every /ui preview per batch, desktop + 390px, matching UI-36B's evidence bar. **Gotcha (recorded)**: vitest wipes dist assets — rebuild www before sweeping. Sweep is Chromium; add a focused Firefox/WebKit playwright pass for the style-query and @scope batches specifically (new harness → carries the review-attestation requirement).
- **Token/E2E**: extend `packages/ui/scripts/theme-e2e.mjs` for light-dark/@property (computed values both modes, transition interpolation, consumer-override composition).
- **Per-batch Chromium computed-style proofs** for each closed census row (the UI-55/57/61 evidence pattern), plus a base-select fenced-block proof that non-support renders byte-identical DOM.
- Deploy only after review verdicts per house rules; census rows flip only on performed rechecks.

## Size estimate

- Batch 0: **S** (1 file + e2e extension). Batch 1: **M** (theme.css + ~6 components + tests). Batch 2: **M**. Batch 3: **M–L** (new registry item, ADR amendment, 4 component families, cross-browser proofs). Batch 4: **S–M**. Batch 5: **S**, optional.
- Total: roughly **3 engineer-weeks** at the repo's demonstrated batch cadence, front-loaded with two cheap, high-certainty wins (Batch 0–1) and the debt-paying core in Batch 3.
