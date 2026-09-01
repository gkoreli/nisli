# 0030 — Action columns consume text slack and mixed table cells align by baseline

**Status**: resolved 2026-09-01
**Priority**: P1
**Area**: `@nisli/engine` — `blocks/table.ts`, `engine/space.ts`
**Found**: 2026-09-01, in Waypoint's opportunity table after rebasing onto
engine 0.10.0.

## Summary

Waypoint declared its final Actions column `priority: 'primary'` so the edit
control would survive folding. Table classified every non-date/non-figure
column as text, and ADR 0044's slack pass gave every primary text column a
double share. A 32px edit button therefore occupied a roughly 196px column at
the inspected width, leaving a conspicuous empty region at the right edge.

The same table mixed two-line identity cells, text, status pills and buttons,
but cells retained the browser's baseline vertical alignment. Controls and
single-line values therefore did not share a consistent row centre.

## Mechanism

- `isTextKind()` included arbitrary content such as buttons because the public
  column vocabulary had no action kind.
- `weightOf()` derived width from `priority`, although `Priority` is defined as
  survival order and only that.
- `cellStyle()` chose only left/right text alignment and did not set
  `vertical-align`.

## Resolution

- `Column.kind: 'action'` states what the cell holds. Action columns are rigid,
  budgeted from the control hit floor plus cell padding and their header floor,
  excluded from text slack, and centred.
- Only the first primary text column—the existing identity and fold target—is
  the lead text column with a double share. Later primary columns retain their
  survival semantics without acquiring a second width meaning.
- Header and body cells use `vertical-align: middle`.
- Arithmetic and mounted-table tests prove the rigid action width, slack sum,
  horizontal centring and vertical alignment.
