# UI-36A — Visual-parity audit worklist (wave A: component names a–l)

Method (per ADR 0022 visual-parity amendment 2026-07-11, v1 criterion 2): every wave-A component carries TWO verdicts —
1. **Class-diff verdict** — char-level diff of every `cv`/`cva` base + variant string, `data-slot`/`data-state`/`data-variant`, element structure, and provenance header vs the canonical checkout at `shadcn-ref/apps/v4/registry/new-york-v4/ui`. Divergences logged here — real drift fixed, intentional platform divergences annotated and kept. (Automated audit, done.)
2. **Side-by-side** — manual eyeball pass (done 2026-07-12): the live www gallery preview (`nisli.dev/ui/<name>`, headless-chromium screenshots incl. overlay open-states) vs ui.shadcn.com's default-style demo, covering what class diffs cannot (stacking, focus rings, spacing). Legend: **☑** verified-match · **⏸** deferred (live renders pre-fix copies — the batch-1 resync `67c44ab` is unlanded, so input-otp/command/calendar/carousel/checkbox show stale artifacts) · **N/A** nisli-custom, no ui.shadcn.com counterpart · **⚠** flagged (see notes).

Never ported from memory (NORTH-STAR tenet 3).

## Per-component verdict table (32) — categories are non-overlapping

| # | Component | Class-diff verdict | Side-by-side | Action |
|---|-----------|--------------------|:---:|--------|
| 1 | accordion | MATCH | ☑ | — |
| 2 | alert | MATCH | ☑ | — |
| 3 | alert-dialog | MATCH | ☑ | open-state verified (centered modal, Cancel/Continue) |
| 4 | aspect-ratio | MATCH | ☑ | 16/9 box |
| 5 | attachment | MATCH | N/A | nisli-custom — no ui.shadcn.com demo |
| 6 | avatar | SCOPE → PORT (batch 2) | ☑ | fallback renders; #A AvatarBadge/AvatarGroup/AvatarGroupCount PORT as batch-2 (eng1) |
| 7 | badge | MATCH | ☑ | default/secondary/outline/destructive pills |
| 8 | breadcrumb | MATCH | ☑ | — |
| 9 | bubble | MATCH | N/A | nisli-custom — no ui.shadcn.com demo |
| 10 | button | MATCH | ☑ | all 6 variants |
| 11 | button-group | INTENTIONAL | ☑ | attached Cut/Copy/Paste; #E extra data-slot, kept |
| 12 | calendar | MATCH (class) | ⏸ | live pre-fix (batch-1 resync unlanded); ✅ tsc fix folded (unused `buttonVariants`) |
| 13 | card | MATCH | ☑ | — |
| 14 | carousel | MATCH (class) | ⏸ | live pre-fix; ✅ tsc fix folded (unused `uid`) |
| 15 | checkbox | MATCH (class) | ⏸ | live pre-fix; ✅ lightningcss hygiene fix folded (url() quotes → %27) |
| 16 | collapsible | MATCH | ☑ | — |
| 17 | combobox | INTENTIONAL | ☑ | open-state verified (search + list); documented deviation (Popover+Command) |
| 18 | command | DRIFT-FIXED | ⏸ | live pre-fix; ✅ #2 h-12 · ✅ #C sr-only title/desc · #F UI-43 gap (record-only) |
| 19 | context-menu | MATCH | ☑ | open-state verified (Actions/Back/Reload/Delete at pointer) |
| 20 | dialog | MATCH | ☑ | open-state verified (Edit profile modal); #D showCloseButton feature gap, deferred |
| 21 | direction | MATCH | N/A | provider — no visual / no ui.shadcn.com demo |
| 22 | drawer | MATCH | ☑ | open-state verified (bottom Move-goal + drag handle) |
| 23 | dropdown-menu | MATCH | ☑ | open-state verified (checkbox item, shortcut, submenu, destructive) |
| 24 | empty | MATCH | ⚠ | live preview renders blank — likely a www preview-example gap (class parity holds); flagged to eng3 |
| 25 | form-field | SCOPE → DEFER | ☑ | invalid-state verified (red border/label/error); #B responsive/horizontal DEFER (NORTH-STAR note) |
| 26 | hover-card | MATCH | ☑ | open-state verified (floating framework card) |
| 27 | input | MATCH | ☑ | labeled email input |
| 28 | input-group | INTENTIONAL | ⚠ | live preview renders near-empty — likely a www preview-example gap (class parity holds); flagged to eng3. #E extra data-slot, kept |
| 29 | input-otp | DRIFT-FIXED | ⏸ | live pre-fix; ✅ #1 3 tokens + aria-invalid forwarding · ✅ tsc fix (`ReadonlySignal`) |
| 30 | item | MATCH | ☑ | media + title + action |
| 31 | kbd | MATCH | ☑ | ⌘K keys |
| 32 | label | MATCH | ☑ | — |

**Class-diff tally (non-overlapping, sums to 32):** 25 MATCH · 2 DRIFT-FIXED (command, input-otp) · 3 INTENTIONAL (button-group, input-group, combobox) · 2 SCOPE (avatar→port batch-2, form-field→defer).
**Manual side-by-side (2026-07-12):** 22 ☑ verified-match · 5 ⏸ deferred (calendar/carousel/checkbox/command/input-otp — live renders pre-fix copies until the WWW-12 series' resync `67c44ab` deploys) · 3 N/A (attachment/bubble/direction — nisli-custom) · 2 ⚠ flagged (empty/input-group — live preview renders sparse; class parity holds, so likely a www preview-example gap, not a component defect — flagged to eng3). All overlay open-states (dialog/alert-dialog/dropdown-menu/context-menu/hover-card/drawer/combobox) captured + verified. Re-run the 5 deferred + sidebar after the WWW-12 series deploys.

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

## SCOPE rulings (arch)

### #A avatar — PORT AvatarBadge/AvatarGroup/AvatarGroupCount (own batch 2)
In-surface parity for an existing component; arch ruled PORT, but as a dedicated batch-2 item, NOT jammed into the fix cycle. The 3 currently-ported parts (Avatar/AvatarImage/AvatarFallback) MATCH verbatim.

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

---

## Batch plan
- **Batch 1** (green, awaiting rev re-review): parity #1 #2 + #C a11y (arch ruling) + folded tsc-strict (calendar/carousel/input-otp) + www hygiene (checkbox). input-otp forwarding is rev-gated.
- **Manual side-by-side pass**: 0/32 — needs www gallery preview live (coordinate with eng3); flip ☐→☑ per component as verified. Required for final UI-36A closure.
- **Batch 2**: #A avatar sub-component port.
- **Deferred / other-ticket**: #B form-field (NORTH-STAR note), #D dialog showCloseButton, #F command UI-43 (arch queue).
