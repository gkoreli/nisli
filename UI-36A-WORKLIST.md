# UI-36A — Visual-parity audit worklist (wave A: component names a–l)

Method (per ADR 0022 visual-parity amendment 2026-07-11, v1 criterion 2): every wave-A component carries TWO verdicts —
1. **Class-diff verdict** — char-level diff of every `cv`/`cva` base + variant string, `data-slot`/`data-state`/`data-variant`, element structure, and provenance header vs the canonical checkout at `shadcn-ref/apps/v4/registry/new-york-v4/ui`. Divergences logged here — real drift fixed, intentional platform divergences annotated and kept. (Automated audit, done.)
2. **Side-by-side** — manual eyeball pass (done 2026-07-12): the live www gallery preview (`nisli.dev/ui/<name>`, headless-chromium screenshots incl. overlay open-states) vs ui.shadcn.com's default-style demo, covering what class diffs cannot (stacking, focus rings, spacing). Legend: **☑** verified-match · **N/A** nisli-custom, no ui.shadcn.com counterpart · **⚠** flagged (see notes). (⏸ = formerly deferred while live rendered pre-fix copies; all re-run + resolved post-deploy against 39a8d36.)

Never ported from memory (NORTH-STAR tenet 3).

## Per-component verdict table (32) — categories are non-overlapping

| # | Component | Class-diff verdict | Side-by-side | Action |
|---|-----------|--------------------|:---:|--------|
| 1 | accordion | MATCH | ☑ | — |
| 2 | alert | MATCH | ☑ | — |
| 3 | alert-dialog | MATCH | ☑ | open-state verified (centered modal, Cancel/Continue) |
| 4 | aspect-ratio | MATCH | ☑ | 16/9 box |
| 5 | attachment | MATCH | N/A | nisli-custom — no ui.shadcn.com demo |
| 6 | avatar | PORTED (batch 2) ✅ | ☑ baseline | BASELINE verified live (Avatar/Image/Fallback). NEW-surface Badge/AvatarGroup/AvatarGroupCount still UNVERIFIED — the live /ui/avatar preview does NOT demo them (DOM at bca6c5d1: 1 basic avatar, 0 group/badge/count), so the translated ring+overlap can't be observed; needs a curated avatar-group demo. FINDING routed to architect/eng1 |
| 7 | badge | MATCH | ☑ | default/secondary/outline/destructive pills |
| 8 | breadcrumb | MATCH | ☑ | — |
| 9 | bubble | MATCH | N/A | nisli-custom — no ui.shadcn.com demo |
| 10 | button | MATCH | ☑ | all 6 variants |
| 11 | button-group | INTENTIONAL | ☑ | attached Cut/Copy/Paste; #E extra data-slot, kept |
| 12 | calendar | MATCH (class) | ☑ | fresh-live (39a8d36): June-2024 range 9–15, today ring, nav — matches shadcn; ✅ tsc fix folded |
| 13 | card | MATCH | ☑ | — |
| 14 | carousel | MATCH (class) | ☑ | fresh-live: slide + prev(disabled)/next arrows — matches shadcn; ✅ tsc fix folded |
| 15 | checkbox | MATCH (class) | ☑ | fresh-live + UI-53 contact-sheet: checked checkmark RENDERS (confirms the url() %27 fix); black vs shadcn.com blue = neutral theme token, not drift (class parity holds) |
| 16 | collapsible | MATCH | ☑ | — |
| 17 | combobox | INTENTIONAL | ☑ | open-state verified (search + list); documented deviation (Popover+Command) |
| 18 | command | DRIFT-FIXED | ☑ | fresh-live: palette (search + Suggestions group, highlighted item) — matches shadcn; ✅ #2 h-12 · ✅ #C sr-only · #F UI-43 (record-only) |
| 19 | context-menu | MATCH | ☑ | open-state verified (Actions/Back/Reload/Delete at pointer) |
| 20 | dialog | MATCH | ☑ | open-state verified (Edit profile modal); #D showCloseButton feature gap, deferred |
| 21 | direction | MATCH | N/A | provider — no visual / no ui.shadcn.com demo |
| 22 | drawer | MATCH | ☑ | open-state verified (bottom Move-goal + drag handle) |
| 23 | dropdown-menu | MATCH | ☑ | open-state verified (checkbox item, shortcut, submenu, destructive) |
| 24 | empty | MATCH | ☑ | fresh-live (bca6c5d1): renders the proper empty-state (folder icon, "No projects yet" + description + New-project button) — matches shadcn. NB formal curation tracked WWW-14; re-confirm if it changes |
| 25 | form-field | PORTED (UI-52) ✅ | ☑ | invalid-state verified; #B responsive/horizontal CLOSED — UI-52 ported the full field.tsx family (FieldGroup/FieldContent/…), NORTH-STAR line retired |
| 26 | hover-card | MATCH | ☑ | open-state verified (floating framework card) |
| 27 | input | MATCH | ☑ | labeled email input |
| 28 | input-group | INTENTIONAL | ☑ | fresh-live (bca6c5d1): renders proper addons (search input + @nisli.dev suffix) — matches shadcn. NB formal curation tracked WWW-14; re-confirm if it changes. #E extra data-slot, kept |
| 29 | input-otp | DRIFT-FIXED | ☑ | fresh-live: 6 slots + minus separator — matches shadcn (aria-invalid fix is state-specific, not shown at rest); ✅ #1 tokens+forwarding · ✅ tsc fix |
| 30 | item | MATCH | ☑ | media + title + action |
| 31 | kbd | MATCH | ☑ | ⌘K keys |
| 32 | label | MATCH | ☑ | — |

