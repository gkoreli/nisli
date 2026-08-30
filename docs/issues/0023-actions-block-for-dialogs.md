# 0023 — Dialogs have no action row; screens fake one with a fieldless `Form`

**Status**: resolved (2026-08-30) by [ADR 0043](../adr/0043-engine-intent-vocabulary-contract.md) §E5 — option 1: `Dialog({ actions?: readonly Action[] })`, rendered by the one `actionRow()` in the body's flow after `children` (wraps, never overflows); the fieldless `Form` in `connections.ts` is gone
**Priority**: P2
**Area**: `@nisli/engine` — `blocks/dialog.ts`, a missing block
**Found**: 2026-08-28 (Banks screen) and again by the rules screen fork the same day

## Summary

`Dialog` (`packages/engine/src/blocks/dialog.ts`) renders a title, a close
control and `children`. A dialog whose purpose is a decision — "Sync now" /
"Disconnect" for a connected bank in
`packages/ledger/src/screens/connections.ts` — has nowhere to put its actions.
The screen mounts `Form<Record<string, never>>` with `fields: []`, a
`submitLabel`, and a `destructive` action, purely to obtain a button row with
the engine's busy/confirm behaviour.

It works, and it is the wrong intent: the screen is saying "a form" to mean
"some actions".

## Options

1. `Dialog({ actions?: readonly Action[] })` — the engine renders them in its
   footer with the same rank/busy/destructive rules `Toolbar` already applies,
   overflowing to a menu when the sheet is narrow.
2. A standalone `Actions({ actions })` block usable anywhere a row of
   decisions belongs (empty states, section footers), of which Dialog's footer
   is one placement.

Option 1 first; option 2 if a third placement appears.
