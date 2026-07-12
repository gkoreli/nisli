# 0027. NavigationMenu Tap/Click Activation Parity

**Date**: 2026-07-12
**Status**: Accepted (UI-64)
**Depends on**: [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md)

## Context

A real-Chromium-390 interaction guard proved a **product defect** in
`ui/navigation-menu.ts`: both a **tap** (touch) and a **click** (mouse) on a
`NavigationMenuTrigger` left the content panel closed — a `0 -> 0` visible
transition — even though hydration and the example were present. Keyboard,
roving-focus, hover-open, and ARIA were all correct; only pointer *activation*
was broken.

### Root cause

The trigger wired three handlers:

```
@pointerenter=${() => state.open(own.value)}
@pointerleave=${() => state.scheduleClose()}
@click=${() => state.toggle(own.value)}
```

A single tap/click is **one gesture that emits both** a `pointerenter` and a
trailing `click`:

1. `pointerenter` -> `state.open(own)` — opens (`'' -> own`)
2. `click` -> `state.toggle(own)` — value already `own`, so toggles back (`own -> ''`)

Net: **open then immediately toggled shut**, for touch *and* mouse-click alike.
Desktop hover-only users never saw it because they never fire the trailing
click; the panel just stays open under the pointer.

## Decision

Three coordinated changes, all local to the trigger except the outside-dismiss
(root):

### 1. Hover-open is mouse-only (Radix `whenMouse` parity)

Pointer hover handlers run only for `pointerType === 'mouse'`:

```ts
const whenMouse = (run) => (event: PointerEvent) => {
  if (event.pointerType === 'mouse') run();
};
```

Touch and pen fire a synthetic `pointerenter` too; gating it out means **touch
relies solely on the click**, which opens. No double-toggle on touch.

### 2. Same-gesture click keeps the panel open (`openedByHover` flag)

A *mouse* click still arrives as `pointerenter[mouse]` (hover-open) then
`click`. To make a single mouse click end OPEN — parity with tap — the trigger
tracks whether *this* hover just opened the panel:

```ts
let openedByHover = false;
onPointerEnter = whenMouse(() => { openedByHover = !isOpen.value; state.open(own.value); });
onPointerLeave = whenMouse(() => { openedByHover = false; state.scheduleClose(); });
onClick = () => {
  if (openedByHover) { openedByHover = false; state.open(own.value); return; } // ride-in: don't toggle shut
  state.toggle(own.value);
};
```

The click that rides in on the opening hover **consumes** the flag and keeps the
panel open; the *next*, independent click toggles closed as normal.

### 3. Outside-pointerdown dismissal (root)

Touch has no `pointerleave` grace to fall back on, so a tap-opened panel needs a
non-hover close path. The root registers (on mount, torn down on disconnect via
`onCleanup`) a `document` `pointerdown` listener that closes the open panel when
the pointer lands outside the menu — Radix `onPointerDownOutside` parity, and
click-away for mouse users too.

## Consequences

- **Tap opens, click opens** — both end with the panel visible; the guard's
  `0 -> 0` defect is fixed. A second tap/click toggles closed.
- **Desktop hover unchanged** — mouse hover opens, `pointerleave` closes after
  the existing grace, Escape closes, roving focus / `aria-expanded` /
  `aria-controls` / `data-state` / `data-viewport="false"` all untouched.
- **Trade-off (intentional):** on desktop, closing a *hover-opened* panel by
  clicking its trigger now takes the pointer leaving (grace close) or a second
  click — the first click is absorbed as the gesture's ride-in. This is the
  price of "single mouse click ends OPEN," which the touch/click guard requires;
  the two activation events of one gesture are otherwise indistinguishable.
- **Listener hygiene** — the only global listener (`document` `pointerdown`) is
  removed on disconnect; verified by a unit test spying `removeEventListener`.

## Verification

- Unit (happy-dom): touch-tap opens, second tap closes, single mouse-click
  opens, independent second click closes, hover-open + `pointerleave`-grace
  close, Escape close, outside-`pointerdown` dismiss, inside-`pointerdown`
  no-dismiss, listener removed on disconnect. Existing hover/ARIA/roving/
  value-change tests unchanged (pointer helpers now carry `pointerType='mouse'`).
- Real Chromium-390: tap + click visible-content proof via the cdx2 preview
  guard (no preview-sweep edits from this ticket).