**Class-diff tally (non-overlapping, sums to 32):** 25 MATCH · 2 DRIFT-FIXED (command, input-otp) · 3 INTENTIONAL (button-group, input-group, combobox) · 2 PORTED (avatar batch-2 ✅, form-field UI-52 ✅). No open SCOPE items — both scope rulings closed.
**Manual side-by-side — WAVE-A ROW LEDGER CLOSED (2026-07-12).** Row accounting: 29 ☑ · 3 N/A (attachment/bubble/direction — nisli-custom, no ui.shadcn.com demo) = 32 rows resolved. The 5 formerly-deferred (calendar/carousel/checkbox/command/input-otp) verified on current-gen live (39a8d36) — checkbox's rendered checkmark confirms the `url()` %27 fix (corroborated by cdx1's UI-53 contact sheets); empty + input-group verified on the payoff deploy (bca6c5d1), both now rendering the intended shadcn-matching demos (formal curation tracked WWW-14 — re-confirm if it changes). Mobile sidebar/DocsLayout drawer VERIFIED live post-WWW-13 (opens painted, data-state=open). All overlay open-states captured. **ONE RESIDUAL (a demo gap, not a row):** avatar batch-2's NEW Badge/AvatarGroup/AvatarGroupCount surface is still UNVERIFIED — the live /ui/avatar preview does not exercise it (0 group/badge/count in the DOM), so the translated ring+overlap can't be observed; needs a curated avatar-group demo. Routed to architect/eng1. (Avatar's ☑ is BASELINE-only.)
**WWW-12 layout — live verification (2026-07-12, VERIFIED desktop + mobile):** desktop DocsLayout — SidebarNav offset below the top bar (the `--header-height` offset works), derived grouped nav (docs sections + Components/Primitives) with active highlight, prose capped at `max-w-3xl` (article-level), /ui gallery full-width. Mobile drawer — after WWW-13 (5f0a76d, deploy bca6c5d1): the `SidebarTrigger` on `/docs` at 390px now OPENS the off-canvas Sheet (data-state=open, data-mobile panel painted over a dimmed backdrop). The earlier no-hydration blocker is CLOSED.

---

## Batch 1 — changes (parity + rev-gated forwarding + folded hygiene, all upstream-verified)

### #1 input-otp — slot classes + aria-invalid forwarding  [DRIFT ✅ FIXED, rev-gated]
- Class parity: `inputOTPSlotClasses` gains the 3 upstream active+invalid tokens (`data-[active=true]:aria-invalid:border-destructive`, `…:ring-destructive/20`, `dark:data-[active=true]:aria-invalid:ring-destructive/40`) in upstream ordering (input-otp.tsx:54).
- **Reachability (rev reject fix):** upstream spreads `{...props}`, landing `aria-invalid` on the class-bearing slot div; our transparent host can't forward implicitly, so those tokens were dead CSS. Added a **live boolean `aria-invalid` contract** on `ui-input-otp-slot` (attrs `ariaInvalid: 'boolean'` → kebab `aria-invalid`; ARIA tri-state via core's `raw !== 'false'` coercion) bound onto the inner div: `aria-invalid="${computed(() => props.ariaInvalid.value ? 'true' : undefined)}"`. Regression test proves both the factory-prop path and a post-mount `host.setAttribute('aria-invalid',…)` flowing to the inner element (and clearing on `"false"`), so the active+invalid hooks are now reachable.
- Note: this forwarding mechanism is the **reference implementation for UI-44** (arch) — the same dead-token-on-transparent-host class also affects textarea/toggle/toggle-group; arch to ratify + sweep. Mechanism reported to arch; not widened into this batch.

