# 0029 — The engine has one set of numbers for every context: no density, no touch floors, and the door `ctx.metrics` is not live

**Status**: resolved (2026-08-31) by [ADR 0046](../adr/0046-engine-density-and-input-axes.md) — axes domain, live `metrics` door, hit floors, `TARGET_SMALL`/`AXIS_STALE`; zero Ledger app edits; the Ledger proof's axes contexts handed over in `docs/tasks/ledger-axes-proof.md`
**Priority**: P1 — the last capability the north star measured and ADR 0034's plan promises (phase 5); user-felt by every touch user of Ledger today (24–36 px targets)
**Area**: `@nisli/engine` — `metrics.ts`, `skin.ts`, `blocks/kernel.ts`, `style.ts`, every block that reads `ctx.metrics`, `test/mount.ts`, `test/prove.ts`, `test/claims.ts`
**Found**: 2026-08-31, by the axes-round inventory (a read-only audit of every `metrics` read in the engine), against `main @ 645f2d9` (engine 0.9.0). Line numbers below are from that tree.

## Summary

The north star measured *"36px controls in one context and 18px in another
from a single inherited unit"* ([NORTH-STAR](../research/nextgen/NORTH-STAR.md)
§Measured), and ADR 0034's long-term plan names the two axes after colour:
**density** and **input**. ADR 0038 built the door for them — *"blocks read
`ctx.metrics`, never the module constant … when density and input become
axes, the kernel swaps what `ctx.metrics` returns and no block changes"*
([0038](../adr/0038-engine-block-kernel-and-space-domain.md) §Axis-readiness).

Three things are not true today:

### (a) There is one `metrics`, and it is a frozen constant

`metrics.ts:6` is `as const`. A control is 32 px tall in a dense desktop table
and on a phone held in one hand; a row is ~36 px everywhere; the smallest
interactive target in the engine — the notice dismiss, `notice.ts:125`,
`height: control.height − space[2]` — is **24 px** on every device. WCAG 2.5.8
asks 24 px minimum; the platform guidelines (Apple HIG, Material) ask 44/48 px
on touch. Nothing in `src/` reads `(pointer: coarse)` or `(hover: hover)`.

Sub-44 px targets on touch, measured from the inline styles the engine writes
(body line box 14 × 1.4 ≈ 19.6 px):

| target | file:line | size |
|---|---|---|
| every button (`buttonBox`) | `style.ts:37` | 32 |
| menu item (`menuItemBox`) | `style.ts:53` | 32 |
| input / select (`inputBox`) | `style.ts:65` | 32 |
| checkbox | `form.ts:209` (`control.check`) | 16 |
| notice dismiss | `notice.ts:125` | **24** |
| table body row (openable) | `table.ts:140` | ≈ 36 |
| sortable header's button | `table.ts:234–237` (`padding: 0`) | ≈ 17 |
| app nav link | `app.ts:110` | ≈ 36 |

### (b) The door is not live: most reads would not follow an axis

If `metrics` became a function of axes tomorrow, the audit classifies the
reads that would **not** re-evaluate:

- **Eleven blocks snapshot the door at setup** — `const { metrics } = ctx;`
  at `app.ts:46`, `bars.ts:23`, `table.ts:62`, `columns.ts:36`, `form.ts:104`,
  `page.ts:19`, `empty.ts:18`, `meter.ts:17`, `notice.ts:93`, `toolbar.ts:35`,
  `dialog.ts:29`. Harmless only if the object behind the door is stable and
  its *properties* are live.
- **~25 `ctx.part(parts, { … })` calls pass a plain record**, evaluated once:
  `app.ts:110`; `bars.ts:33`; `columns.ts:50,51,72`; `form.ts:180,202,209,223,314,331,353`;
  `notice.ts:106,125,134`; `dialog.ts:74,78`; `page.ts:24,34,35,37`; `meter.ts:22`;
  `table.ts:250`; `actions.ts:58`. The kernel's `part()` accepts a thunk for
  exactly this reason (`kernel.ts:118`) and these sites do not use it.
- **Frozen derived constants**: the chart budgets `bars.ts:27` and
  `columns.ts:43` (`labelChars × charWidth + space[2]`), the form gap
  `form.ts:105`, the Toolbar `fitRow` gap `toolbar.ts:44`, the page-size seed
  `table.ts:67`.
- **Untracked per-solve reads**: the `fitRow` callbacks at `table.ts:92,96`
  and `toolbar.ts:45,51` re-run on every solve but nothing re-solves on an
  axis change (`use-fit.ts:63` — `deps` is the block's own).
- **Tests and the estimator** read the module constant directly
  (`mount.ts:58`, `estimate.ts:69,176`, and `table.test.ts:25`,
  `space.test.ts:5`, `layout.test.ts:36`, `form.test.ts:190`,
  `overlay.test.ts:63`) — fine as long as the object stays the door.

The scan in `kernel.test.ts` bans the *import* (rule 4, ADR 0038 §5) and says
nothing about a plain record or a setup-time constant, so nothing today would
fail when a block freezes a number.

### (c) Nothing can prove a context but colour

`MountOptions` (`test/mount.ts:20–31`) and `ProveOptions` (`test/prove.ts:41–63`)
take `scheme` and nothing else; `prove()` loops over `widths` only
(`prove.ts:102`). The claim catalogue has no target-size claim and no way to
say "this block did not follow the axis". `estimate.ts` estimates widths only
— a density that moved heights would be invisible to every proof and caught
only by `verify()` in Chromium.

### Adjacent, recorded but not this issue

- `table.ts:178–179` uses `mouseenter`/`mouseleave` for the row tint; touch
  fires a synthetic `mouseenter` that does not reliably clear. `pointerenter`/
  `pointerleave` is the pointer-agnostic pair.
- `columns.ts:63` exposes each bar's value only through a `title` tooltip —
  no touch path and no keyboard path. An accessibility gap of its own; not an
  axis.
- `form.ts:311` is a `<span>` with a `click` handler and no role — the label
  of a field, pointer-only. Reachability (0042) missed it.
- The skin carries the whole type ramp (`skin/default.ts:82`, `:94–100`) and
  `metrics.charWidth` is calibrated to its 14 px body. A density that scaled
  type would invalidate every char budget and `test/glyphs.ts`. This is why
  the ADR scales rhythm and controls, not type (0046 §Non-goals).

## The mechanism in one sentence

`metrics` is a constant, the door reads it once, and there is no context the
engine detects except colour — so the same intent is the same size everywhere,
and a touch user gets pointer-sized targets.

## Resolution

[ADR 0046](../adr/0046-engine-density-and-input-axes.md): axes become an
engine domain (`engine/axes.ts`: scheme, density, input — detected, forwarded,
never authored per block); `metrics` becomes a live door over a table decided
by the axes; every frozen read above becomes reactive; `control.hit` is the
one number the input axis floors; `mount()`/`prove()` take axes; two claims
(`TARGET_SMALL`, `AXIS_STALE`) make both new properties checkable with no
browser. Zero Ledger edits.
