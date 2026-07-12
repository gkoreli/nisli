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
| 6 | avatar | PORTED (batch 2) ✅ | ☑ baseline | BASELINE only (Avatar/Image/Fallback, my earlier live capture). The NEWLY-ported Badge/AvatarGroup/AvatarGroupCount surface (ring+overlap TRANSLATED for the transparent host, cross-cutting rule) needs compiled-CSS + browser side-by-side — PENDING (batch-2, eng1/rev); excluded from the verified-new-surface claim |
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
| 24 | empty | MATCH | ⚠ OPEN | live preview rendered blank; class parity holds (likely a www preview-example gap). eng3 curated in `examples.ts` — recapture after that deploys to close |
| 25 | form-field | SCOPE → DEFER | ☑ | invalid-state verified (red border/label/error); #B responsive/horizontal DEFER (NORTH-STAR note) |
| 26 | hover-card | MATCH | ☑ | open-state verified (floating framework card) |
| 27 | input | MATCH | ☑ | labeled email input |
| 28 | input-group | INTENTIONAL | ⚠ OPEN | live preview rendered near-empty; class parity holds. eng3 curated in `examples.ts` — recapture after deploy to close. #E extra data-slot, kept |
| 29 | input-otp | DRIFT-FIXED | ☑ | fresh-live: 6 slots + minus separator — matches shadcn (aria-invalid fix is state-specific, not shown at rest); ✅ #1 tokens+forwarding · ✅ tsc fix |
| 30 | item | MATCH | ☑ | media + title + action |
| 31 | kbd | MATCH | ☑ | ⌘K keys |
| 32 | label | MATCH | ☑ | — |

**Class-diff tally (non-overlapping, sums to 32):** 25 MATCH · 2 DRIFT-FIXED (command, input-otp) · 3 INTENTIONAL (button-group, input-group, combobox) · 1 PORTED (avatar, batch-2 ✅) · 1 SCOPE (form-field→defer).
**Manual side-by-side — WAVE-A 27-ROW RE-RUN COMPLETE (2026-07-12, vs fresh live 39a8d36); overall UI-36A manual criterion still OPEN.** Row accounting: 27 ☑ · 3 N/A (attachment/bubble/direction — nisli-custom, no ui.shadcn.com demo) · 2 ⚠ (empty/input-group — OPEN) = 32. The 5 previously-deferred (calendar/carousel/checkbox/command/input-otp) were re-run + verified on current-gen live copies — checkbox's rendered checkmark confirms the `url()` %27 fix; corroborated by cdx1's UI-53 contact sheets. All overlay open-states captured. **OPEN for criterion closure (not covered by the 27):** (a) avatar batch-2 Badge/AvatarGroup/AvatarGroupCount NEW-surface visual — compiled CSS + browser side-by-side (the avatar ☑ is BASELINE-only); (b) empty + input-group recapture after eng3's landed curation; (c) mobile sidebar/DocsLayout drawer → WWW-13.
**WWW-12 layout — live verification (2026-07-12):** desktop DocsLayout VERIFIED on fresh live — SidebarNav offset correctly below the top bar (the `--header-height` offset works), derived grouped nav (docs sections + Components/Primitives) with active highlight, prose capped at `max-w-3xl` (article-level), /ui gallery full-width. **BLOCKER → WWW-13 (eng3):** the mobile sidebar DRAWER does NOT open on `/docs` — the page ships no hydration script, so the `SidebarTrigger` click yields no sheet-content/mobile-panel. The ADR 0024 amendment requires the drawer's portaled Sheet in the hydrate set for DocsLayout pages; that wiring is missing (www hydration lane). Mobile sidebar/DocsLayout stays UNVERIFIED (checkbox held) until WWW-13 lands + redeploys; desktop is verified.

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

### #B form-field — DEFER responsive orientation + horizontal checkbox-token
`fieldVariants`: upstream `horizontal` ends with `has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px` (field.tsx:66); the `responsive` orientation (`flex-col @md/field-group:flex-row …`, :68–72) is absent. Both depend on unported `FieldGroup` (`@container/field-group`) + `FieldContent`; adding them = dead selectors. Arch ruled DEFER; recorded here AND as a not-ported one-liner in `packages/ui/NORTH-STAR.md`.

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

### CROSS-CUTTING RULE — box-model utilities never cross a `display:contents` host
A layout-transparent host (`transparentHost` → `display:contents`) generates **no box**, so box-model utilities — **ring/box-shadow, margin, `space-x`/`space-y`, padding, border, background** — placed by a selector that MATCHES the host neither paint on it nor take effect, AND the real boxed element the utility is meant for is one level deeper (a DESCENDANT of the host). Any upstream **direct-child** selector (`*:`, `> *`, `space-*`, adjacent/sibling combinators) that assumes the slot-bearing element is a direct child is therefore DEAD through our hosts. Translation: target the boxed descendant — `**:` (descendant) instead of `*:` (child), and an explicit descendant margin (e.g. `[&>*:not(:first-child)>*]:-ms-2`) instead of `space-*`. Selector MATCHING crosses `display:contents` fine (it is layout, not the DOM tree); only PAINTING/box-model does not. **This is now the THIRD instance of the class: checkbox/switch (native-control translation), command (`**:data-[slot=command-input-wrapper]`), avatar (AvatarGroup overlap+ring).** Wave-B and all future ports must check every direct-child/`space-*`/ring-on-child selector against this rule.

---

## Batch plan
- **Batch 1** (green, awaiting rev re-review): parity #1 #2 + #C a11y (arch ruling) + folded tsc-strict (calendar/carousel/input-otp) + www hygiene (checkbox). input-otp forwarding is rev-gated.
- **Manual side-by-side pass**: wave-A 27-row RE-RUN complete vs fresh live (39a8d36); overall UI-36A manual criterion still OPEN. Accounting 27 ☑ + 3 N/A + 2 ⚠ = 32. OPEN for closure: avatar batch-2 NEW-surface visual (avatar ☑ is baseline-only); empty + input-group recapture after eng3 curation; mobile drawer WWW-13.
- **Batch 2** (✅ done, awaiting rev): #A avatar sub-component port — Badge/Count verbatim, AvatarGroup ring+overlap translated for the transparent host (cross-cutting box-model rule), +6 tests incl. the DOM-structure applicability regression.
- **Deferred / other-ticket**: #B form-field (NORTH-STAR note), #D dialog showCloseButton, #F command UI-43 (arch queue).