### #2 command — CommandDialog input-wrapper h-12  [DRIFT ✅ FIXED]
Prepended `**:data-[slot=command-input-wrapper]:h-12` (command.tsx:55) so the palette search row is h-12 in-dialog. Descendant `**:` selector, no `cn`-merge conflict.

### #C command — CommandDialog sr-only title/description  [SCOPE ✅ FIXED, arch C-ruling]
Added `DialogHeader className="sr-only"` wrapping `DialogTitle`/`DialogDescription` (defaults "Command Palette" / "Search for a command to run...", plus `title`/`description` props). DialogContent's `aria-labelledby`/`aria-describedby` reference the ids DialogTitle/DialogDescription self-assign from DialogContext, so the palette dialog is accessible-by-construction. Test asserts the wiring.

### #F command — aria-activedescendant + item IDs missing  [UI-43, record-only]
cdx1 found our command lacks ALL `aria-activedescendant` wiring + item `id`s (upstream cmdk has it). Ticketed as **UI-43** in arch's queue; recorded here per the deferred-equals-forgotten rule. No action in this batch.

### Folded tsc-strict fixes (cdx1 published-package sweep — stock Vite strict tsc, NORTH-STAR consumer-reality invariant)
- calendar.ts — removed unused `import { buttonVariants }` (day/nav classes already inline the twMerge-resolved list).
- carousel.ts — removed unused `let uid = 0;`.
- input-otp.ts — removed unused `type ReadonlySignal` from the `@nisli/core` import.
(Verified: `tsc --noEmit --noUnusedLocals` clean on these SOURCE files; remaining diagnostics live in `.test.ts` files, which are not published/copied.)

### Folded www-build hygiene fix (eng3 report)
- checkbox.ts — the `checked:bg-[url("…")]` data URI used backslash-escaped single quotes (`\'`), a TS-source artifact that leaked into the Tailwind-extracted CSS and tripped a lightningcss warning in the www build. Re-encoded the SVG attribute quotes as `%27` (no raw quote chars) — valid CSS + valid data URI, byte-identical render. (checkbox.test.ts asserts `data:image/svg+xml`, preserved.)

**Batch 1 status:** full ui suite green (849/849; +2 input-otp forwarding, +2 CommandDialog a11y over the 845 base). Awaiting rev re-review → ff-only to local main → rides the 0.2.1 checkpoint train if it re-passes in time.

---

## Batch 2 — changes (avatar sub-component port)

### #A avatar — port AvatarBadge / AvatarGroup / AvatarGroupCount  [SCOPE → ✅ PORTED]
Ported the three sub-components upstream added to `avatar.tsx`, diffed against the canonical checkout:
- `AvatarBadge` → `ui-avatar-badge` (`<span data-slot="avatar-badge">`): status-dot classes VERBATIM, incl. all three `group-data-[size=sm|default|lg]/avatar:` size + `[&>svg]` rules that read the ancestor avatar's `data-size`.
- `AvatarGroup` → `ui-avatar-group` (`<div data-slot="avatar-group">`): TRANSLATED (rev-gated) — upstream `-space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background` uses DIRECT-CHILD utilities, dead through our layout-transparent `<ui-avatar>` hosts (see the cross-cutting box-model rule). Retargeted to the boxed descendant: `[&>*:not(:first-child)>*]:-ms-2` (overlap, also covering the count chip) + `**:data-[slot=avatar]:ring-2 **:data-[slot=avatar]:ring-background` (ring). Same visual, `*:`→`**:` / space-x→descendant-margin translation; `group/avatar-group flex` unchanged.
- `AvatarGroupCount` → `ui-avatar-group-count` (`<div data-slot="avatar-group-count">`): the "+N" overflow chip, incl. the `group-has-data-[size=lg|sm]/avatar-group:` responsive sizing (`:has()`-based, descendant-safe), VERBATIM.

Platform translation (expected, not drift): standalone custom elements via `component()` + `transparentHost` + `children()` projection; `className` merged via clsx-style `cn`; `{...props}` spread → `className` attr. No shared state / no `AvatarContext` — matches upstream (pure presentational, CSS-driven), so they compose freely. Registry entry unchanged: same `ui/avatar.ts` file, `registryDependencies: ["utils"]` still correct.

Tests (`avatar.test.ts` +6): badge classes/transparency/className+children; group descendant overlap+ring class forms; a DOM-STRUCTURE regression proving `[data-slot="avatar"]` is a DESCENDANT (not a direct child) of the group through the `<ui-avatar>` host (the applicability proof for why `*:` is dead and `**:` is required); count chip classes/text; group/count host transparency. Full ui suite green; typecheck clean. No attr casts (className-only). Compiled-CSS + side-by-side browser check pending the shared Manual side-by-side gate (avatar's own ☑ above verified the fallback render; the batch-2 sub-components' overlap/ring want a live re-check once the gallery reflects this commit).

---

## SCOPE rulings (arch)

### #A avatar — PORT AvatarBadge/AvatarGroup/AvatarGroupCount (own batch 2) — ✅ PORTED
In-surface parity for an existing component; arch ruled PORT, but as a dedicated batch-2 item, NOT jammed into the fix cycle. The 3 previously-ported parts (Avatar/AvatarImage/AvatarFallback) MATCH verbatim.
**Resolution (batch 2):** the three upstream additions are ported — `AvatarBadge`
(`ui-avatar-badge`), `AvatarGroup` (`ui-avatar-group`), `AvatarGroupCount`
(`ui-avatar-group-count`), all standalone custom elements with NO `AvatarContext` (pure
presentational, CSS-driven, matching upstream). Badge + Count class lists are byte-for-byte;
**AvatarGroup's overlap + ring are TRANSLATED** (rev-gated) because upstream's direct-child
`-space-x-2` / `*:data-[slot=avatar]:ring-*` are dead through the layout-transparent
`<ui-avatar>` host — retargeted to the boxed descendant (`**:` ring +
`[&>*:not(:first-child)>*]:-ms-2` overlap; see the cross-cutting box-model rule). See the
Batch 2 changes section for the full detail + the DOM-structure applicability regression.

### #B form-field — responsive orientation + horizontal checkbox-token — ✅ CLOSED (UI-52)
`fieldVariants`: upstream `horizontal` ends with `has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` (field.tsx:66); the `responsive` orientation (`flex-col @md/field-group:flex-row …`, :68–72) was absent. Both depended on unported `FieldGroup` (`@container/field-group`) + `FieldContent`; arch ruled DEFER-until-ported.
**Resolution (UI-52):** ported the full `field.tsx` family into `form-field.ts` — `FieldGroup` (the `@container/field-group` root), `FieldContent`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldTitle`, `FieldSeparator` — then added the `responsive` orientation + the horizontal checkbox/radio token to `FormField`. Two documented translations: (a) the family's direct-child layout selectors are retargeted to descendant form (the cross-cutting box-model rule — transparent hosts); (b) the Radix-only `[role=checkbox]`/`[role=radio]` token is retargeted to nisli's native `[data-slot=checkbox]`/`[data-slot=radio-group-item]` (native-first precedent). NORTH-STAR deferred line retired. **New finding (flagged to arch):** a SECOND transparent-host category — native element RELATIONSHIPS (`<fieldset>`→`<legend>` caption/naming needs directness, broken by the host layer) — worked around with explicit `aria-labelledby` wiring in FieldSet. Container-query flip + compiled-CSS parity are browser-verify-gated (happy-dom has no layout engine).

### #D dialog — DialogContent `showCloseButton` prop absent (deferred)
Feature-parity gap only; no default visual regression. Deferred.

---

## INTENTIONAL PLATFORM — noted, NOT fixed

### #E extra `data-slot` on text sub-parts (button-group, input-group)
`ButtonGroupText` / `InputGroupText` carry a `data-slot` upstream omits. Additive styling hooks, consistent with our light-DOM every-part-gets-a-data-slot convention; not a visual regression. Kept.

### combobox — documented architectural deviation
Upstream delegates to `@base-ui/react` Combobox; ours is the classic Popover+Command composition (documented, ADR 0022 canonical-reference rule). Item geometry classes match; state hooks adapt to the cmdk convention. Intentional.

### General platform notes (all components)
No `asChild`/`Slot`, no `forwardRef`/React event props/`"use client"`; `transparentHost` + `children()` projection; kebab-case reactive attrs; native form controls (input/checkbox/label/textarea) per ADR 0022 §5; Button-composed ports inline the twMerge-resolved class list because our `cn` is clsx-style (no tailwind-merge). Framework-agnostic translation, expected, not drift.

### CROSS-CUTTING RULES — what does NOT survive a `display:contents` host
A layout-transparent host (`transparentHost` → `display:contents`) generates **no box** and inserts a DOM level between a parent and the slot-bearing element it wraps. Two distinct classes of upstream contract break through it — check BOTH at DESIGN time on any port whose parts wrap native/boxed elements (arch is folding the paired rule into the framework skill):

**(A) Box-model — utilities never paint/apply through a boxless host.** `ring`/`box-shadow`, `margin`, `space-x`/`space-y`, `padding`, `border`, `background` placed by a selector that MATCHES the host neither paint on it nor take effect; the real boxed target is one level deeper (a DESCENDANT). Any upstream **direct-child** selector (`*:`, `> *`, `space-*`, adjacent/sibling combinators) assuming the slot element is a direct child is DEAD. Translation: target the boxed descendant — `**:` instead of `*:`, an explicit descendant margin (e.g. `[&>*:not(:first-child)>*]:-ms-2`) instead of `space-*`, and `has-[[data-slot=x]]` instead of `has-[>[data-slot=x]]`. Container-query ROOTS also need a box, so `@container/*` must sit on the inner div, never the host. Selector MATCHING crosses `display:contents` fine (it is layout, not the DOM tree); only PAINTING/box-model does not. **Instances: checkbox/switch (native-control translation), command (`**:data-[slot=command-input-wrapper]`), avatar (AvatarGroup overlap+ring), form-field (the entire field family + the `@container/field-group` root — UI-52, the largest), and UI-60 — attachment (`**:data-[slot=attachment]` group + `**:data-[slot=spinner]` media, behind `ui-attachment`/`ui-spinner`), bubble (`**:` + `[&_` for `bubble-content`, ×16+13), message (`**:data-slot` align-end self-end); the reachable plain-element `*:[img]` and descendant `[&_svg]` selectors were classified and LEFT as-is.** Proven per family with a DOM-structure applicability regression + a built-CSS check (compiled site.css has the descendant form, zero `>[data-slot]` child combinators). Wave-B and all future ports must check every direct-child/`space-*`/ring-on-child selector against this rule.

**(B) Native-relationship — platform-enforced parent↔child contracts need DIRECTNESS.** Some native semantics require the two elements to be in a DIRECT parent/child DOM relationship, which the host layer severs: `<fieldset>`→`<legend>` (group caption/accessible name), `<select>`→`<option>`, `<table>`/`<tr>`→`<td>`/`<th>`, `<dl>`→`<dt>`/`<dd>`, `<ul>`/`<ol>`→`<li>`. Matching/styling is unaffected, but the platform BEHAVIOR (naming, list/table semantics, form grouping) does not attach across the transparent wrapper. Restoration: re-establish it explicitly — the same gap-filling `FormField` does for label↔control (id + `aria-*`). **Instance: form-field FieldSet↔FieldLegend (UI-52) — restored via explicit `aria-labelledby` on the fieldset pointing at the legend.** Any port composing a native container with host-wrapped native children must re-wire the broken relationship (or reconsider whether that part should be layout-transparent).

---

## Batch plan
- **Batch 1** (green, awaiting rev re-review): parity #1 #2 + #C a11y (arch ruling) + folded tsc-strict (calendar/carousel/input-otp) + www hygiene (checkbox). input-otp forwarding is rev-gated.
- **Manual side-by-side pass**: wave-A ROW LEDGER CLOSED — 29 ☑ + 3 N/A = 32 rows resolved (vs live 39a8d36 + payoff deploy bca6c5d1); mobile DocsLayout drawer verified post-WWW-13. ONE residual (demo gap, not a row): avatar batch-2 NEW-surface visual — the live /ui/avatar preview doesn't exercise Badge/Group/Count; routed to architect/eng1.
- **Batch 2** (✅ done, awaiting rev): #A avatar sub-component port — Badge/Count verbatim, AvatarGroup ring+overlap translated for the transparent host (cross-cutting box-model rule), +6 tests incl. the DOM-structure applicability regression.
- **Closed since**: #A avatar (UI-36A batch 2), #B form-field (UI-52 — full field.tsx family ported).
- **Deferred / other-ticket**: #D dialog showCloseButton, #F command UI-43 (arch queue).
